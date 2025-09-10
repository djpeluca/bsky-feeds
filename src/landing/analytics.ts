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
const LOOKBACK_DAYS = 15;

// --- Helpers for timezone boundaries ---
function getStartOfDayUTC(date: Date, tz: string): Date {
  const [year, month, day] = date.toLocaleDateString('en-CA', { timeZone: tz })
    .split('-')
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function getEndOfDayUTC(date: Date, tz: string): Date {
  const [year, month, day] = date.toLocaleDateString('en-CA', { timeZone: tz })
    .split('-')
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export async function getFeedAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const nowMs = Date.now();
  const cacheKey = `${feedId}:${period}`;

  if (analyticsCache[cacheKey] && nowMs - analyticsCache[cacheKey].timestamp < CACHE_TTL_MS) {
    return analyticsCache[cacheKey].data;
  }

  const db = dbClient.client?.db();
  if (!db) throw new Error('Database client not initialized');
  if (!algos[feedId]) throw new Error(`Feed ${feedId} not found`);

  const tzName = GMT3_FEEDS.includes(feedId) ? 'America/Montevideo' : 'UTC';
  const now = new Date();

  // --- Define period boundaries in feed timezone ---
  let periodStart = getStartOfDayUTC(now, tzName);
  switch (period) {
    case 'day':
      break;
    case 'week':
      periodStart.setUTCDate(periodStart.getUTCDate() - 6);
      break;
    case 'month':
      periodStart.setUTCDate(periodStart.getUTCDate() - 29);
      break;
    default:
      periodStart.setUTCDate(periodStart.getUTCDate() - 6);
  }

  const periodEnd = getEndOfDayUTC(now, tzName);
  const periodStartMs = periodStart.getTime();
  const periodEndMs = periodEnd.getTime();

  // --- Previous period boundaries ---
  const previousPeriodStart = new Date(periodStart);
  previousPeriodStart.setUTCDate(previousPeriodStart.getUTCDate() - (period === 'month' ? 30 : 7));
  const previousPeriodStartMs = previousPeriodStart.getTime();
  const previousPeriodEndMs = periodStartMs - 1;

  // --- Aggregate metrics ---
  const postCount = await getPostCountForFeed(db, feedId, periodStartMs, periodEndMs);
  const previousPostCount = await getPostCountForFeed(db, feedId, previousPeriodStartMs, previousPeriodEndMs);

  const uniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, periodStartMs, periodEndMs);
  const previousUniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, previousPeriodStartMs, previousPeriodEndMs);

  const daysInPeriod = getDaysInPeriod(periodStart, periodEnd);
  const daysInPreviousPeriod = getDaysInPeriod(previousPeriodStart, previousPeriodEndMs);

  const avgPostsPerDay = daysInPeriod > 0 ? postCount / daysInPeriod : 0;
  const previousAvgPostsPerDay = daysInPreviousPeriod > 0 ? previousPostCount / daysInPreviousPeriod : 0;

  const postCountTrend = postCount - previousPostCount;
  const uniqueAuthorsTrend = uniqueAuthors - previousUniqueAuthors;
  const avgPostsPerDayTrend = avgPostsPerDay - previousAvgPostsPerDay;

  // --- Time distribution (hourly, local TZ) ---
  const timeDistribution = await getTimeDistribution(db, feedId, periodStartMs, periodEndMs, tzName);

  // --- Daily quantity (per local day) ---
  const dailyQuantity = await getDailyQuantity(db, feedId, periodStart, now, tzName);

  // --- DOW × Hour heatmap (average per DOW computed in MongoDB) ---
  const dowHourHeatmap = await getDowHourHeatmap(db, feedId, LOOKBACK_DAYS, tzName);

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
function getDaysInPeriod(startDate: Date, endDate: Date | number): number {
  const diff = (typeof endDate === 'number' ? endDate : endDate.getTime()) - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export function getAvailableFeeds() {
  if (!algos) return [];
  return Object.keys(algos).map((id) => ({
    id,
    name: algos[id]?.handler?.name || id,
  }));
}

// --- Database queries ---
async function getPostCountForFeed(db: any, feedId: string, startDateMs: number, endDateMs: number): Promise<number> {
  try {
    return await db.collection('post').countDocuments({
      algoTags: feedId,
      indexedAt: { $gte: startDateMs, $lte: endDateMs },
    });
  } catch (err) {
    console.error(err);
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
  } catch (err) {
    console.error(err);
    return 0;
  }
}

// Hourly distribution in local TZ
async function getTimeDistribution(db: any, feedId: string, startMs: number, endMs: number, tzName: string) {
  try {
    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startMs, $lte: endMs } } },
        { $addFields: { hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tzName } } } },
        { $group: { _id: '$hour', count: { $sum: 1 } } },
        { $project: { _id: 0, hour: '$_id', count: 1 } },
        { $sort: { hour: 1 } },
      ])
      .toArray();

    return Array.from({ length: 24 }, (_, hour) => {
      const found = result.find((r: any) => r.hour === hour);
      return { hour, count: found ? found.count : 0 };
    });
  } catch (err) {
    console.error(err);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  }
}

