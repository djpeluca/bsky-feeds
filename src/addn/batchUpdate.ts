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
      console.log(`[BatchUpdate] Run #${runCount}: Starting label update process...`)
      console.log(`[BatchUpdate] Time since last run: ${Math.round((runStartTime - lastRunTime) / 1000)}s`)

      const unlabelledPosts = await dbClient.getUnlabelledPostsWithMedia(
        300,
        interval,
      )

      if (unlabelledPosts.length === 0) {
        console.log(`[BatchUpdate] Run #${runCount}: No unlabelled posts found, skipping...`)
        lastRunTime = runStartTime
        continue
      }

      console.log(`[BatchUpdate] Run #${runCount}: Found ${unlabelledPosts.length} unlabelled posts to process`)

      const chunkSize = 25
      const postEntries: { uri: string; labels: string[] }[] = []
      let processedChunks = 0
      let successfulChunks = 0
      let failedChunks = 0

      for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
        const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
          return [item.uri]
        })

        processedChunks++
        const chunkStartTime = Date.now()
        
        console.log(`[BatchUpdate] Run #${runCount}: Processing chunk ${processedChunks}/${Math.ceil(unlabelledPosts.length / chunkSize)} (${chunk.length} posts)`)

        let res: any

        try {
          res = await limit(() => agent.app.bsky.feed.getPosts({ uris: chunk }))
          const chunkDuration = Date.now() - chunkStartTime
          console.log(`[BatchUpdate] Run #${runCount}: Chunk ${processedChunks} fetched in ${chunkDuration}ms`)
          
          const posts = res.data.posts

          if (posts.length === 0) {
            console.log(`[BatchUpdate] Run #${runCount}: Chunk ${processedChunks} returned no posts, marking as unlabelled`)
            chunk.forEach((uri) => {
              postEntries.push({ uri: uri, labels: [] })
            })
          } else {
            console.log(`[BatchUpdate] Run #${runCount}: Chunk ${processedChunks} returned ${posts.length} posts`)
            
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
          const chunkDuration = Date.now() - chunkStartTime
          console.error(`[BatchUpdate] Run #${runCount}: Error fetching chunk ${processedChunks} after ${chunkDuration}ms:`, e)
          failedChunks++
          
          // Mark failed chunks as unlabelled to retry later
          chunk.forEach((uri) => {
            postEntries.push({ uri: uri, labels: [] })
          })
          
          continue
        }
      }

      // Update database with results
      if (postEntries.length > 0) {
        const dbUpdateStart = Date.now()
        console.log(`[BatchUpdate] Run #${runCount}: Updating database with ${postEntries.length} post entries...`)
        
        try {
          await dbClient.updateLabelsForURIs(postEntries)
          const dbUpdateDuration = Date.now() - dbUpdateStart
          console.log(`[BatchUpdate] Run #${runCount}: Database update completed in ${dbUpdateDuration}ms`)
        } catch (error) {
          console.error(`[BatchUpdate] Run #${runCount}: Database update failed:`, error)
        }
      }

      totalPostsProcessed += postEntries.length
      const runDuration = Date.now() - runStartTime
      lastRunTime = runStartTime
      
      console.log(`[BatchUpdate] Run #${runCount} completed in ${runDuration}ms:`)
      console.log(`  - Total posts processed: ${postEntries.length}`)
      console.log(`  - Chunks processed: ${processedChunks}`)
      console.log(`  - Successful chunks: ${successfulChunks}`)
      console.log(`  - Failed chunks: ${failedChunks}`)
      console.log(`  - Cumulative posts processed: ${totalPostsProcessed}`)
      
      // Alert if we have many failed chunks
      if (failedChunks > 0) {
        console.warn(`[BatchUpdate] Run #${runCount}: ${failedChunks} chunks failed, may need investigation`)
      }
      
    } catch (error) {
      const runDuration = Date.now() - runStartTime
      console.error(`[BatchUpdate] Run #${runCount} failed after ${runDuration}ms:`, error)
      lastRunTime = runStartTime
    }
  }
}
