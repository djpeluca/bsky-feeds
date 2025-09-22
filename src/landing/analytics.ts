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
const REFRESH_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

// Feeds that should use GMT-3
const GMT3_FEEDS = ['uruguay', 'argentina', 'riodelaplata', 'brasil'];
const LOOKBACK_DAYS = 15;

// Background refresh state
let refreshInterval: NodeJS.Timeout | null = null;
let isWarmingCache = false;

export async function getFeedAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const nowMs = Date.now();
  const cacheKey = `${feedId}:${period}`;

  // Always return cached data if available (even if expired) to avoid dead times
  if (analyticsCache[cacheKey]) {
    // If cache is fresh, return it
    if (nowMs - analyticsCache[cacheKey].timestamp < CACHE_TTL_MS) {
      return analyticsCache[cacheKey].data;
    }
    // If cache is stale but exists, return it and trigger background refresh
    triggerBackgroundRefresh(feedId, period);
    return analyticsCache[cacheKey].data;
  }

  // If no cache exists, we need to compute it synchronously
  return await computeAndCacheAnalytics(feedId, period);
}

// Compute analytics and store in cache
async function computeAndCacheAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const nowMs = Date.now();
  const cacheKey = `${feedId}:${period}`;

  const db = dbClient.client?.db();
  if (!db) throw new Error('Database client not initialized');
  if (!algos[feedId]) throw new Error(`Feed ${feedId} not found`);

  const tzName = GMT3_FEEDS.includes(feedId) ? 'America/Montevideo' : 'UTC';

  // --- Define the period window ---
  const now = new Date();

  // Reset to local midnight in the proper timezone
  const todayMidnight = new Date(
    new Date().toLocaleString('en-US', { timeZone: tzName })
  );
  todayMidnight.setHours(0, 0, 0, 0);

  const periodStart = new Date(todayMidnight);
  switch (period) {
    case 'day':
      break;
    case 'week':
      periodStart.setDate(periodStart.getDate() - 6);
      break;
    case 'month':
      periodStart.setDate(periodStart.getDate() - 29);
      break;
    default:
      periodStart.setDate(periodStart.getDate() - 6);
  }

  const periodStartMs = periodStart.getTime();

  // --- Aggregate metrics ---
  const postCount = await getPostCountForFeed(db, feedId, periodStartMs, nowMs);
  const previousPeriodStart = new Date(periodStart);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - (period === 'month' ? 30 : 7));
  const previousPeriodStartMs = previousPeriodStart.getTime();
  const previousPostCount = await getPostCountForFeed(db, feedId, previousPeriodStartMs, periodStartMs);

  const uniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, periodStartMs, nowMs);
  const previousUniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, previousPeriodStartMs, periodStartMs);

  const daysInPeriod = getDaysInPeriod(periodStart, now);
  const daysInPreviousPeriod = getDaysInPeriod(previousPeriodStart, periodStart);

  const avgPostsPerDay = daysInPeriod > 0 ? postCount / daysInPeriod : 0;
  const previousAvgPostsPerDay = daysInPreviousPeriod > 0 ? previousPostCount / daysInPreviousPeriod : 0;

  const postCountTrend = postCount - previousPostCount;
  const uniqueAuthorsTrend = uniqueAuthors - previousUniqueAuthors;
  const avgPostsPerDayTrend = avgPostsPerDay - previousAvgPostsPerDay;

  // --- Time distribution (hourly, local TZ) ---
  const timeDistribution = await getTimeDistribution(db, feedId, periodStartMs, nowMs, tzName);

  // --- Daily quantity (per local day) ---
  const dailyQuantity = await getDailyQuantity(db, feedId, periodStart, tzName);

  // --- DOW × Hour heatmap (local TZ) ---
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

// Trigger background refresh for a specific feed
function triggerBackgroundRefresh(feedId: string, period: string) {
  // Don't trigger if already warming cache
  if (isWarmingCache) return;
  
  // Refresh in background without blocking
  setImmediate(async () => {
    try {
      await computeAndCacheAnalytics(feedId, period);
      console.log(`[Analytics] Background refresh completed for ${feedId}:${period}`);
    } catch (error) {
      console.error(`[Analytics] Background refresh failed for ${feedId}:${period}:`, error);
    }
  });
}

