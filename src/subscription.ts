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
  }

  async start() {
    // Start batch updates
    batchUpdate(this.agent, 5 * 60 * 1000)

    // Start algo managers
    const startPromises = this.algoManagers.map(async (algo) => {
      if (await algo._start()) {
        console.log(`${algo.name}: Started`)
      }
    })
    await Promise.all(startPromises)

    // Handle new posts
    this.jetstream.onCreate("app.bsky.feed.post", async (event) => {
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
          console.error(`${manager.name}: filter failed`, err)
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
    })

    // Handle deleted posts
    this.jetstream.onDelete("app.bsky.feed.post", async (event) => {
      await this.db.deleteManyURI('post', [`at://${event.did}/${event.commit.collection}/${event.commit.rkey}`])
    })

    // Start the jetstream
    await this.jetstream.start()
  }

  async close() {
    await this.jetstream.close()
  }
}