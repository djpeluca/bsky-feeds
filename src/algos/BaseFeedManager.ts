// src/algos/BaseFeedManager.ts
import { AlgoManager } from '../addn/algoManager'
import { safeAddToSet } from '../util/safeAddToSet'
import dbClient from '../db/dbClient'
import getListMembers from '../addn/getListMembers'
import getPostsForUser from '../addn/getPostsForUser'
import dotenv from 'dotenv'

export abstract class BaseFeedManager extends AlgoManager {
  public abstract name: string
  public abstract author_collection: string
  protected abstract PATTERNS: RegExp[] // Provided by subclass
  protected abstract LISTS_ENV: string   // Provided by subclass

  protected authorSet: Set<string> = new Set()
  protected blockedSet: Set<string> = new Set()
  protected lastListUpdate = 0
  protected readonly LIST_UPDATE_INTERVAL = 1000 * 60 * 15
  protected compiledPatterns: RegExp[] = []
  protected patternCache: Map<string, boolean> = new Map()
  protected readonly CACHE_SIZE_LIMIT = 10000
  protected listCache: Map<string, { members: string[], timestamp: number }> = new Map()
  protected readonly LIST_CACHE_DURATION = 1000 * 60 * 5

  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL_MS = parseInt(process.env.FEED_POLL_INTERVAL_MS || '10000', 10); // 10 seconds default
  
  // Add monitoring properties
  private lastHealthCheck = Date.now()
  private lastPostCount = 0
  private consecutiveErrors = 0
  private readonly HEALTH_CHECK_INTERVAL = 1000 * 60 * 5 // 5 minutes

  public async start() {
    console.log(`[${this.name}] Starting feed manager...`)
    const startTime = Date.now()
    
    try {
      await this.compilePatterns()
      await this.updateLists()
      
      const duration = Date.now() - startTime
      console.log(`[${this.name}] Feed manager started successfully in ${duration}ms`)
    } catch (error) {
      console.error(`[${this.name}] Failed to start feed manager:`, error)
      throw error
    }
  }

  protected async compilePatterns() {
    if (this.compiledPatterns.length === 0) {
      this.compiledPatterns = this.PATTERNS
      console.log(`[${this.name}] Compiled ${this.compiledPatterns.length} patterns`)
    }
  }

  protected async getCachedListMembers(list: string): Promise<string[]> {
    const now = Date.now()
    const cached = this.listCache.get(list)
    if (cached && (now - cached.timestamp) < this.LIST_CACHE_DURATION) {
      return cached.members
    }
    try {
      console.log(`[${this.name}] Fetching fresh list members for: ${list}`)
      const members = await getListMembers(list, this.agent)
      this.listCache.set(list, { members, timestamp: now })
      console.log(`[${this.name}] List ${list} has ${members.length} members`)
      return members
    } catch (error) {
      console.error(`[${this.name}] Error fetching list members for ${list}:`, error)
      return cached?.members || []
    }
  }

  protected async updateLists() {
    const now = Date.now()
    if (now - this.lastListUpdate < this.LIST_UPDATE_INTERVAL) return

    console.log(`[${this.name}] Updating lists...`)
    const updateStartTime = Date.now()

    try {
      // Update author list
      const listsEnv = process.env[this.LISTS_ENV]
      if (listsEnv && listsEnv.trim() !== '') {
        const lists: string[] = listsEnv.split('|').filter(list => list.trim() !== '')
        if (lists.length > 0) {
          console.log(`[${this.name}] Processing ${lists.length} lists: ${lists.join(', ')}`)
          const listMembersPromises = lists.map(list => this.getCachedListMembers(list))
          const allMembers = await Promise.all(listMembersPromises)
          const oldSize = this.authorSet.size
          this.authorSet = new Set(allMembers.flat())
          console.log(`[${this.name}] Author set updated: ${oldSize} -> ${this.authorSet.size} members`)
        }
      } else {
        console.warn(`${this.name}: ${this.LISTS_ENV} environment variable not set or empty`)
        this.authorSet = new Set()
      }

      // Update blocked members
      if (process.env.BLOCKLIST && process.env.BLOCKLIST.trim() !== '') {
        const blockLists: string[] = process.env.BLOCKLIST.split('|').filter(list => list.trim() !== '')
        if (blockLists.length > 0) {
          const blockedMembersPromises = blockLists.map(list => this.getCachedListMembers(list))
          const allBlockedMembers = await Promise.all(blockedMembersPromises)
          const oldSize = this.blockedSet.size
          this.blockedSet = new Set(allBlockedMembers.flat())
          console.log(`[${this.name}] Blocked set updated: ${oldSize} -> ${this.blockedSet.size} members`)
        }
      } else {
        this.blockedSet = new Set()
      }

      this.lastListUpdate = now
      const updateDuration = Date.now() - updateStartTime
      console.log(`[${this.name}] Lists updated successfully in ${updateDuration}ms`)
    } catch (error) {
      console.error(`${this.name}: Error updating lists:`, error)
      this.consecutiveErrors++
    }
  }

