import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import setListMembers from '../addn/setListMembers'
import getPostsForUser from '../addn/getPostsForUser'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'
import { AppBskyGraphDefs } from '@atproto/api'
import getUserLists from '../addn/getUserLists'

dotenv.config()

// max 15 chars
export const shortname = 'uruguay'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })

  let feed = builder.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = builder.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}

export class manager extends AlgoManager {
  public name: string = shortname
  private authorSet: Set<string> = new Set()
  private blockedSet: Set<string> = new Set()
  public author_collection = 'list_members'
  
  // Cache for performance
  private lastListUpdate = 0
  private readonly LIST_UPDATE_INTERVAL = 1000 * 60 * 15 // 15 minutes
  private compiledPatterns: RegExp[] = []
  private patternCache: Map<string, boolean> = new Map()
  private readonly CACHE_SIZE_LIMIT = 10000
  private listCache: Map<string, { members: string[], timestamp: number }> = new Map()
  private readonly LIST_CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

  // Pre-compile all patterns for better performance
  private readonly PATTERNS = [
    // Main Uruguay pattern - optimized with word boundaries
    /\b(?!uruguaiana\b)(?:urugua|montevid|charrua|tacuaremb[oó]|paysand[ú]|semana de turismo|semana de la cerveza|daym[áa]n|guaviyú|arapey|🇺🇾|punta del este|yorugua|U R U G U A Y|Jose Mujica|Jos[eé] Mujica|Pepe Mujica|Carolina Cosse|Yamand[uú] Orsi|[aá]lvaro Delgado|Blanca Rodr[ií]guez|Valeria Ripoll|Lacalle Pou|Batllismo|Willsonismo|Herrerismo|Batllista|Willsonista|herrerista|peñarol|Parque Rod[oó])\b/i,
    
    // Location patterns - simplified word boundaries
    /\b(?:Colonia del Sacramento|Cabo Polonio|Piri[aá]polis|Valizas|Aguas Dulces|Laguna Garz[oó]n|Mercado del Puerto|Cerro San Antonio|Termas del Daym[aá]n|Salto Grande|Pocitos|Punta Carretas|Malv[ií]n|Villa Española|Bañados de Carrasco|Casab[oó]|Paso de la Arena|Jacinto Vera|Villa Dolores|Las Acacias|Nuevo Par[ií]s|Flor de Maroñas|Cerrito de la Victoria)\b/i,
    
    // People patterns - simplified
    /\b(?:Jos[eé] Gervasio Artigas|Jos[eé] Enrique Rod[oó]|Juana de Ibarbourou|Mario Benedetti|Eduardo Galeano|Luis Su[aá]rez|Edinson Cavani|Diego Forl[aá]n|[oó]scar Tab[aá]rez|Enzo Francescoli|Alfredo Zitarrosa|Carlos Gardel|Rub[eé]n Rada|Jorge Drexler|China Zorrilla|Fede [aá]lvarez|Fede Vigevani|Daniel Hendler|Jos[eé] Mujica|Tabar[eé] V[aá]zquez|Luis Lacalle Pou|Julio Mar[ií]a Sanguinetti)\b/i,
    
    // Institution patterns
    /\b(?:udelar|Universidad de la rep[uú]blica|cuarteto de nos|Vela puerca|Jaime Ross|Leo Masliah|cndf|mauricio zunino)\b/i,
  ]

  public async start() {
    await this.compilePatterns()
    await this.updateLists()
  }

  private async compilePatterns() {
    if (this.compiledPatterns.length === 0) {
      this.compiledPatterns = this.PATTERNS
    }
  }

