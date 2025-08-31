import { Agent } from '@atproto/api'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import limit from './rateLimit'
import crypto from 'crypto'

interface UserPostCache {
  [userId: string]: {
    posts: Post[]
    lastFetch: number
    lastCursor?: string
  }
}

interface FeedPostMapping {
  [feedName: string]: Set<string> // Set of post URIs that belong to this feed
}

export class CentralizedPostManager {
  private userPostCache: UserPostCache = {}
  private feedPostMapping: FeedPostMapping = {}
  private readonly CACHE_DURATION = 1000 * 60 * 30 // 30 minutes
  private readonly BATCH_SIZE = 50
  private isProcessing = false
  private processingQueue: string[] = []
  
  constructor(private agent: Agent) {}

  /**
   * Get posts for a user, using cache if available
   */
  async getPostsForUser(userId: string, forceRefresh = false): Promise<Post[]> {
    const now = Date.now()
    const cached = this.userPostCache[userId]
    
    // Return cached posts if still valid
    if (!forceRefresh && cached && (now - cached.lastFetch) < this.CACHE_DURATION) {
      console.log(`[CentralizedPostManager] Using cached posts for ${userId} (${cached.posts.length} posts)`)
      return cached.posts
    }

    // Add to processing queue if not already processing
    if (!this.isProcessing) {
      this.isProcessing = true
      this.processQueue()
    }

    if (!this.processingQueue.includes(userId)) {
      this.processingQueue.push(userId)
    }

    // Return cached posts if available, even if expired
    if (cached) {
      return cached.posts
    }

    // Return empty array if no cached data
    return []
  }

  /**
   * Process the queue of users to fetch posts for
   */
  private async processQueue() {
    while (this.processingQueue.length > 0) {
      const userId = this.processingQueue.shift()!
      try {
        await this.fetchUserPosts(userId)
      } catch (error) {
        console.error(`[CentralizedPostManager] Error fetching posts for ${userId}:`, error)
      }
    }
    this.isProcessing = false
  }

  /**
   * Fetch posts for a specific user from Bluesky API
   */
  private async fetchUserPosts(userId: string): Promise<void> {
    console.log(`[CentralizedPostManager] Fetching posts for ${userId}`)
    
    const posts: Post[] = []
    let cursor: string | undefined
    let totalFetched = 0

    try {
      do {
        const authorFeed = await limit(() =>
          this.agent.api.app.bsky.feed.getAuthorFeed({
            actor: userId,
            limit: this.BATCH_SIZE,
            cursor,
          })
        )

        const authorPosts = authorFeed.data.feed
        totalFetched += authorPosts.length

        for (const postCreate of authorPosts) {
          if (!postCreate.post?.uri) continue

          const post: Post = {
            _id: null,
            uri: postCreate.post.uri,
            cid: postCreate.post.cid,
            author: userId,
            text: postCreate.post.record['text'] || '',
            replyParent: (postCreate.reply?.parent?.uri as string) || null,
            replyRoot: (postCreate.reply?.root?.uri as string) || null,
            indexedAt: new Date(postCreate.post.indexedAt).getTime(),
            algoTags: null,
          }

          const hash = crypto
            .createHash('shake256', { outputLength: 12 })
            .update(post.uri)
            .digest('hex')
            .toString()
          
          post._id = hash
          posts.push(post)
        }

        cursor = authorFeed.data.cursor
      } while (cursor && posts.length < 1000) // Limit to prevent infinite loops

      // Update cache
      this.userPostCache[userId] = {
        posts,
        lastFetch: Date.now(),
        lastCursor: cursor
      }

      console.log(`[CentralizedPostManager] Fetched ${posts.length} posts for ${userId} (total API calls: ${Math.ceil(totalFetched / this.BATCH_SIZE)})`)

    } catch (error) {
      console.error(`[CentralizedPostManager] Failed to fetch posts for ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get all unique users from all feed managers
   */
  async getAllUsersFromFeeds(): Promise<Set<string>> {
    const allUsers = new Set<string>()
    
    // Get users from environment variables
    const envVars = [
      'URUGUAY_LISTS',
      'ARGENTINA_LISTS', 
      'RIODELAPLATA_LISTS',
      'BRASIL_LISTS',
      'SALESFORCE_LISTS',
      'AI_LISTS',
      'FEDIVERSE_LISTS',
      'PENIAROL_LISTS'
    ]

    for (const envVar of envVars) {
      const lists = process.env[envVar]
      if (lists && lists.trim() !== '') {
        const listArray = lists.split('|').filter(list => list.trim() !== '')
        for (const list of listArray) {
          try {
            // This would need to be implemented to get list members
            // For now, we'll assume the lists are already processed
            console.log(`[CentralizedPostManager] Found list: ${list} for ${envVar}`)
          } catch (error) {
            console.error(`[CentralizedPostManager] Error processing list ${list}:`, error)
          }
        }
      }
    }

    return allUsers
  }

  /**
   * Pre-fetch posts for all users to populate cache
   */
  async preFetchAllUsers(): Promise<void> {
    console.log(`[CentralizedPostManager] Starting pre-fetch for all users`)
    
    const users = await this.getAllUsersFromFeeds()
    const userArray = Array.from(users)
    
    console.log(`[CentralizedPostManager] Found ${userArray.length} unique users to pre-fetch`)
    
    // Process users in batches to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < userArray.length; i += batchSize) {
      const batch = userArray.slice(i, i + batchSize)
      console.log(`[CentralizedPostManager] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userArray.length / batchSize)}`)
      
      const batchPromises = batch.map(userId => this.getPostsForUser(userId))
      await Promise.all(batchPromises)
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < userArray.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    console.log(`[CentralizedPostManager] Pre-fetch completed for ${userArray.length} users`)
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const userCount = Object.keys(this.userPostCache).length
    const totalPosts = Object.values(this.userPostCache).reduce((sum, cache) => sum + cache.posts.length, 0)
    const oldestCache = Math.min(...Object.values(this.userPostCache).map(cache => cache.lastFetch))
    const cacheAge = oldestCache ? Date.now() - oldestCache : 0
    
    return {
      userCount,
      totalPosts,
      cacheAgeMinutes: Math.round(cacheAge / (1000 * 60)),
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing
    }
  }

  /**
   * Clear cache for a specific user or all users
   */
  clearCache(userId?: string) {
    if (userId) {
      delete this.userPostCache[userId]
      console.log(`[CentralizedPostManager] Cleared cache for ${userId}`)
    } else {
      this.userPostCache = {}
      console.log(`[CentralizedPostManager] Cleared all caches`)
    }
  }
}

export default CentralizedPostManager
