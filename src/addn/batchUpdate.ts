import dbClient from '../db/dbClient'
import limit from './rateLimit'

export default async function batchUpdate(agent, interval) {
  let firstRun = true
  let cycleCount = 0
  
  while (true) {
    if (!firstRun) await new Promise((resolve) => setTimeout(resolve, interval))
    else firstRun = false

    cycleCount++
    const updateStart = Date.now()
    console.log(`[BatchUpdate] Cycle ${cycleCount} started at ${new Date().toISOString()}, interval: ${interval/1000}s`)

    const unlabelledPosts = await dbClient.getUnlabelledPostsWithMedia(
      300,
      interval,
    )

    if (unlabelledPosts.length === 0) {
      console.log(`[BatchUpdate] No unlabelled posts found in cycle ${cycleCount}`)
      continue
    }

    console.log(`[BatchUpdate] Processing ${unlabelledPosts.length} unlabelled posts in cycle ${cycleCount}`)

    const chunkSize = 25

    const postEntries: { uri: string; labels: string[] }[] = []

    for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
      const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
        return [item.uri]
      })

      let res: any
      const chunkStart = Date.now()

      try {
        res = await limit(() => agent.app.bsky.feed.getPosts({ uris: chunk }))
        const chunkDuration = Date.now() - chunkStart
        console.log(`[BatchUpdate] Fetched chunk of ${chunk.length} posts in ${chunkDuration}ms`)
      } catch (e) {
        const chunkDuration = Date.now() - chunkStart
        console.error(`[BatchUpdate] Error fetching posts chunk after ${chunkDuration}ms, skipping...`, e.message)
        continue
      }

      const posts = res.data.posts

      if (posts.length === 0) {
        chunk.forEach((uri) => {
          postEntries.push({ uri: uri, labels: [] })
        })
      }

      for (let k = 0; k < posts.length; k++) {
        const labels: string[] = []
        if (posts[k].labels.length !== 0) {
          posts[k].labels.forEach((label) => {
            labels.push(label.val)
          })
        }
        postEntries.push({ uri: posts[k].uri, labels: labels })
      }
    }
    dbClient.updateLabelsForURIs(postEntries)
  }
}
