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
  protected readonly LIST_UPDATE_INTERVAL = 1000 * 60 * 5 // Reduced from 15 to 5 minutes for more frequent updates
  protected compiledPatterns: RegExp[] = []
  protected patternCache: Map<string, boolean> = new Map()
  protected readonly CACHE_SIZE_LIMIT = 10000
  protected listCache: Map<string, { members: string[], timestamp: number }> = new Map()
  protected readonly LIST_CACHE_DURATION = 1000 * 60 * 2 // Reduced from 5 to 2 minutes

  public async start() {
    console.log(`[${this.name}] Starting BaseFeedManager with ${this.LIST_UPDATE_INTERVAL/60000}min list update interval`)
    await this.compilePatterns()
    await this.updateLists()
  }

  protected async compilePatterns() {
    if (this.compiledPatterns.length === 0) {
      this.compiledPatterns = this.PATTERNS
    }
  }

  protected async getCachedListMembers(list: string): Promise<string[]> {
    const now = Date.now()
    const cached = this.listCache.get(list)
    if (cached && (now - cached.timestamp) < this.LIST_CACHE_DURATION) {
      return cached.members
    }
    try {
      const fetchStart = Date.now()
      const members = await getListMembers(list, this.agent)
      const fetchDuration = Date.now() - fetchStart
      
      if (fetchDuration > 5000) {
        console.warn(`[${this.name}] Slow list fetch for ${list}: ${fetchDuration}ms`)
      }
      
      this.listCache.set(list, { members, timestamp: now })
      console.log(`[${this.name}] Fetched ${members.length} members from list ${list} in ${fetchDuration}ms`)
      return members
    } catch (error) {
      console.error(`[${this.name}] Error fetching list members for ${list}:`, error.message)
      return cached?.members || []
    }
  }

  protected async updateLists() {
    const now = Date.now()
    const timeSinceLastUpdate = now - this.lastListUpdate
    
    if (timeSinceLastUpdate < this.LIST_UPDATE_INTERVAL) {
      const timeUntilNext = this.LIST_UPDATE_INTERVAL - timeSinceLastUpdate
      console.log(`[${this.name}] List update skipped, next update in ${Math.round(timeUntilNext/60000)}min`)
      return
    }

    const updateStart = Date.now()
    console.log(`[${this.name}] Starting list update at ${new Date().toISOString()}`)

    try {
      // Update author list
      const listsEnv = process.env[this.LISTS_ENV]
      if (listsEnv && listsEnv.trim() !== '') {
        const lists: string[] = listsEnv.split('|').filter(list => list.trim() !== '')
        if (lists.length > 0) {
          console.log(`[${this.name}] Updating ${lists.length} author lists`)
          const listMembersPromises = lists.map(list => this.getCachedListMembers(list))
          const allMembers = await Promise.all(listMembersPromises)
          const previousSize = this.authorSet.size
          this.authorSet = new Set(allMembers.flat())
          console.log(`[${this.name}] Author set updated: ${previousSize} -> ${this.authorSet.size} members`)
        }
      } else {
        console.warn(`[${this.name}] ${this.LISTS_ENV} environment variable not set or empty`)
        this.authorSet = new Set()
      }

      // Update blocked members
      if (process.env.BLOCKLIST && process.env.BLOCKLIST.trim() !== '') {
        const blockLists: string[] = process.env.BLOCKLIST.split('|').filter(list => list.trim() !== '')
        if (blockLists.length > 0) {
          console.log(`[${this.name}] Updating ${blockLists.length} block lists`)
          const blockedMembersPromises = blockLists.map(list => this.getCachedListMembers(list))
          const allBlockedMembers = await Promise.all(blockedMembersPromises)
          const previousBlockedSize = this.blockedSet.size
          this.blockedSet = new Set(allBlockedMembers.flat())
          console.log(`[${this.name}] Blocked set updated: ${previousBlockedSize} -> ${this.blockedSet.size} members`)
        }
      } else {
        this.blockedSet = new Set()
      }

      this.lastListUpdate = now
      const updateDuration = Date.now() - updateStart
      console.log(`[${this.name}] List update completed in ${updateDuration}ms`)
    } catch (error) {
      const updateDuration = Date.now() - updateStart
      console.error(`[${this.name}] List update failed after ${updateDuration}ms:`, error.message)
    }
  }

  public async periodicTask() {
    dotenv.config()
    try {
      await this.db.removeTagFromOldPosts(
        this.name,
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      )
    } catch (error) {
      console.error(`${this.name}: Error removing old posts:`, error)
    }

    await this.updateLists()

    try {
      const db_authors = await dbClient.getDistinctFromCollection(
        this.author_collection,
        'did',
      )
      const dbAuthorSet = new Set(db_authors)
      const new_authors = Array.from(this.authorSet).filter(member => !dbAuthorSet.has(member))
      const del_authors = db_authors.filter(member => !this.authorSet.has(member))

      if (del_authors.length > 0) {
        try {
          await this.db.deleteManyDID(this.author_collection, del_authors)
        } catch (error) {
          console.error(`${this.name}: Error deleting authors:`, error)
        }
      }

      if (new_authors.length > 0) {
        await this.processNewAuthors(new_authors)
      }
    } catch (error) {
      console.error(`${this.name}: Error in periodic task database operations:`, error)
    }

    if (this.patternCache.size > this.CACHE_SIZE_LIMIT) {
      this.patternCache.clear()
    }

    const now = Date.now()
    for (const [key, value] of this.listCache.entries()) {
      if (now - value.timestamp > this.LIST_CACHE_DURATION) {
        this.listCache.delete(key)
      }
    }
  }

  protected async processNewAuthors(new_authors: string[]) {
    const BATCH_SIZE = parseInt(process.env.FEED_BATCH_SIZE || '50', 10)
    const batches: string[][] = []
    for (let i = 0; i < new_authors.length; i += BATCH_SIZE) {
      batches.push(new_authors.slice(i, i + BATCH_SIZE))
    }
    for (const batch of batches) {
      const batchPromises = batch.map(async (author) => {
        try {
          const posts = await getPostsForUser(author, this.agent)
          const validPosts = await this.filterPostsBatch(posts)
          return { author, posts: validPosts }
        } catch (error) {
          console.error(`Error processing author ${author}:`, error)
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
          console.error(`Error updating authors in ${this.author_collection}:`, error)
        }
      }
      const allValidPosts = batchResults.flatMap(({ posts }) => posts)
      if (allValidPosts.length > 0) {
        try {
          await safeAddToSet(this.db, allValidPosts, this.name)
        } catch (err) {
          console.error('Error in safeAddToSet for posts:', err)
        }
      }
    }
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
}