  public async periodicTask() {
    const taskStartTime = Date.now()
    console.log(`[${this.name}] Starting periodic task at ${new Date().toISOString()}`)
    
    try {
      // Log current state before operations
      const currentPostCount = await this.getCurrentPostCount()
      console.log(`[${this.name}] Current post count: ${currentPostCount}`)
      
      // Remove old posts with detailed logging
      const oldPostRemovalStart = Date.now()
      const oldPostThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000
      console.log(`[${this.name}] Removing posts older than ${new Date(oldPostThreshold).toISOString()}`)
      
      await this.db.removeTagFromOldPosts(
        this.name,
        oldPostThreshold,
      )
      
      const oldPostRemovalDuration = Date.now() - oldPostRemovalStart
      console.log(`[${this.name}] Old post removal completed in ${oldPostRemovalDuration}ms`)

      await this.updateLists()

      try {
        const db_authors = await dbClient.getDistinctFromCollection(
          this.author_collection,
          'did',
        )
        const dbAuthorSet = new Set(db_authors)
        const new_authors = Array.from(this.authorSet).filter(member => !dbAuthorSet.has(member))
        const del_authors = db_authors.filter(member => !this.authorSet.has(member))

        console.log(`[${this.name}] Author sync: ${new_authors.length} new, ${del_authors.length} to delete`)

        if (del_authors.length > 0) {
          try {
            const deleteStart = Date.now()
            await this.db.deleteManyDID(this.author_collection, del_authors)
            const deleteDuration = Date.now() - deleteStart
            console.log(`[${this.name}] Deleted ${del_authors.length} authors in ${deleteDuration}ms`)
          } catch (error) {
            console.error(`${this.name}: Error deleting authors:`, error)
            this.consecutiveErrors++
          }
        }

        if (new_authors.length > 0) {
          const processStart = Date.now()
          await this.processNewAuthors(new_authors)
          const processDuration = Date.now() - processStart
          console.log(`[${this.name}] Processed ${new_authors.length} new authors in ${processDuration}ms`)
        }
      } catch (error) {
        console.error(`${this.name}: Error in periodic task database operations:`, error)
        this.consecutiveErrors++
      }

      if (this.patternCache.size > this.CACHE_SIZE_LIMIT) {
        const oldSize = this.patternCache.size
        this.patternCache.clear()
        console.log(`[${this.name}] Pattern cache cleared: ${oldSize} -> 0 entries`)
      }

      const now = Date.now()
      for (const [key, value] of this.listCache.entries()) {
        if (now - value.timestamp > this.LIST_CACHE_DURATION) {
          this.listCache.delete(key)
        }
      }

      // Health check and monitoring
      await this.performHealthCheck()
      
      const taskDuration = Date.now() - taskStartTime
      console.log(`[${this.name}] Periodic task completed successfully in ${taskDuration}ms`)
      this.consecutiveErrors = 0 // Reset on success
      
    } catch (error) {
      console.error(`${this.name}: Error in periodic task:`, error)
      this.consecutiveErrors++
      
      // Alert if we have consecutive errors
      if (this.consecutiveErrors >= 3) {
        console.error(`[${this.name}] WARNING: ${this.consecutiveErrors} consecutive errors in periodic task!`)
      }
    }
  }

  private async getCurrentPostCount(): Promise<number> {
    try {
      const posts = await dbClient.getCollection('post')
      return posts.filter(post => post.algoTags && post.algoTags.includes(this.name)).length
    } catch (error) {
      console.error(`[${this.name}] Error getting post count:`, error)
      return -1
    }
  }

