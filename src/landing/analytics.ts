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
  const cacheKey = `${feedId}:${period}`;

  if (analyticsCache[cacheKey] && nowMs - analyticsCache[cacheKey].timestamp < CACHE_TTL_MS) {
    return analyticsCache[cacheKey].data;
  }

  const db = dbClient.client?.db();
  if (!db) throw new Error('Database client not initialized');
  if (!algos[feedId]) throw new Error(`Feed ${feedId} not found`);

  const tzOffsetHours = GMT3_FEEDS.includes(feedId) ? -3 : 0; // offset from UTC in hours
  const tzString = GMT3_FEEDS.includes(feedId) ? 'America/Montevideo' : 'UTC';

  const now = new Date();
  const periodStart = getPeriodStartDate(now, period);
  const previousPeriodStart = getPreviousPeriodStart(periodStart, period);

  // convert to UTC millis considering timezone offset
  const periodStartMs = periodStart.getTime() - tzOffsetHours * 3600 * 1000;
  const nowMsUtc = now.getTime() - tzOffsetHours * 3600 * 1000;
  const previousPeriodStartMs = previousPeriodStart.getTime() - tzOffsetHours * 3600 * 1000;

  const postCount = await getPostCountForFeed(db, feedId, periodStartMs, nowMsUtc);
  const previousPostCount = await getPostCountForFeed(db, feedId, previousPeriodStartMs, periodStartMs);

  const uniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, periodStartMs, nowMsUtc);
  const previousUniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, previousPeriodStartMs, periodStartMs);

  const daysInPeriod = getDaysInPeriod(periodStart, now);
  const daysInPreviousPeriod = getDaysInPeriod(previousPeriodStart, periodStart);

  const avgPostsPerDay = daysInPeriod > 0 ? postCount / daysInPeriod : 0;
  const previousAvgPostsPerDay = daysInPreviousPeriod > 0 ? previousPostCount / daysInPreviousPeriod : 0;

  const postCountTrend = postCount - previousPostCount;
  const uniqueAuthorsTrend = uniqueAuthors - previousUniqueAuthors;
  const avgPostsPerDayTrend = avgPostsPerDay - previousAvgPostsPerDay;

  const timeDistribution = await getTimeDistribution(db, feedId, periodStartMs, nowMsUtc, tzOffsetHours);
  const dailyQuantity = await getDailyQuantity(db, feedId, periodStart, now, tzOffsetHours);
  const dowHourHeatmap = await getDowHourHeatmap(db, feedId, periodStartMs, nowMsUtc, tzString);

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

  analyticsCache[cacheKey] = { timestamp: nowMs, data: analyticsData };
  return analyticsData;
}

// --- Helper functions ---

function getPeriodStartDate(date: Date, period: string): Date {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day':
      return localDate;
    case 'week':
      localDate.setDate(localDate.getDate() - 6);
      return localDate;
    case 'month':
      localDate.setDate(localDate.getDate() - 29);
      return localDate;
    default:
      localDate.setDate(localDate.getDate() - 6);
      return localDate;
  }
}

function getPreviousPeriodStart(currentPeriodStart: Date, period: string): Date {
  const prev = new Date(currentPeriodStart);
  switch (period) {
    case 'day':
      prev.setDate(prev.getDate() - 1);
      break;
    case 'week':
      prev.setDate(prev.getDate() - 7);
      break;
    case 'month':
      prev.setMonth(prev.getMonth() - 1);
      break;
    default:
      prev.setDate(prev.getDate() - 7);
  }
  return prev;
}

function getDaysInPeriod(startDate: Date, endDate: Date): number {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1; // include both start and end
}

export function getAvailableFeeds() {
  if (!algos) return [];
  return Object.keys(algos).map((id) => ({
    id,
    name: algos[id]?.handler?.name || id,
  }));
}

// --- Database queries (Mongo) ---

async function getPostCountForFeed(db: any, feedId: string, startDateMs: number, endDateMs: number): Promise<number> {
  try {
    return await db.collection('post').countDocuments({
      algoTags: feedId,
      indexedAt: { $gte: startDateMs, $lte: endDateMs },
    });
  } catch (error) {
    console.error(`Error getting post count for feed ${feedId}:`, error);
    return 0;
  }
}

async function getUniqueAuthorsForFeed(db: any, feedId: string, startDateMs: number, endDateMs: number): Promise<number> {
  try {
    const authors = await db.collection('post').distinct('author', {
      algoTags: feedId,
      indexedAt: { $gte: startDateMs, $lte: endDateMs },
    });
    return authors.length;
  } catch (error) {
    console.error(`Error getting unique authors for feed ${feedId}:`, error);
    return 0;
  }
}

async function getTimeDistribution(db: any, feedId: string, startDateMs: number, endDateMs: number, tzOffsetHours: number) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDateMs, $lte: endDateMs } } },
        {
          $addFields: {
            hour: {
              $mod: [
                { $add: [{ $hour: { date: { $toDate: '$indexedAt' } } }, tzOffsetHours] },
                24,
              ],
            },
          },
        },
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

async function getDailyQuantity(db: any, feedId: string, startDate: Date, endDate: Date, tzOffsetHours: number) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDate.getTime() - tzOffsetHours * 3600 * 1000, $lte: endDate.getTime() - tzOffsetHours * 3600 * 1000 } } },
        {
          $addFields: {
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: '$indexedAt' },
                timezone: 'UTC', // convert to adjusted UTC
              },
            },
          },
        },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
        { $sort: { day: 1 } },
      ])
      .toArray();

    const days: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dayStr = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
      days.push(dayStr);
      cursor.setDate(cursor.getDate() + 1);
    }

    return days.map((dayStr) => {
      const found = result.find((r) => r.day === dayStr);
      return { day: dayStr, count: found ? found.count : 0 };
    });
  } catch (error) {
    console.error(`Error getting daily quantity for feed ${feedId}:`, error);
    return [];
  }
}

async function getDowHourHeatmap(db: any, feedId: string, startDateMs: number, endDateMs: number, tz: string) {
  try {
    const raw = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startDateMs, $lte: endDateMs } } },
        {
          $addFields: {
            dow: { $dayOfWeek: { date: { $toDate: '$indexedAt' }, timezone: tz } },
            hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tz } },
          },
        },
        { $group: { _id: { dow: '$dow', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, dow: '$_id.dow', hour: '$_id.hour', count: 1 } },
      ])
      .toArray();

    const full: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) {
      for (let h = 0; h < 24; h++) {
        const found = raw.find((r) => r.dow === d && r.hour === h);
        full.push({ dow: d, hour: h, count: found ? found.count : 0 });
      }
    }
    return full;
  } catch (error) {
    console.error(`Error getting DOW×Hour heatmap for feed ${feedId}:`, error);
    const out: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) for (let h = 0; h < 24; h++) out.push({ dow: d, hour: h, count: 0 });
    return out;
  }
}
