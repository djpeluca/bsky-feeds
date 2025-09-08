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
  dailyQuantity: { day: string; count: number }[];   // <-- fixed
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

  const now = new Date();
  const tz = GMT3_FEEDS.includes(feedId) ? 'America/Montevideo' : undefined;

  const periodStart = getPeriodStartDate(now, period);
  const previousPeriodStart = getPeriodStartDate(periodStart, period);

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
  const dailyQuantity = await getDailyQuantity(db, feedId, now, tz);  // <-- fixed
  const dowHourHeatmap = await getDowHourHeatmap(db, feedId, periodStart, now, tz);

  const analyticsData: FeedAnalytics = {
    feedId,
    postCount,
    uniqueAuthors,
    avgPostsPerDay,
    postCountTrend,
    uniqueAuthorsTrend,
    avgPostsPerDayTrend,
    timeDistribution,
    dailyQuantity,   // <-- fixed
    dowHourHeatmap,
  };

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

function getDaysInPeriod(startDate: Date, endDate: Date, tz?: string): number {
  if (!tz) return Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
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

async function getTimeDistribution(db: any, feedId: string, startDate: Date, endDate: Date, tz?: string) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        { $addFields: { hour: tz ? { $hour: { date: { $toDate: '$indexedAt' }, timezone: tz } } : { $hour: { $toDate: '$indexedAt' } } } },
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

// --- New: get last 7 days quantity ---
async function getDailyQuantity(db: any, feedId: string, endDate: Date, tz?: string) {
  try {
    const startDate = new Date(endDate);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setDate(endDate.getUTCDate() - 6); // last 7 days

    const result = await db
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
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: '$indexedAt' },
                timezone: tz || 'UTC', // <-- force UTC if no tz
              },
            },
          },
        },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
        { $sort: { day: 1 } },
      ])
      .toArray();

    // Helper to format consistently with Mongo
    const formatDate = (d: Date, tz?: string) => {
      if (tz) {
        return d.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
      } else {
        return d.toISOString().split('T')[0]; // UTC normalized
      }
    };

    // Fill in missing days
    const days: { day: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      const dayStr = formatDate(d, tz);
      const found = result.find((r) => r.day === dayStr);
      days.push({ day: dayStr, count: found ? found.count : 0 });
    }

    return days;
  } catch (error) {
    console.error(`Error getting daily quantity for feed ${feedId}:`, error);
    return [];
  }
}


async function getDowHourHeatmap(db: any, feedId: string, startDate: Date, endDate: Date, tz?: string) {
  try {
    const raw = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime(), $lte: endDate.getTime() } } },
        {
          $addFields: {
            hour: tz ? { $hour: { date: { $toDate: '$indexedAt' }, timezone: tz } } : { $hour: { $toDate: '$indexedAt' } },
            dow: tz ? { $dayOfWeek: { date: { $toDate: '$indexedAt' }, timezone: tz } } : { $dayOfWeek: { $toDate: '$indexedAt' } },
          },
        },
        { $group: { _id: { dow: '$dow', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, dow: '$_id.dow', hour: '$_id.hour', count: 1 } },
      ])
      .toArray();

    const map = new Map<string, number>();
    for (const r of raw) map.set(`${r.dow}-${r.hour}`, r.count);

    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) out.push({ dow: d, hour: h, count: map.get(`${d}-${h}`) ?? 0 });

    return out;
  } catch (error) {
    console.error(`Error getting DOW×Hour heatmap for feed ${feedId}:`, error);
    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) out.push({ dow: d, hour: h, count: 0 });
    return out;
  }
}