  private async performHealthCheck() {
    const now = Date.now()
    if (now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) return
    
    try {
      const currentPostCount = await this.getCurrentPostCount()
      const timeSinceLastCheck = now - this.lastHealthCheck
      
      console.log(`[${this.name}] HEALTH CHECK: Posts: ${currentPostCount}, Time since last check: ${Math.round(timeSinceLastCheck / 1000)}s, Consecutive errors: ${this.consecutiveErrors}`)
      
      // Check for significant post count changes
      if (this.lastPostCount > 0 && currentPostCount > 0) {
        const change = currentPostCount - this.lastPostCount
        const changePercent = Math.abs(change) / this.lastPostCount * 100
        
        if (changePercent > 20) { // Alert if more than 20% change
          console.warn(`[${this.name}] ALERT: Post count changed by ${change} (${changePercent.toFixed(1)}%) in ${Math.round(timeSinceLastCheck / 1000)}s`)
        }
      }
      
      this.lastPostCount = currentPostCount
      this.lastHealthCheck = now
      
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error)
    }
  }

  protected async processNewAuthors(new_authors: string[]) {
    console.log(`[${this.name}] Processing ${new_authors.length} new authors...`)
    const BATCH_SIZE = parseInt(process.env.FEED_BATCH_SIZE || '50', 10)
    const batches: string[][] = []
    for (let i = 0; i < new_authors.length; i += BATCH_SIZE) {
      batches.push(new_authors.slice(i, i + BATCH_SIZE))
    }
    
    let totalProcessed = 0
    let totalPosts = 0
    
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`[${this.name}] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} authors)`)
      const batchStart = Date.now()
      
      const batchPromises = batch.map(async (author) => {
        try {
          const posts = await getPostsForUser(author, this.agent)
          const validPosts = await this.filterPostsBatch(posts)
          return { author, posts: validPosts }
        } catch (error) {
          console.error(`[${this.name}] Error processing author ${author}:`, error)
          return { author, posts: [] }
        }
      })
      const batchResults = await Promise.all(batchPromises)
      const authorBulkOps: any[] = []
      batchResults.forEach(({ author }) => {
        authorBulkOps.push({
          updateOne: {
            filter: { did: author },
            update: { $set: { did: author } },
            upsert: true,
          },
        })
      })
      if (authorBulkOps.length > 0) {
        try {
          await this.db.bulkWrite(this.author_collection, authorBulkOps)
        } catch (error) {
          console.error(`[${this.name}] Error updating authors in ${this.author_collection}:`, error)
        }
      }
      const allValidPosts = batchResults.flatMap(({ posts }) => posts)
      if (allValidPosts.length > 0) {
        try {
          await safeAddToSet(this.db, allValidPosts, this.name)
          totalPosts += allValidPosts.length
        } catch (err) {
          console.error(`[${this.name}] Error in safeAddToSet for posts:`, err)
        }
      }
      
      totalProcessed += batch.length
      const batchDuration = Date.now() - batchStart
      console.log(`[${this.name}] Batch ${batchIndex + 1} completed in ${batchDuration}ms: ${allValidPosts.length} posts from ${batch.length} authors`)
    }
    
    console.log(`[${this.name}] New author processing completed: ${totalPosts} posts from ${totalProcessed} authors`)
  }

  protected async filterPostsBatch(posts: any[]): Promise<any[]> {
    const validPosts: any[] = []
    for (const post of posts) {
      if (await this.filter_post(post)) {
        validPosts.push(post)
      }
    }
    return validPosts
  }

  public abstract filter_post(post: any): Promise<Boolean>

  public startPolling() {
    if (this.pollingInterval) return; // Prevent multiple intervals
    this.pollingInterval = setInterval(async () => {
      try {
        await this.processNewPosts();
      } catch (err) {
        console.error(`[${this.name}] Polling error:`, err);
        this.consecutiveErrors++
      }
    }, this.POLLING_INTERVAL_MS);
    console.log(`[${this.name}] Real-time polling started (interval: ${this.POLLING_INTERVAL_MS}ms)`);
  }

  public async processNewPosts() {
    const startTime = Date.now()
    try {
      // Example: fetch posts from the last minute
      const since = Date.now() - 60 * 1000;
      // You may need to adjust this to your DB schema and fetch logic
      const recentPosts = await dbClient.getRecentPosts(since); // Implement this in dbClient
      
      if (recentPosts.length > 0) {
        console.log(`[${this.name}] Processing ${recentPosts.length} recent posts from polling`)
        let processedCount = 0
        
        for (const post of recentPosts) {
          if (await this.filter_post(post)) {
            await safeAddToSet(this.db, [post], this.name);
            processedCount++
          }
        }
        
        const duration = Date.now() - startTime
        console.log(`[${this.name}] Polling processed ${processedCount}/${recentPosts.length} posts in ${duration}ms`)
      }
    } catch (error) {
      console.error(`[${this.name}] Error in processNewPosts:`, error)
      this.consecutiveErrors++
    }
  }
}
