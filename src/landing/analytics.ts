import { dbSingleton } from '../db/dbClient';
import { getAlgos } from '../algos';

// Interface for feed analytics data
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
}

/**
 * Get analytics for a specific feed
 * @param feedId The ID of the feed to get analytics for
 * @param period The time period for analytics (day, week, month)
 * @returns Promise with feed analytics data
 */
export async function getFeedAnalytics(feedId: string, period: string = 'week'): Promise<FeedAnalytics> {
  const db = await dbSingleton.getClient();
  const algos = getAlgos();
  
  // Validate feed exists
  if (!algos[feedId]) {
    throw new Error(`Feed ${feedId} not found`);
  }
  
  // Calculate date ranges based on period
  const now = new Date();
  const periodStart = getPeriodStartDate(now, period);
  const previousPeriodStart = getPeriodStartDate(periodStart, period);
  
  // Get post count for current period
  const postCount = await getPostCountForFeed(db, feedId, periodStart, now);
  
  // Get post count for previous period (for trend calculation)
  const previousPostCount = await getPostCountForFeed(db, feedId, previousPeriodStart, periodStart);
  
  // Get unique authors for current period
  const uniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, periodStart, now);
  
  // Get unique authors for previous period
  const previousUniqueAuthors = await getUniqueAuthorsForFeed(db, feedId, previousPeriodStart, periodStart);
  
  // Calculate days in period for average posts per day
  const daysInPeriod = getDaysInPeriod(periodStart, now);
  const daysInPreviousPeriod = getDaysInPeriod(previousPeriodStart, periodStart);
  
  // Calculate average posts per day
  const avgPostsPerDay = daysInPeriod > 0 ? postCount / daysInPeriod : 0;
  const previousAvgPostsPerDay = daysInPreviousPeriod > 0 ? previousPostCount / daysInPreviousPeriod : 0;
  
  // Calculate trends (percentage change)
  const postCountTrend = calculateTrend(postCount, previousPostCount);
  const uniqueAuthorsTrend = calculateTrend(uniqueAuthors, previousUniqueAuthors);
  const avgPostsPerDayTrend = calculateTrend(avgPostsPerDay, previousAvgPostsPerDay);
  
  // Get time distribution (posts by hour of day)
  const timeDistribution = await getTimeDistribution(db, feedId, periodStart, now);
  
  // Get weekly quantity
  const weeklyQuantity = await getWeeklyQuantity(db, feedId, getWeeksAgo(now, 12), now);
  
  return {
    feedId,
    postCount,
    uniqueAuthors,
    avgPostsPerDay,
    postCountTrend,
    uniqueAuthorsTrend,
    avgPostsPerDayTrend,
    timeDistribution,
    weeklyQuantity
  };
}

/**
 * Get a list of all available feeds with their names
 * @returns Array of feed objects with id and name
 */
export function getAvailableFeeds() {
  const algos = getAlgos();
  return Object.keys(algos).map(id => ({
    id,
    name: algos[id].handler.description || id
  }));
}

/**
 * Get the start date for a given period
 * @param date The reference date
 * @param period The period type (day, week, month)
 * @returns Date object for the start of the period
 */
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
      result.setDate(result.getDate() - 7); // Default to week
  }
  
  return result;
}

/**
 * Get the number of days between two dates
 * @param startDate The start date
 * @param endDate The end date
 * @returns Number of days between the dates
 */
function getDaysInPeriod(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate percentage change between current and previous values
 * @param current Current value
 * @param previous Previous value
 * @returns Percentage change
 */
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get date for N weeks ago
 * @param date Reference date
 * @param weeks Number of weeks to go back
 * @returns Date object for N weeks ago
 */
function getWeeksAgo(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - (weeks * 7));
  return result;
}

/**
 * Get post count for a feed within a date range
 * @param db Database client
 * @param feedId Feed ID
 * @param startDate Start date
 * @param endDate End date
 * @returns Promise with post count
 */
async function getPostCountForFeed(db: any, feedId: string, startDate: Date, endDate: Date): Promise<number> {
  try {
    const collection = db.collection('post');
    
    // Query posts with the feed's algoTag within the date range
    const count = await collection.countDocuments({
      algoTags: feedId,
      indexedAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() }
    });
    
    return count;
  } catch (error) {
    console.error(`Error getting post count for feed ${feedId}:`, error);
    return 0;
  }
}

/**
 * Get unique authors count for a feed within a date range
 * @param db Database client
 * @param feedId Feed ID
 * @param startDate Start date
 * @param endDate End date
 * @returns Promise with unique authors count
 */
async function getUniqueAuthorsForFeed(db: any, feedId: string, startDate: Date, endDate: Date): Promise<number> {
  try {
    const collection = db.collection('post');
    
    // Get distinct authors for posts with the feed's algoTag within the date range
    const authors = await collection.distinct('author', {
      algoTags: feedId,
      indexedAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() }
    });
    
    return authors.length;
  } catch (error) {
    console.error(`Error getting unique authors for feed ${feedId}:`, error);
    return 0;
  }
}

/**
 * Get post distribution by hour of day
 * @param db Database client
 * @param feedId Feed ID
 * @param startDate Start date
 * @param endDate End date
 * @returns Promise with hour distribution data
 */
async function getTimeDistribution(db: any, feedId: string, startDate: Date, endDate: Date): Promise<{ hour: number; count: number }[]> {
  try {
    const collection = db.collection('post');
    
    // Aggregate posts by hour of day
    const result = await collection.aggregate([
      {
        $match: {
          algoTags: feedId,
          indexedAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() }
        }
      },
      {
        $addFields: {
          hour: { $hour: { $toDate: "$indexedAt" } }
        }
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          hour: "$_id",
          count: 1
        }
      },
      {
        $sort: { hour: 1 }
      }
    ]).toArray();
    
    // Ensure all hours are represented (0-23)
    const hourDistribution = Array.from({ length: 24 }, (_, hour) => {
      const found = result.find(item => item.hour === hour);
      return { hour, count: found ? found.count : 0 };
    });
    
    return hourDistribution;
  } catch (error) {
    console.error(`Error getting time distribution for feed ${feedId}:`, error);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  }
}

/**
 * Get weekly post quantities
 * @param db Database client
 * @param feedId Feed ID
 * @param startDate Start date
 * @param endDate End date
 * @returns Promise with weekly quantity data
 */
async function getWeeklyQuantity(db: any, feedId: string, startDate: Date, endDate: Date): Promise<{ week: string; count: number }[]> {
  try {
    const collection = db.collection('post');
    
    // Aggregate posts by week
    const result = await collection.aggregate([
      {
        $match: {
          algoTags: feedId,
          indexedAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() }
        }
      },
      {
        $addFields: {
          week: {
            $dateToString: {
              format: "%Y-%U",
              date: { $toDate: "$indexedAt" }
            }
          }
        }
      },
      {
        $group: {
          _id: "$week",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          week: "$_id",
          count: 1
        }
      },
      {
        $sort: { week: 1 }
      }
    ]).toArray();
    
    return result;
  } catch (error) {
    console.error(`Error getting weekly quantity for feed ${feedId}:`, error);
    return [];
  }
}