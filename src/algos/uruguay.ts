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
import { safeAddToSet } from '../util/safeAddToSet'

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

// Main Uruguay pattern(s)
const MAIN_PATTERNS = [
  /\b(?!uruguaiana\b)(?:urugua|montevid|charrua|tacuaremb[oó]|paysand[ú]|semana de turismo|semana de la cerveza|daym[áa]n|guaviyú|arapey|🇺🇾|punta del este|yorugua|U R U G U A Y|Jose Mujica|Jos[eé] Mujica|Pepe Mujica|Carolina Cosse|Yamand[uú] Orsi|[aá]lvaro Delgado|Blanca Rodr[ií]guez|Valeria Ripoll|Lacalle Pou|Batllismo|Willsonismo|Herrerismo|Batllista|Willsonista|herrerista|peñarol|Parque Rod[oó])\b/i,
];

// Location patterns
const LOCATION_PATTERNS = [
  /\bColonia del Sacramento\b/i,
  /\bCabo Polonio\b/i,
  /\bPiri[aá]polis\b/i,
  /\bValizas\b/i,
  /\bAguas Dulces\b/i,
  /\bLaguna Garz[oó]n\b/i,
  /\bMercado del Puerto\b/i,
  /\bCerro San Antonio\b/i,
  /\bTermas del Daym[aá]n\b/i,
  /\bSalto Grande\b/i,
  /\bPocitos\b/i,
  /\bPunta Carretas\b/i,
  /\bMalv[ií]n\b/i,
  /\bVilla Española\b/i,
  /\bBañados de Carrasco\b/i,
  /\bCasab[oó]\b/i,
  /\bPaso de la Arena\b/i,
  /\bJacinto Vera\b/i,
  /\bVilla Dolores\b/i,
  /\bLas Acacias\b/i,
  /\bNuevo Par[ií]s\b/i,
  /\bFlor de Maroñas\b/i,
  /\bCerrito de la Victoria\b/i,
];

// People patterns
const PEOPLE_PATTERNS = [
  /\bJos[eé] Gervasio Artigas\b/i,
  /\bJos[eé] Enrique Rod[oó]\b/i,
  /\bJuana de Ibarbourou\b/i,
  /\bMario Benedetti\b/i,
  /\bEduardo Galeano\b/i,
  /\bLuis Su[aá]rez\b/i,
  /\bEdinson Cavani\b/i,
  /\bDiego Forl[aá]n\b/i,
  /\b[oó]scar Tab[aá]rez\b/i,
  /\bEnzo Francescoli\b/i,
  /\bAlfredo Zitarrosa\b/i,
  /\bCarlos Gardel\b/i,
  /\bRub[eé]n Rada\b/i,
  /\bJorge Drexler\b/i,
  /\bChina Zorrilla\b/i,
  /\bFede [aá]lvarez\b/i,
  /\bFede Vigevani\b/i,
  /\bDaniel Hendler\b/i,
  /\bJos[eé] Mujica\b/i,
  /\bTabar[eé] V[aá]zquez\b/i,
  /\bLuis Lacalle Pou\b/i,
  /\bJulio Mar[ií]a Sanguinetti\b/i,
];

// Institution patterns
const INSTITUTION_PATTERNS = [
  /\budelar\b/i,
  /\bUniversidad de la rep[uú]blica\b/i,
  /\bcuarteto de nos\b/i,
  /\bVela puerca\b/i,
  /\bJaime Ross\b/i,
  /\bLeo Masliah\b/i,
  /\bcndf\b/i,
  /\bmauricio zunino\b/i,
];

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
    ...MAIN_PATTERNS,
    ...LOCATION_PATTERNS,
    ...PEOPLE_PATTERNS,
    ...INSTITUTION_PATTERNS,
  ];

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

      // Efficient, batched, safe addToSet for posts
      const allValidPosts = batchResults.flatMap(({ posts }) => posts)
      if (allValidPosts.length > 0) {
        try {
          // Import the utility at the top: import { safeAddToSet } from '../utils/safeAddToSet'
          await safeAddToSet(this.db, allValidPosts, this.name)
        } catch (err) {
          console.error('Error in safeAddToSet for posts:', err)
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

    if (this.blockedSet.has(post.author)) return false
    if (this.authorSet.has(post.author)) return true

    const matchString = this.buildMatchString(post)
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }

    // Grouped pattern matching for early exit
    const groups = [
      MAIN_PATTERNS,
      LOCATION_PATTERNS,
      PEOPLE_PATTERNS,
      INSTITUTION_PATTERNS,
    ];

    let matches = false;
    for (const group of groups) {
      if (group.some(pattern => pattern.test(matchString))) {
        matches = true;
        break;
      }
    }

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