import { BskyAgent } from '@atproto/api'
import { Database } from '../db'
import crypto from 'crypto'

export async function syncRecentPosts(db: Database, agent: BskyAgent, algoManagers: any[]) {
  try {
    const response = await agent.api.app.bsky.feed.getTimeline({
      limit: 100,
      cursor: undefined
    })

    const timeoutMs = 60 * 60 * 1000 // 1 hour
    const now = new Date().getTime()
    const since = now - timeoutMs

    const recentPosts = response.data.feed.filter(item => {
      const postTime = new Date(item.post.indexedAt).getTime()
      return postTime > since
    })

    for (const item of recentPosts) {
      const post = {
        _id: null,
        uri: item.post.uri,
        cid: item.post.cid,
        author: item.post.author.did,
        text: (item.post.record as any)?.text ?? '',
        replyParent: (item.post.record as any)?.reply?.parent?.uri ?? null,
        replyRoot: (item.post.record as any)?.reply?.root?.uri ?? null,
        indexedAt: new Date().getTime(),
        createdAt: item.post.indexedAt,
        algoTags: null,
        embed: item.post.embed,
        tags: Array.isArray((item.post.record as any)?.tags) ? (item.post.record as any).tags : [],
      }

      // Use your existing algo filtering
      const algoTagsPromises = algoManagers.map(async (manager) => {
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

      if (algoTags.length === 0) continue

      const hash = crypto
        .createHash('shake256', { outputLength: 12 })
        .update(post.uri)
        .digest('hex')
        .toString()

      const finalPost = {
        ...post,
        _id: hash,
        algoTags: algoTags,
      }

      await db.replaceOneURI('post', finalPost.uri, finalPost)
    }

    console.log(`Synced ${recentPosts.length} recent posts`)
  } catch (error) {
    console.error('Error syncing recent posts:', error)
  }
} 