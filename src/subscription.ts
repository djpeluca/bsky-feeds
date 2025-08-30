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
  
  // Add monitoring properties
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
      wantedCollections: ["app.bsky.feed.post"], // We only need posts based on original code
    })

    dotenv.config()
    const handle = process.env.FEEDGEN_HANDLE
    const password = process.env.FEEDGEN_PASSWORD

    // Initialize algo managers - handle both class and instance types
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
      // Start batch updates
      console.log(`[Subscription] Starting batch update service...`)
      batchUpdate(this.agent, 5 * 60 * 1000)

      // Start algo managers
      console.log(`[Subscription] Starting ${this.algoManagers.length} algorithm managers...`)
      const startPromises = this.algoManagers.map(async (algo) => {
        if (await algo._start()) {
          console.log(`[Subscription] ${algo.name}: Started successfully`)
        } else {
          console.error(`[Subscription] ${algo.name}: Failed to start`)
        }
      })
      await Promise.all(startPromises)

      // Handle new posts with enhanced logging
      this.jetstream.onCreate("app.bsky.feed.post", async (event) => {
        const postStartTime = Date.now()
        this.postCount++
        
        try {
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

          // Log post details for debugging
          if (this.postCount % 100 === 0) { // Log every 100th post to avoid spam
            console.log(`[Subscription] Processing post #${this.postCount}: ${post.uri} from ${post.author}`)
          }

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
            if (this.postCount % 100 === 0) {
              console.log(`[Subscription] Post ${post.uri} not matched by any algorithm`)
            }
            return
          }

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
          
          this.lastPostTime = Date.now()
          this.consecutiveErrors = 0 // Reset on success
          
          if (this.postCount % 100 === 0) {
            const processingTime = Date.now() - postStartTime
            console.log(`[Subscription] Post #${this.postCount} processed in ${processingTime}ms, matched by: ${algoTags.join(', ')}`)
          }
          
        } catch (error) {
          console.error(`[Subscription] Error processing post:`, error)
          this.consecutiveErrors++
          
          if (this.consecutiveErrors >= 5) {
            console.error(`[Subscription] WARNING: ${this.consecutiveErrors} consecutive errors processing posts!`)
          }
        }
      })

      // Handle deleted posts
      this.jetstream.onDelete("app.bsky.feed.post", async (event) => {
        try {
          const uri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`
          console.log(`[Subscription] Deleting post: ${uri}`)
          await this.db.deleteManyURI('post', [uri])
        } catch (error) {
          console.error(`[Subscription] Error deleting post:`, error)
        }
      })

      // Start the jetstream
      console.log(`[Subscription] Starting Jetstream connection...`)
      await this.jetstream.start()
      
      const startupDuration = Date.now() - startTime
      console.log(`[Subscription] Subscription service started successfully in ${startupDuration}ms`)
      
      // Start health monitoring
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
    const timeSinceLastCheck = now - this.lastHealthCheck
    
    console.log(`[Subscription] HEALTH CHECK: Total posts: ${this.postCount}, Time since last post: ${Math.round(timeSinceLastPost / 1000)}s, Consecutive errors: ${this.consecutiveErrors}`)
    
    // Alert if no posts received for more than 5 minutes
    if (timeSinceLastPost > 5 * 60 * 1000) {
      console.warn(`[Subscription] ALERT: No posts received for ${Math.round(timeSinceLastPost / 1000)}s!`)
    }
    
    // Alert if we have many consecutive errors
    if (this.consecutiveErrors >= 10) {
      console.error(`[Subscription] CRITICAL: ${this.consecutiveErrors} consecutive errors!`)
    }
    
    this.lastHealthCheck = now
  }

  async close() {
    console.log(`[Subscription] Closing subscription service...`)
    await this.jetstream.close()
  }
}