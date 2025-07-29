import { Jetstream } from "@skyware/jetstream"
import { BskyAgent } from '@atproto/api'
import { Database } from './db'
import crypto from 'crypto'
import dotenv from 'dotenv'
import algos from './algos'
import batchUpdate from './addn/batchUpdate'

export class StreamSubscription {
  private db: Database
  private jetstream: Jetstream
  public algoManagers: any[]
  private agent: BskyAgent
  private postsProcessed = 0
  private lastLogTime = Date.now()
  private connectionStartTime = Date.now()
  private lastPostTime = Date.now()
  private connectionHealthTimer: NodeJS.Timeout | null = null

  constructor(db: Database) {
    this.db = db
    this.algoManagers = []
    this.agent = new BskyAgent({ service: 'https://api.bsky.app' })
    
    this.jetstream = new Jetstream({
      wantedCollections: ["app.bsky.feed.post"], // We only need posts based on original code
    })

    dotenv.config()
    const handle = process.env.FEEDGEN_HANDLE
    const password = process.env.FEEDGEN_PASSWORD

    // Initialize algo managers
    Object.keys(algos).forEach((algo) => {
      this.algoManagers.push(new algos[algo].manager(db, this.agent))
    })
    
    // Set up connection health monitoring
    this.setupConnectionHealthMonitoring()
  }

  private setupConnectionHealthMonitoring() {
    // Monitor connection health every 2 minutes
    this.connectionHealthTimer = setInterval(() => {
      const now = Date.now()
      const timeSinceLastPost = now - this.lastPostTime
      const timeSinceConnection = now - this.connectionStartTime
      
      if (timeSinceLastPost > 300000) { // 5 minutes without posts
        console.warn(`[StreamSubscription] WARNING: No posts received for ${Math.round(timeSinceLastPost/60000)} minutes (connection up for ${Math.round(timeSinceConnection/60000)} minutes)`)
      }
      
      if (timeSinceLastPost > 1200000) { // 20 minutes without posts - CRITICAL
        console.error(`[StreamSubscription] CRITICAL: No posts received for ${Math.round(timeSinceLastPost/60000)} minutes! This indicates a feed delay issue.`)
      }
      
      console.log(`[StreamSubscription] Health check - Posts processed: ${this.postsProcessed}, Last post: ${Math.round(timeSinceLastPost/1000)}s ago, Connection uptime: ${Math.round(timeSinceConnection/60000)}min`)
    }, 120000) // Every 2 minutes
  }

  async start() {
    // Start batch updates
    console.log(`[StreamSubscription] Starting batch updates with 5-minute interval`)
    batchUpdate(this.agent, 5 * 60 * 1000)

    // Start algo managers
    const startPromises = this.algoManagers.map(async (algo) => {
      if (await algo._start()) {
        console.log(`[StreamSubscription] Algorithm manager started: ${algo.name}`)
      }
    })
    await Promise.all(startPromises)

    // Set up connection event handlers
    this.jetstream.on('open', () => {
      this.connectionStartTime = Date.now()
      console.log(`[StreamSubscription] Jetstream connection opened at ${new Date().toISOString()}`)
    })

    this.jetstream.on('close', (code, reason) => {
      console.warn(`[StreamSubscription] Jetstream connection closed - Code: ${code}, Reason: ${reason}`)
    })

    this.jetstream.on('error', (error) => {
      console.error(`[StreamSubscription] Jetstream connection error:`, error.message)
    })

    // Handle new posts
    this.jetstream.onCreate("app.bsky.feed.post", async (event) => {
      const postStart = Date.now()
      this.lastPostTime = postStart // Update last post time immediately
      
      await Promise.all(this.algoManagers.map((manager) => manager.ready()))

      const record = event.commit.record as { text?: string; createdAt?: string; embed?: { images?: any[] }; likeCount?: number; repostCount?: number; replyCount?: number; tags?: string[] };

      const post = {
        _id: null,
        uri: `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`,
        cid: event.commit.cid,
        author: event.did,
        text: record?.text ?? '',
        createdAt: new Date(record?.createdAt ?? Date.now()).getTime(),
        indexedAt: new Date().getTime(),
        hasImage: Boolean(record?.embed?.images),
        likeCount: record?.likeCount ?? 0,
        repostCount: record?.repostCount ?? 0,
        replyCount: record?.replyCount ?? 0,
        algoTags: null,
        tags: Array.isArray(record?.tags) ? record.tags : [],
      }

      const algoTagsPromises = this.algoManagers.map(async (manager) => {
        try {
          const includeAlgo = await manager.filter_post(post)
          return includeAlgo ? manager.name : null
        } catch (err) {
          console.error(`[StreamSubscription] ${manager.name} filter failed:`, err.message)
          return null
        }
      })

      const algoTags = (await Promise.all(algoTagsPromises)).filter(tag => tag !== null)
      if (algoTags.length === 0) return

      const hash = crypto
        .createHash('shake256', { outputLength: 12 })
        .update(post.uri)
        .digest('hex')
        .toString()

      const to_insert = {
        ...post,
        _id: hash,
        algoTags,
        earliestCreatedIndexedAt: Math.min(post.createdAt, post.indexedAt),
      }

      await this.db.replaceOneURI('post', to_insert.uri, to_insert)
      
      this.postsProcessed++
      const postDuration = Date.now() - postStart
      
      // Log stats every 100 posts or every 5 minutes
      const now = Date.now()
      if (this.postsProcessed % 100 === 0 || (now - this.lastLogTime) > 300000) {
        console.log(`[StreamSubscription] Processed ${this.postsProcessed} posts. Last post took ${postDuration}ms. Tags: [${algoTags.join(', ')}]`)
        this.lastLogTime = now
      }
    })

    // Handle deleted posts
    this.jetstream.onDelete("app.bsky.feed.post", async (event) => {
      await this.db.deleteManyURI('post', [`at://${event.did}/${event.commit.collection}/${event.commit.rkey}`])
      console.log(`[StreamSubscription] Deleted post: at://${event.did}/${event.commit.collection}/${event.commit.rkey}`)
    })

    // Start the jetstream
    console.log(`[StreamSubscription] Starting Jetstream connection at ${new Date().toISOString()}`)
    await this.jetstream.start()
  }

  async close() {
    console.log(`[StreamSubscription] Closing Jetstream connection`)
    if (this.connectionHealthTimer) {
      clearInterval(this.connectionHealthTimer)
    }
    await this.jetstream.close()
  }
}