import dbClient from '../db/dbClient'
import limit from './rateLimit'

export default async function batchUpdate(agent, interval) {
  let firstRun = true
  let runCount = 0
  let totalPostsProcessed = 0
  let lastRunTime = Date.now()
  
  console.log(`[BatchUpdate] Starting batch update service with ${interval}ms interval`)
  
  while (true) {
    if (!firstRun) await new Promise((resolve) => setTimeout(resolve, interval))
    else firstRun = false

    const runStartTime = Date.now()
    runCount++
    
    try {
      // Get unlabeled posts with media for labeling
      const unlabelledPosts = await dbClient.getUnlabelledPostsWithMedia(
        300,
        interval,
      )

      if (unlabelledPosts.length === 0) {
        // No posts to process, continue to next cycle
        lastRunTime = runStartTime
        continue
      }

      console.log(`[BatchUpdate] Run #${runCount}: Processing ${unlabelledPosts.length} unlabeled posts`)

      const chunkSize = 25
      const postEntries: { uri: string; labels: string[] }[] = []
      let processedChunks = 0
      let successfulChunks = 0
      let failedChunks = 0

      // Process posts in chunks to avoid overwhelming the API
      for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
        const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
          return [item.uri]
        })

        processedChunks++
        const chunkStartTime = Date.now()
        
        let res: any

        try {
          // Fetch post details from Bluesky API (rate limited)
          res = await limit(() => agent.app.bsky.feed.getPosts({ uris: chunk }))
          
          const posts = res.data.posts

          if (posts.length === 0) {
            // No posts returned, mark as unlabeled for retry
            chunk.forEach((uri) => {
              postEntries.push({ uri: uri, labels: [] })
            })
          } else {
            // Extract labels from returned posts
            for (let k = 0; k < posts.length; k++) {
              const labels: string[] = []
              if (posts[k].labels && posts[k].labels.length !== 0) {
                posts[k].labels.forEach((label) => {
                  labels.push(label.val)
                })
              }
              postEntries.push({ uri: posts[k].uri, labels: labels })
            }
          }
          
          successfulChunks++
          
        } catch (e) {
          // API call failed (likely rate limited), mark for retry
          failedChunks++
          
          // Mark failed chunks as unlabeled to retry later
          chunk.forEach((uri) => {
            postEntries.push({ uri: uri, labels: [] })
          })
          
          continue
        }
      }

      // Update database with labeling results
      if (postEntries.length > 0) {
        try {
          await dbClient.updateLabelsForURIs(postEntries)
        } catch (error) {
          console.error(`[BatchUpdate] Database update failed:`, error)
        }
      }

      totalPostsProcessed += postEntries.length
      const runDuration = Date.now() - runStartTime
      lastRunTime = runStartTime
      
      // Log summary of this run
      console.log(`[BatchUpdate] Run #${runCount} completed in ${runDuration}ms: ${postEntries.length} posts, ${successfulChunks}/${processedChunks} chunks successful`)
      
      // Alert if many chunks failed (possible rate limiting)
      if (failedChunks > 0) {
        console.warn(`[BatchUpdate] ${failedChunks} chunks failed - may indicate rate limiting`)
      }
      
    } catch (error) {
      const runDuration = Date.now() - runStartTime
      console.error(`[BatchUpdate] Run #${runCount} failed after ${runDuration}ms:`, error)
      lastRunTime = runStartTime
    }
  }
}
