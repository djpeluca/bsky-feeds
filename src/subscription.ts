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
  
  // Monitoring properties for rate limiting detection
  private lastPostTime = Date.now()
  private postCount = 0
  private lastHealthCheck = Date.now()
  private readonly HEALTH_CHECK_INTERVAL = 1000 * 60 * 2 // 2 minutes
  private consecutiveErrors = 0

  constructor(db: Database) {
    this.db = db
    this.algoManagers = []
    this.agent = new BskyAgent({ service: 'https://api.bsky.app' })
    
    this.jetstream = new Jetstream({
      wantedCollections: ["app.bsky.feed.post"], // Only need posts for feed generation
    })

    dotenv.config()
    const handle = process.env.FEEDGEN_HANDLE
    const password = process.env.FEEDGEN_PASSWORD

    // Initialize algorithm managers for post filtering
    Object.keys(algos).forEach((algo) => {
      try {
        const managerClass = algos[algo].manager
        if (typeof managerClass === 'function') {
          // If it's a class constructor, instantiate it
          const manager = new managerClass(db, this.agent)
          this.algoManagers.push(manager)
        } else if (managerClass && typeof managerClass === 'object') {
          // If it's already an instance, use it directly
          this.algoManagers.push(managerClass)
        } else {
          console.warn(`[Subscription] Skipping invalid manager for ${algo}:`, managerClass)
        }
      } catch (error) {
        console.error(`[Subscription] Error initializing manager for ${algo}:`, error)
      }
    })
    
    console.log(`[Subscription] Initialized with ${this.algoManagers.length} algorithm managers`)
  }

  async start() {
    console.log(`[Subscription] Starting subscription service...`)
    const startTime = Date.now()
    
    try {
      // Start batch update service for post labeling (runs every 5 minutes)
      console.log(`[Subscription] Starting batch update service...`)
      batchUpdate(this.agent, 5 * 60 * 1000)

      // Start all algorithm managers
      console.log(`[Subscription] Starting ${this.algoManagers.length} algorithm managers...`)
      const startPromises = this.algoManagers.map(async (algo) => {
        if (await algo._start()) {
          console.log(`[Subscription] ${algo.name}: Started successfully`)
        } else {
          console.error(`[Subscription] ${algo.name}: Failed to start`)
        }
      })
      await Promise.all(startPromises)

      // Handle new posts from Bluesky real-time feed
      this.jetstream.onCreate("app.bsky.feed.post", async (event) => {
        const postStartTime = Date.now()
        this.postCount++
        
        try {
          // Ensure all managers are ready before processing
          await Promise.all(this.algoManagers.map((manager) => manager.ready()))

          // Extract post data from Bluesky event
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

          // Process post through all algorithm managers to determine which feeds it belongs to
          const algoTagsPromises = this.algoManagers.map(async (manager) => {
            try {
              const includeAlgo = await manager.filter_post(post)
              return includeAlgo ? manager.name : null
            } catch (err) {
              console.error(`[Subscription] ${manager.name}: filter failed for post ${post.uri}:`, err)
              this.consecutiveErrors++
              return null
            }
          })

          const algoTags = (await Promise.all(algoTagsPromises)).filter(tag => tag !== null)
          if (algoTags.length === 0) {
            // Post doesn't match any algorithm criteria
            return
          }

          // Generate unique hash for post storage
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

          // Store post in database
          await this.db.replaceOneURI('post', to_insert.uri, to_insert)
          
          this.lastPostTime = Date.now()
          this.consecutiveErrors = 0 // Reset error counter on success
          
          // Log every 100th post to monitor processing health without flooding logs
          if (this.postCount % 100 === 0) {
            const processingTime = Date.now() - postStartTime
            console.log(`[Subscription] Processed ${this.postCount} posts, last batch: ${algoTags.join(', ')} in ${processingTime}ms`)
          }
          
        } catch (error) {
          console.error(`[Subscription] Error processing post:`, error)
          this.consecutiveErrors++
          
          // Alert if we have many consecutive errors (potential rate limiting)
          if (this.consecutiveErrors >= 5) {
            console.error(`[Subscription] WARNING: ${this.consecutiveErrors} consecutive errors - possible rate limiting or connection issues`)
          }
        }
      })

      // Handle post deletions from Bluesky
      this.jetstream.onDelete("app.bsky.feed.post", async (event) => {
        try {
          const uri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`
          await this.db.deleteManyURI('post', [uri])
        } catch (error) {
          console.error(`[Subscription] Error deleting post:`, error)
        }
      })

      // Start the Jetstream WebSocket connection to Bluesky
      console.log(`[Subscription] Starting Jetstream connection...`)
      await this.jetstream.start()
      
      const startupDuration = Date.now() - startTime
      console.log(`[Subscription] Subscription service started successfully in ${startupDuration}ms`)
      
      // Start health monitoring to detect rate limiting and connection issues
      this.startHealthMonitoring()
      
    } catch (error) {
      console.error(`[Subscription] Failed to start subscription service:`, error)
      throw error
    }
  }

  private startHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL)
  }

  private async performHealthCheck() {
    const now = Date.now()
    const timeSinceLastPost = now - this.lastPostTime
    
    // Monitor for potential rate limiting or connection issues
    console.log(`[Subscription] HEALTH: ${this.postCount} posts, last post: ${Math.round(timeSinceLastPost / 1000)}s ago, errors: ${this.consecutiveErrors}`)
    
    // Alert if no posts received for extended period (possible rate limiting)
    if (timeSinceLastPost > 5 * 60 * 1000) {
      console.warn(`[Subscription] ALERT: No posts for ${Math.round(timeSinceLastPost / 1000)}s - check Bluesky API status and rate limits`)
    }
    
    // Alert if we have many consecutive errors (likely rate limiting)
    if (this.consecutiveErrors >= 10) {
      console.error(`[Subscription] CRITICAL: ${this.consecutiveErrors} consecutive errors - system may be rate limited`)
    }
    
    this.lastHealthCheck = now
  }

  async close() {
    console.log(`[Subscription] Closing subscription service...`)
    await this.jetstream.close()
  }
}