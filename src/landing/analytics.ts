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
  dailyQuantity: { day: string; count: number }[];
  dowHourHeatmap: { dow: number; hour: number; count: number }[];
}

// --- In-memory cache for 1 hour ---
const analyticsCache: Record<string, { timestamp: number; data: FeedAnalytics }> = {};
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

// Feeds that should use GMT-3
const GMT3_FEEDS = ['uruguay', 'argentina', 'riodelaplata', 'brasil'];

export async function getFeedAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const nowMs = Date.now();

  if (analyticsCache[feedId] && nowMs - analyticsCache[feedId].timestamp < CACHE_TTL_MS) {
    return analyticsCache[feedId].data;
  }

  const db = dbClient.client?.db();
  if (!db) throw new Error('Database client not initialized');
  if (!algos[feedId]) throw new Error(`Feed ${feedId} not found`);

  const tz = GMT3_FEEDS.includes(feedId) ? 'America/Montevideo' : 'UTC';
  const now = new Date();

  const periodStart = getPeriodStartDate(now, period, tz);
  const previousPeriodStart = getPeriodStartDate(periodStart, period, tz);

  const postCount = await getPostCountForFeed(db, feedId, periodStart, now);
  const previousPostCount = await getPostCountForFeed(db, feedId, previousPeriodStart, periodStart);

  const uniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, periodStart, now);
  const previousUniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, previousPeriodStart, periodStart);

  const daysInPeriod = getDaysInPeriod(periodStart, now, tz);
  const daysInPreviousPeriod = getDaysInPeriod(previousPeriodStart, periodStart, tz);

  const avgPostsPerDay = daysInPeriod > 0 ? postCount / daysInPeriod : 0;
  const previousAvgPostsPerDay = daysInPreviousPeriod > 0 ? previousPostCount / daysInPreviousPeriod : 0;

  const postCountTrend = calculateTrend(postCount, previousPostCount);
  const uniqueAuthorsTrend = calculateTrend(uniqueAuthors, previousUniqueAuthors);
  const avgPostsPerDayTrend = calculateTrend(avgPostsPerDay, previousAvgPostsPerDay);

  const timeDistribution = await getTimeDistribution(db, feedId, periodStart, now, tz);
  const dailyQuantity = await getDailyQuantity(db, feedId, tz);
  const dowHourHeatmap = await getDowHourHeatmap(db, feedId, tz);

  const analyticsData: FeedAnalytics = {
    feedId,
    postCount,
    uniqueAuthors,
    avgPostsPerDay,
    postCountTrend,
    uniqueAuthorsTrend,
    avgPostsPerDayTrend,
    timeDistribution,
    dailyQuantity,
    dowHourHeatmap,
  };

  analyticsCache[feedId] = { timestamp: nowMs, data: analyticsData };
  return analyticsData;
}

// --- Helper functions ---

function getPeriodStartDate(date: Date, period: string, tz: string): Date {
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  localDate.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day':
      localDate.setDate(localDate.getDate() - 1);
      break;
    case 'week':
      localDate.setDate(localDate.getDate() - 7);
      break;
    case 'month':
      localDate.setMonth(localDate.getMonth() - 1);
      break;
    default:
      localDate.setDate(localDate.getDate() - 7);
  }
  return localDate;
}

function getDaysInPeriod(startDate: Date, endDate: Date, tz: string): number {
  const startLocal = new Date(startDate.toLocaleString('en-US', { timeZone: tz }));
  const endLocal = new Date(endDate.toLocaleString('en-US', { timeZone: tz }));
  return Math.ceil((endLocal.getTime() - startLocal.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
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

async function getTimeDistribution(db: any, feedId: string, startDate: Date, endDate: Date, tz: string) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        { $addFields: { hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tz } } } },
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

async function getDailyQuantity(db: any, feedId: string, tz: string) {
  try {
    const now = new Date();
    const dayStrs: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const localDayStr = d.toLocaleDateString('en-CA', { timeZone: tz });
      dayStrs.push(localDayStr);
    }

    const startDateLocal = new Date(new Date(dayStrs[0] + 'T00:00:00').toLocaleString('en-US', { timeZone: tz }));
    const endDateLocal = new Date(new Date(dayStrs[dayStrs.length - 1] + 'T23:59:59.999').toLocaleString('en-US', { timeZone: tz }));

    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDateLocal.getTime(), $lte: endDateLocal.getTime() } } },
        { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$indexedAt' }, timezone: tz } } } },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
        { $sort: { day: 1 } },
      ])
      .toArray();

    return dayStrs.map((dayStr) => {
      const found = result.find((r) => r.day === dayStr);
      return { day: dayStr, count: found ? found.count : 0 };
    });
  } catch (error) {
    console.error(`Error getting daily quantity for feed ${feedId}:`, error);
    return [];
  }
}

// --- Corrected Heatmap: always Sunday=1 ... Saturday=7 ---
async function getDowHourHeatmap(db: any, feedId: string, tz: string) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const raw = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: now.getTime() } } },
        {
          $addFields: {
            day: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$indexedAt' }, timezone: tz } },
            hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tz } },
          },
        },
        { $group: { _id: { day: '$day', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id.day', hour: '$_id.hour', count: 1 } },
        { $sort: { day: 1, hour: 1 } },
      ])
      .toArray();

    // Map day string to dow (Sunday=1,...Saturday=7 for consistency)
    const dowMap: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayStr = d.toLocaleDateString('en-CA', { timeZone: tz });
      const dow = d.getDay() + 1; // Sunday=1, Monday=2, ..., Saturday=7
      dowMap[dayStr] = dow;
    }

    const heatmap: { dow: number; hour: number; count: number }[] = [];
    for (const dayHour of raw) {
      const dow = dowMap[dayHour.day] ?? 0;
      if (dow) heatmap.push({ dow, hour: dayHour.hour, count: dayHour.count });
    }

    // fill missing hours/days with 0
    const fullHeatmap: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) {
      const found = heatmap.find((v) => v.dow === d && v.hour === h);
      fullHeatmap.push({ dow: d, hour: h, count: found ? found.count : 0 });
    }

    return fullHeatmap;
  } catch (error) {
    console.error(`Error getting DOW×Hour heatmap for feed ${feedId}:`, error);
    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) out.push({ dow: d, hour: h, count: 0 });
    return out;
  }
}