// Daily distribution in local TZ
async function getDailyQuantity(db: any, feedId: string, startDate: Date, endDate: Date, tzName: string) {
  try {
    const startMs = startDate.getTime();
    const endDateFull = new Date(endDate);
    endDateFull.setHours(23, 59, 59, 999);
    const endMs = endDateFull.getTime();

    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startMs, $lte: endMs } } },
        { $addFields: { day: { $dateToString: { date: { $toDate: '$indexedAt' }, timezone: tzName, format: '%Y-%m-%d' } } } },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
        { $sort: { day: 1 } },
      ])
      .toArray();

    const days: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDateFull) {
      const dayStr = cursor.toLocaleDateString('en-CA', { timeZone: tzName });
      days.push(dayStr);
      cursor.setDate(cursor.getDate() + 1);
    }

    return days.map((dayStr) => {
      const found = result.find((r) => r.day === dayStr);
      return { day: dayStr, count: found ? found.count : 0 };
    });
  } catch (err) {
    console.error(err);
    return [];
  }
}

// DOW × Hour heatmap (average computed in MongoDB)
async function getDowHourHeatmap(db: any, feedId: string, lookbackDays: number, tzName: string) {
  try {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - lookbackDays + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const startMs = start.getTime();
    const endMs = end.getTime();

    // MongoDB pipeline: count posts per DOW+hour, divide by number of days per DOW
    const daysPerDOW = await db
      .collection('post')
      .aggregate([
        { $match: { indexedAt: { $gte: startMs, $lte: endMs } } },
        {
          $addFields: {
            dow: { $dayOfWeek: { date: { $toDate: '$indexedAt' }, timezone: tzName } },
          },
        },
        { $group: { _id: '$dow', days: { $addToSet: { $dateToString: { date: { $toDate: '$indexedAt' }, timezone: tzName, format: '%Y-%m-%d' } } } } },
        { $project: { dow: '$_id', numDays: { $size: '$days' } } },
      ])
      .toArray();

    const dowDaysMap: Record<number, number> = {};
    for (let d = 1; d <= 7; d++) dowDaysMap[d] = 0;
    daysPerDOW.forEach((r: any) => (dowDaysMap[r.dow] = r.numDays));

    const raw = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startMs, $lte: endMs } } },
        { $addFields: {
            dow: { $dayOfWeek: { date: { $toDate: '$indexedAt' }, timezone: tzName } },
            hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tzName } },
          } },
        { $group: { _id: { dow: '$dow', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, dow: '$_id.dow', hour: '$_id.hour', count: 1 } },
      ])
      .toArray();

    const grid: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) {
      for (let h = 0; h < 24; h++) {
        const found = raw.find((r) => r.dow === d && r.hour === h);
        const avg = dowDaysMap[d] > 0 ? (found ? found.count / dowDaysMap[d] : 0) : 0;
        grid.push({ dow: d, hour: h, count: avg });
      }
    }

    return grid;
  } catch (err) {
    console.error(err);
    const empty: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) {
      for (let h = 0; h < 24; h++) {
        empty.push({ dow: d, hour: h, count: 0 });
      }
    }
    return empty;
  }
}
