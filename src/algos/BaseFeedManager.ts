// src/algos/BaseFeedManager.ts
import { AlgoManager } from '../addn/algoManager'
import { safeAddToSet } from '../util/safeAddToSet'
import dbClient from '../db/dbClient'
import getListMembers from '../addn/getListMembers'
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

  constructor(db: any, agent: any) {
    super(db, agent)
  }

  public async start() {
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
      const members = await getListMembers(list, this.agent)
      this.listCache.set(list, { members, timestamp: now })
      return members
    } catch (error) {
      console.error(`Error fetching list members for ${list}:`, error)
      return cached?.members || []
    }
  }

  protected async updateLists() {
    const now = Date.now()
    if (now - this.lastListUpdate < this.LIST_UPDATE_INTERVAL) return

    try {
      // Update author list
      const listsEnv = process.env[this.LISTS_ENV]
      if (listsEnv && listsEnv.trim() !== '') {
        const lists: string[] = listsEnv.split('|').filter(list => list.trim() !== '')
        if (lists.length > 0) {
          const listMembersPromises = lists.map(list => this.getCachedListMembers(list))
          const allMembers = await Promise.all(listMembersPromises)
          this.authorSet = new Set(allMembers.flat())
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
          this.blockedSet = new Set(allBlockedMembers.flat())
        }
      } else {
        this.blockedSet = new Set()
      }

      this.lastListUpdate = now
    } catch (error) {
      console.error(`${this.name}: Error updating lists:`, error)
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
    console.log(`[${this.name}] Processing ${new_authors.length} new authors`)
    
    const BATCH_SIZE = parseInt(process.env.FEED_BATCH_SIZE || '50', 10)
    const batches: string[][] = []
    for (let i = 0; i < new_authors.length; i += BATCH_SIZE) {
      batches.push(new_authors.slice(i, i + BATCH_SIZE))
    }
    
    for (const batch of batches) {
      const authorBulkOps: any[] = []
      
      batch.forEach((author) => {
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
    }
    
    console.log(`[${this.name}] Added ${new_authors.length} new authors to tracking list`)
    console.log(`[${this.name}] Posts will be added from firehose subscription as they are created`)
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
