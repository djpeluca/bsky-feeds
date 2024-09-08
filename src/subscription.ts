import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

import algos from './algos'
import batchUpdate from './addn/batchUpdate'

import { Database } from './db'

import crypto from 'crypto'
import { Post } from './db/schema'

import { AtpAgent } from '@atproto/api'


export class FirehoseSubscription extends FirehoseSubscriptionBase {
  public algoManagers: any[]

  constructor(db: Database, subscriptionEndpoint: string) {
    super(db, subscriptionEndpoint)

    this.algoManagers = []

    const agent = new AtpAgent({ service: 'https://bsky.social' })


    dotenv.config()
    const handle = `${process.env.FEEDGEN_HANDLE}`
    const password = `${process.env.FEEDGEN_PASSWORD}`

    agent.login({ identifier: handle, password: password }).then(async () => {
      batchUpdate(agent, 5 * 60 * 1000)

      Object.keys(algos).forEach((algo) => {
        this.algoManagers.push(new algos[algo].manager(db, agent))
      })

      const startPromises = this.algoManagers.map(async (algo) => {
        if (await algo._start()) {
          console.log(`${algo.name}: Started`)
        }
      })

      await Promise.all(startPromises)
    })
  }

  public authorList: string[]
  public intervalId: NodeJS.Timer

  async handleEvent(evt: RepoEvent) {
    try {
      if (!isCommit(evt)) return

      await Promise.all(this.algoManagers.map((manager) => manager.ready()))

      const ops = await (async () => {
        try {
          return await getOpsByType(evt)
        } catch (e) {
          console.log(`core: error decoding ops ${e.message}`)
          return undefined
        }
      })()

      if (!ops) return

      const postsToDelete = ops.posts.deletes.map((del) => del.uri)

      // Transform posts in parallel
      const postsCreated = ops.posts.creates.map((create) => ({
        _id: null,
        uri: create.uri,
        cid: create.cid,
        author: create.author,
        text: create.record?.text,
        replyParent: create.record?.reply?.parent.uri ?? null,
        replyRoot: create.record?.reply?.root.uri ?? null,
        indexedAt: new Date().getTime(),
        algoTags: null,
        embed: create.record?.embed,
        tags: Array.isArray(create.record?.tags) ? create.record?.tags : [],
      }))

      const postsToCreatePromises = postsCreated.map(async (post) => {
        const algoTagsPromises = this.algoManagers.map(async (manager) => {
          try {
            const includeAlgo = await manager.filter_post(post)
            return includeAlgo ? manager.name : null
          } catch (err) {
            console.error(`${manager.name}: filter failed`, err)
            return null
          }
        })

        const algoTagsResults = await Promise.all(algoTagsPromises)
        const algoTags = algoTagsResults.filter((tag) => tag !== null)

        if (algoTags.length === 0) return null

        const hash = crypto
          .createHash('shake256', { outputLength: 12 })
          .update(post.uri)
          .digest('hex')
          .toString()

        return {
          ...post,
          _id: hash,
          algoTags: algoTags,
        }
      })

      const postsToCreate = (await Promise.all(postsToCreatePromises)).filter(
        (post) => post !== null,
      )

      if (postsToDelete.length > 0) {
        await this.db.deleteManyURI('post', postsToDelete)
      }

      if (postsToCreate.length > 0) {
        postsToCreate.forEach(async (to_insert) => {
          try {
            console.log(`Attempting to replace/insert post with URI: ${to_insert.uri}`)
            console.log(`Post data:`, JSON.stringify(to_insert, null, 2))
            
            await this.db.replaceOneURI('post', to_insert.uri, to_insert)
            
            console.log(`Successfully replaced/inserted post with URI: ${to_insert.uri}`)
          } catch (error) {
            console.error(`Error replacing/inserting post with URI: ${to_insert.uri}`)
            console.error(`Error details:`, error)
            console.error(`Post data that failed to insert:`, JSON.stringify(to_insert, null, 2))
          }
        })
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Message must have the property \"blocks\"")) {
        console.warn("Skipping invalid message:", error.message);
        return;
      }
      throw error;  // Re-throw other errors
    }
  }
}
