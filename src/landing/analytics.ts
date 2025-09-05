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
  timeDistribution: { hour: number; count: number }[];
  weeklyQuantity: { week: string; count: number }[];
  // --- New metrics ---
  mediaVsText: { media: number; text: number };
  repliesVsStandalone: { replies: number; standalone: number };
  trendingTags: { tag: string; count: number }[];
  topAuthors: { author: string; count: number }[];
  dowHourHeatmap: { dow: number; hour: number; count: number }[]; // 1=Sun..7=Sat (Mongo $dayOfWeek)
}

// --- In-memory cache for 1 hour ---
const analyticsCache: Record<string, { timestamp: number; data: FeedAnalytics }> = {};
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

export async function getFeedAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const nowMs = Date.now();

  // Return cached value if within 1 hour
  if (analyticsCache[feedId] && nowMs - analyticsCache[feedId].timestamp < CACHE_TTL_MS) {
    return analyticsCache[feedId].data;
  }

  const db = dbClient.client?.db();
  if (!db) throw new Error('Database client not initialized');

  if (!algos[feedId]) throw new Error(`Feed ${feedId} not found`);

  const now = new Date();
  const periodStart = getPeriodStartDate(now, period);
  const previousPeriodStart = getPeriodStartDate(periodStart, period);

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

  const timeDistribution = await getTimeDistribution(db, feedId, periodStart, now);
  const weeklyQuantity = await getWeeklyQuantity(db, feedId, getWeeksAgo(now, 12), now);

  // --- New analytics ---
  const mediaVsText = await getMediaVsText(db, feedId, periodStart, now);
  const repliesVsStandalone = await getRepliesVsStandalone(db, feedId, periodStart, now);
  const trendingTags = await getTrendingTags(db, feedId, periodStart, now);
  const topAuthors = await getTopAuthors(db, feedId, periodStart, now);
  const dowHourHeatmap = await getDowHourHeatmap(db, feedId, periodStart, now);

  const analyticsData: FeedAnalytics = {
    feedId,
    postCount,
    uniqueAuthors,
    avgPostsPerDay,
    postCountTrend,
    uniqueAuthorsTrend,
    avgPostsPerDayTrend,
    timeDistribution,
    weeklyQuantity,
    mediaVsText,
    repliesVsStandalone,
    trendingTags,
    topAuthors,
    dowHourHeatmap,
  };

  // Store in cache
  analyticsCache[feedId] = { timestamp: nowMs, data: analyticsData };

  return analyticsData;
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
  return Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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

export function getAvailableFeeds() {
  if (!algos) return [];
  return Object.keys(algos).map((id) => ({
    id,
    name: algos[id]?.handler?.name || id,
  }));
}

// --- Database queries (Mongo) ---
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
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        { $addFields: { hour: { $hour: { $toDate: '$indexedAt' } } } },
        { $group: { _id: '$hour', count: { $sum: 1 } } },
        { $project: { _id: 0, hour: '$_id', count: 1 } },
        { $sort: { hour: 1 } },
      ])
      .toArray();

    return Array.from({ length: 24 }, (_, hour) => {
      const found = result.find((item: any) => item.hour === hour);
      return { hour, count: found ? found.count : 0 };
    });
  } catch (error) {
    console.error(`Error getting time distribution for feed ${feedId}:`, error);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  }
}

async function getWeeklyQuantity(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    return await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        {
          $addFields: {
            week: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$indexedAt' } } },
          },
        },
        { $group: { _id: '$week', count: { $sum: 1 } } },
        { $project: { _id: 0, week: '$_id', count: 1 } },
        { $sort: { week: 1 } },
      ])
      .toArray();
  } catch (error) {
    console.error(`Error getting weekly quantity for feed ${feedId}:`, error);
    return [];
  }
}

// --- New queries ---
async function getMediaVsText(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    const matchBase = {
      algoTags: feedId,
      indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    };

    const media = await db.collection('post').countDocuments({
      ...matchBase,
      $or: [
        { 'embed.images': { $ne: null } },
        { 'embed.video': { $ne: null } },
        { 'embed.media': { $ne: null } },
      ],
    });

    // text-only: no embed fields present/non-null
    const text = await db.collection('post').countDocuments({
      ...matchBase,
      'embed.images': null,
      'embed.video': null,
      'embed.media': null,
    });

    return { media, text };
  } catch (error) {
    console.error(`Error getting media vs text for feed ${feedId}:`, error);
    return { media: 0, text: 0 };
  }
}

async function getRepliesVsStandalone(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    const matchBase = {
      algoTags: feedId,
      indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() },
    };

    const replies = await db.collection('post').countDocuments({
      ...matchBase,
      replyRoot: { $ne: null },
    });

    const standalone = await db.collection('post').countDocuments({
      ...matchBase,
      replyRoot: null,
    });

    return { replies, standalone };
  } catch (error) {
    console.error(`Error getting replies vs standalone for feed ${feedId}:`, error);
    return { replies: 0, standalone: 0 };
  }
}

async function getTrendingTags(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        {
          $match: {
            algoTags: feedId,
            indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() },
            tags: { $ne: null },
          },
        },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, tag: '$_id', count: 1 } },
      ])
      .toArray();

    return result;
  } catch (error) {
    console.error(`Error getting trending tags for feed ${feedId}:`, error);
    return [];
  }
}

async function getTopAuthors(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, author: '$_id', count: 1 } },
      ])
      .toArray();

    return result;
  } catch (error) {
    console.error(`Error getting top authors for feed ${feedId}:`, error);
    return [];
  }
}

async function getDowHourHeatmap(db: any, feedId: string, startDate: Date, endDate: Date) {
  try {
    const raw = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        {
          $addFields: {
            hour: { $hour: { $toDate: '$indexedAt' } },
            dow: { $dayOfWeek: { $toDate: '$indexedAt' } }, // 1=Sun..7=Sat
          },
        },
        { $group: { _id: { dow: '$dow', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, dow: '$_id.dow', hour: '$_id.hour', count: 1 } },
      ])
      .toArray();

    // Fill missing (dow, hour) combos with 0s for a full 7x24 heatmap
    const map = new Map<string, number>();
    for (const r of raw) {
      map.set(`${r.dow}-${r.hour}`, r.count);
    }
    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) {
      for (let h = 0; h < 24; h++) {
        out.push({ dow: d, hour: h, count: map.get(`${d}-${h}`) ?? 0 });
      }
    }
    return out;
  } catch (error) {
    console.error(`Error getting DOW×Hour heatmap for feed ${feedId}:`, error);
    // Return empty 7x24 with zeros
    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) out.push({ dow: d, hour: h, count: 0 });
    return out;
  }
}