// Warm cache for all feeds and periods
export async function warmAnalyticsCache(): Promise<void> {
  if (isWarmingCache) {
    console.log('[Analytics] Cache warming already in progress');
    return;
  }
  
  isWarmingCache = true;
  console.log('[Analytics] Starting cache warming...');
  
  try {
    const feeds = getAvailableFeeds();
    const periods = ['day', 'week', 'month'];
    
    const promises: Promise<void>[] = [];
    for (const feed of feeds) {
      for (const period of periods) {
        promises.push(
          computeAndCacheAnalytics(feed.id, period)
            .then(() => console.log(`[Analytics] Cached ${feed.id}:${period}`))
            .catch(error => console.error(`[Analytics] Failed to cache ${feed.id}:${period}:`, error))
        );
      }
    }
    
    await Promise.allSettled(promises);
    console.log('[Analytics] Cache warming completed');
  } catch (error) {
    console.error('[Analytics] Cache warming failed:', error);
  } finally {
    isWarmingCache = false;
  }
}

// Start background refresh service
export function startAnalyticsRefreshService(): void {
  if (refreshInterval) {
    console.log('[Analytics] Refresh service already running');
    return;
  }
  
  console.log('[Analytics] Starting refresh service...');
  
  // Initial cache warming
  warmAnalyticsCache();
  
  // Set up hourly refresh
  refreshInterval = setInterval(() => {
    console.log('[Analytics] Starting scheduled cache refresh');
    warmAnalyticsCache();
  }, REFRESH_INTERVAL_MS);
  
  console.log('[Analytics] Refresh service started - will refresh every hour');
}

// Stop background refresh service
export function stopAnalyticsRefreshService(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[Analytics] Refresh service stopped');
  }
}

// --- Helper functions ---
function getDaysInPeriod(startDate: Date, endDate: Date): number {
  const diff = endDate.getTime() - startDate.getTime();
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
        {
          $addFields: {
            hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tzName } },
          },
        },
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
async function getDailyQuantity(db: any, feedId: string, startDate: Date, tzName: string) {
  try {
    const now = new Date();
    const startMs = startDate.getTime();
    
    // For regional feeds, add 24 hours to ensure we capture the full current day
    const endMs = GMT3_FEEDS.includes(feedId) 
      ? now.getTime() + (24 * 60 * 60 * 1000) // Add 24 hours
      : now.getTime();

    const result = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startMs, $lte: endMs } } },
        {
          $addFields: {
            day: { $dateToString: { date: { $toDate: '$indexedAt' }, timezone: tzName, format: '%Y-%m-%d' } },
          },
        },
        { $group: { _id: '$day', count: { $sum: 1 } } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
        { $sort: { day: 1 } },
      ])
      .toArray();

    // Build the array of days including today
    const days: string[] = [];
    const cursor = new Date(startDate);
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: tzName });
    while (true) {
      const dayStr = cursor.toLocaleDateString('en-CA', { timeZone: tzName });
      days.push(dayStr);
      if (dayStr === todayStr) break;
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

// DOW × Hour heatmap in local TZ
async function getDowHourHeatmap(db: any, feedId: string, lookbackDays: number, tzName: string) {
  try {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - lookbackDays + 1);
    start.setHours(0, 0, 0, 0);

    const startMs = start.getTime();
    const endMs = now.getTime();

    const raw = await db
      .collection('post')
      .aggregate([
        { $match: { algoTags: feedId, indexedAt: { $gte: startMs, $lte: endMs } } },
        {
          $addFields: {
            dow: { $dayOfWeek: { date: { $toDate: '$indexedAt' }, timezone: tzName } },
            hour: { $hour: { date: { $toDate: '$indexedAt' }, timezone: tzName } },
          },
        },
        { $group: { _id: { dow: '$dow', hour: '$hour' }, count: { $sum: 1 } } },
        { $project: { _id: 0, dow: '$_id.dow', hour: '$_id.hour', count: 1 } },
      ])
      .toArray();

    const grid: { dow: number; hour: number; count: number }[] = [];
    for (let d = 1; d <= 7; d++) {
      for (let h = 0; h < 24; h++) {
        const found = raw.find((r) => r.dow === d && r.hour === h);
        grid.push({ dow: d, hour: h, count: found ? found.count : 0 });
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
