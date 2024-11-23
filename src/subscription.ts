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

      const post = {
        _id: null,
        uri: event.commit.cid,
        cid: event.commit.cid,
        author: event.did,
        text: event.commit.record?.['text'] ?? null,
        replyParent: event.commit.record?.reply?.parent?.uri ?? null,
        replyRoot: event.commit.record?.reply?.root?.uri ?? null,
        indexedAt: new Date().getTime(),
        createdAt: new Date(event.commit.record?.createdAt).getTime(),
        algoTags: null,
        embed: event.commit.record?.embed,
        tags: Array.isArray(event.commit.record?.tags) ? event.commit.record?.tags : [],
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
      await this.db.deleteManyURI('post', [event.uri])
    })

    // Start the jetstream
    await this.jetstream.start()
  }

  async close() {
    await this.jetstream.close()
  }
}