  private async getCachedListMembers(list: string): Promise<string[]> {
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
      // Return cached data if available, even if expired
      return cached?.members || []
    }
  }

  private async updateLists() {
    const now = Date.now()
    if (now - this.lastListUpdate < this.LIST_UPDATE_INTERVAL) {
      return // Use cached lists if recently updated
    }

    try {
      // Update author list
      if (process.env.URUGUAY_LISTS && process.env.URUGUAY_LISTS.trim() !== '') {
        const lists: string[] = `${process.env.URUGUAY_LISTS}`.split('|').filter(list => list.trim() !== '')
        if (lists.length > 0) {
          const listMembersPromises = lists.map(list => this.getCachedListMembers(list))
          const allMembers = await Promise.all(listMembersPromises)
          this.authorSet = new Set(allMembers.flat())
        }
      } else {
        console.warn(`${this.name}: URUGUAY_LISTS environment variable not set or empty`)
        this.authorSet = new Set()
      }

      // Update blocked members
      if (process.env.BLOCKLIST && process.env.BLOCKLIST.trim() !== '') {
        const blockLists: string[] = `${process.env.BLOCKLIST}`.split('|').filter(list => list.trim() !== '')
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
      // Keep existing sets on error to prevent complete failure
    }
  }

  // Include Uruguayan users here to always include their posts
  public matchUsers: string[] = []

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
      // Get current database authors
      const db_authors = await dbClient.getDistinctFromCollection(
        this.author_collection,
        'did',
      )

      const dbAuthorSet = new Set(db_authors)
      const new_authors = Array.from(this.authorSet).filter(member => !dbAuthorSet.has(member))
      const del_authors = db_authors.filter(member => !this.authorSet.has(member))

      // Remove tags for deleted authors in bulk
      if (del_authors.length > 0) {
        try {
          await this.db.deleteManyDID(this.author_collection, del_authors)
        } catch (error) {
          console.error(`${this.name}: Error deleting authors:`, error)
        }
      }

      // Process new authors in batches
      if (new_authors.length > 0) {
        await this.processNewAuthors(new_authors)
      }
    } catch (error) {
      console.error(`${this.name}: Error in periodic task database operations:`, error)
    }

    // Clear pattern cache periodically to prevent memory bloat
    if (this.patternCache.size > this.CACHE_SIZE_LIMIT) {
      this.patternCache.clear()
    }

    // Clear old list cache entries
    const now = Date.now()
    for (const [key, value] of this.listCache.entries()) {
      if (now - value.timestamp > this.LIST_CACHE_DURATION) {
        this.listCache.delete(key)
      }
    }
  }

  private async processNewAuthors(new_authors: string[]) {
    const BATCH_SIZE = 10
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
      
      // Prepare bulk operations for authors
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

      // Execute author bulk operations
      if (authorBulkOps.length > 0) {
        try {
          await this.db.bulkWrite(this.author_collection, authorBulkOps)
        } catch (error) {
          console.error(`Error updating authors in ${this.author_collection}:`, error)
        }
      }

      // Self-healing post updates
      for (const { posts } of batchResults) {
        for (const post of posts) {
          try {
            await this.db.bulkWrite('post', [{
              updateOne: {
                filter: { uri: post.uri },
                update: { $addToSet: { algoTags: this.name } },
                upsert: true,
              },
            }])
          } catch (err: any) {
            if (err.message && err.message.includes('Cannot apply $addToSet to non-array field')) {
              // Heal the document and retry
              await this.db.bulkWrite('post', [{
                updateOne: {
                  filter: { uri: post.uri },
                  update: { $set: { algoTags: [] } },
                  upsert: false,
                },
              }])
              await this.db.bulkWrite('post', [{
                updateOne: {
                  filter: { uri: post.uri },
                  update: { $addToSet: { algoTags: this.name } },
                  upsert: true,
                },
              }])
            } else {
              console.error('Error updating post:', err)
            }
          }
        }
      }
    }
  }

  private async filterPostsBatch(posts: Post[]): Promise<Post[]> {
    const validPosts: Post[] = []
    
    for (const post of posts) {
      if (await this.filter_post(post)) {
        validPosts.push(post)
      }
    }
    
    return validPosts
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
      if (this.agent === null) return false
    }

    // Check blocked members first (fastest check)
    if (this.blockedSet.has(post.author)) {
      return false
    }

    // Check whitelisted authors (fast check)
    if (this.authorSet.has(post.author)) {
      return true
    }

    // Build matchString efficiently
    const matchString = this.buildMatchString(post)
    
    // Check pattern cache first
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }

    // Test patterns
    const matches = this.compiledPatterns.some(pattern => pattern.test(matchString))
    
    // Cache result
    this.patternCache.set(cacheKey, matches)
    
    return matches
  }

  private buildMatchString(post: Post): string {
    // Pre-allocate array for better performance
    const parts: string[] = []
    
    if (post.text) parts.push(post.text)
    if (post.tags?.length) parts.push(post.tags.join(' '))
    if (post.embed?.alt) parts.push(post.embed.alt)
    if (post.embed?.media?.alt) parts.push(post.embed.media.alt)
    if (post.embed?.images?.length) {
      const imageAlts = post.embed.images.map(img => img.alt).filter(Boolean)
      if (imageAlts.length) parts.push(imageAlts.join(' '))
    }
    
    return parts.join(' ').toLowerCase()
  }
}