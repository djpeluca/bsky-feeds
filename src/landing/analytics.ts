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

  // --- Define period: last 7 days (including today) ---
  const periodStart = new Date();
  periodStart.setDate(now.getDate() - 6);
  periodStart.setHours(0, 0, 0, 0);

  const previousPeriodStart = new Date();
  previousPeriodStart.setDate(periodStart.getDate() - 7);
  previousPeriodStart.setHours(0, 0, 0, 0);

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

function getDaysInPeriod(startDate: Date, endDate: Date): number {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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
      d.setDate(now.getDate() - i);
      dayStrs.push(d.toLocaleDateString('en-CA', { timeZone: tz }));
    }

    const startDateLocal = new Date(dayStrs[0] + 'T00:00:00');
    const endDateLocal = new Date(dayStrs[dayStrs.length - 1] + 'T23:59:59.999');

    const result = await db
      .collection('post')
      .aggregate([
        {
          $match: {
            algoTags: feedId,
            indexedAt: { $gte: startDateLocal.getTime(), $lte: endDateLocal.getTime() },
          },
        },
        {
          $addFields: {
            day: {
              $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$indexedAt' }, timezone: tz },
            },
          },
        },
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

async function getDowHourHeatmap(db: any, feedId: string, tz: string) {
  try {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const raw = await db
      .collection('post')
      .aggregate([
        {
          $match: {
            algoTags: feedId,
            indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() },
          },
        },
        {
          $addFields: {
            hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tz } },
            dow: { $isoDayOfWeek: { date: { $toDate: '$indexedAt' }, timezone: tz } },
          },
        },
        { $group: { _id: { dow: '$dow', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, dow: '$_id.dow', hour: '$_id.hour', count: 1 } },
      ])
      .toArray();

    const map = new Map<string, number>();
    for (const r of raw) map.set(`${r.dow}-${r.hour}`, r.count);

    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++)
      for (let h = 0; h < 24; h++)
        out.push({ dow: d, hour: h, count: map.get(`${d}-${h}`) ?? 0 });

    return out;
  } catch (error) {
    console.error(`Error getting DOW×Hour heatmap for feed ${feedId}:`, error);
    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) out.push({ dow: d, hour: h, count: 0 });
    return out;
  }
}
