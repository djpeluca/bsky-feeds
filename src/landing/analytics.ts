import dbClient from '../db/dbClient';
import algos from '../algos';

export interface FeedAnalytics {
  feedId: string;
  postCount: number;
  uniqueAuthors: number;
  avgPostsPerDay: number;
  postCountTrend: number;
  uniqueAuthorsTrend: number;
  avgPostsPerDayTrend: number;
  timeDistribution?: { hour: number; count: number }[];
  weeklyQuantity?: { week: string; count: number }[];
}

export async function getFeedAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const db = dbClient.client?.db();
  if (!db) throw new Error('Database client not initialized');

  // Validate feed exists
  if (!algos[feedId]) {
    throw new Error(`Feed ${feedId} not found`);
  }

  const now = new Date();
  const periodStart = getPeriodStartDate(now, period);
  const previousPeriodStart = getPeriodStartDate(periodStart, period);

  console.log('Fetching analytics for feed:', feedId);

  // Query counts
  const postCount = await getPostCountForFeed(db, feedId, periodStart, now);
  const previousPostCount = await getPostCountForFeed(db, feedId, previousPeriodStart, periodStart);

  const uniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, periodStart, now);
  const previousUniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, previousPeriodStart, periodStart);

  const daysInPeriod = getDaysInPeriod(periodStart, now);
  const daysInPreviousPeriod = getDaysInPeriod(previousPeriodStart, periodStart);

  const avgPostsPerDay = daysInPeriod > 0 ? postCount / daysInPeriod : 0;
  const previousAvgPostsPerDay = daysInPreviousPeriod > 0 ? previousPostCount / daysInPreviousPeriod : 0;

  const postCountTrend = calculateTrend(postCount, previousPostCount);
  const uniqueAuthorsTrend = calculateTrend(uniqueAuthors, previousUniqueAuthors);
  const avgPostsPerDayTrend = calculateTrend(avgPostsPerDay, previousAvgPostsPerDay);

  // Skip heavy queries for slow feeds
  let timeDistribution, weeklyQuantity;
  if (feedId !== 'brasil') {
    timeDistribution = await getTimeDistribution(db, feedId, periodStart, now);
    weeklyQuantity = await getWeeklyQuantity(db, feedId, getWeeksAgo(now, 12), now);
  }

  return {
    feedId,
    postCount,
    uniqueAuthors,
    avgPostsPerDay,
    postCountTrend,
    uniqueAuthorsTrend,
    avgPostsPerDayTrend,
    timeDistribution,
    weeklyQuantity,
  };
}

// --- Helper functions ---
function getPeriodStartDate(date: Date, period: string): Date {
  const result = new Date(date);
  switch (period) {
    case 'day':
      result.setDate(result.getDate() - 1);
      result.setHours(0, 0, 0, 0);
      break;
    case 'week':
      result.setDate(result.getDate() - 7);
      break;
    case 'month':
      result.setMonth(result.getMonth() - 1);
      break;
    default:
      result.setDate(result.getDate() - 7);
  }
  return result;
}

function getDaysInPeriod(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getWeeksAgo(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - weeks * 7);
  return result;
}

// --- Available feeds ---
export function getAvailableFeeds() {
  if (!algos) return [];
  return Object.keys(algos).map(id => ({
    id,
    name: algos[id]?.handler?.name || id
  }));
}

// --- Database queries ---
async function getPostCountForFeed(db: any, feedId: string, startDate: Date, endDate: Date): Promise<number> {
  try {
    return await db.collection('post').countDocuments({
      algoTags: feedId,
      indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    });
  } catch (error) {
    console.error(`Error getting post count for feed ${feedId}:`, error);
    return 0;
  }
}

async function getUniqueAuthorsForFeed(db: any, feedId: string, startDate: Date, endDate: Date): Promise<number> {
  try {
    const authors = await db.collection('post').distinct('author', {
      algoTags: feedId,
      indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    });
    return authors.length;
  } catch (error) {
    console.error(`Error getting unique authors for feed ${feedId}:`, error);
    return 0;
  }
}

async function getTimeDistribution(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    const result = await db.collection('post').aggregate([
      { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
      { $addFields: { hour: { $hour: { $toDate: "$indexedAt" } } } },
      { $group: { _id: "$hour", count: { $sum: 1 } } },
      { $project: { _id: 0, hour: "$_id", count: 1 } },
      { $sort: { hour: 1 } },
    ]).toArray();

    return Array.from({ length: 24 }, (_, hour) => {
      const found = result.find(item => item.hour === hour);
      return { hour, count: found ? found.count : 0 };
    });
  } catch (error) {
    console.error(`Error getting time distribution for feed ${feedId}:`, error);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  }
}

async function getWeeklyQuantity(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    return await db.collection('post').aggregate([
      { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
      { $addFields: { week: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$indexedAt" } } } } },
      { $group: { _id: "$week", count: { $sum: 1 } } },
      { $project: { _id: 0, week: "$_id", count: 1 } },
      { $sort: { week: 1 } },
    ]).toArray();
  } catch (error) {
    console.error(`Error getting weekly quantity for feed ${feedId}:`, error);
    return [];
  }
}
