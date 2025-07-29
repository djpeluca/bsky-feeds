import { pRateLimit } from 'p-ratelimit'

const _limit = pRateLimit({
  interval: 1000, // 1 second
  rate: 10, // 10 requests per second
  concurrency: 5, // Max 5 concurrent requests
  maxDelay: 30000, // Max 30 second delay
})

const limit = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  const requestStart = Date.now()
  try {
    const result = await _limit(fn)
    const requestDuration = Date.now() - requestStart
    if (requestDuration > 5000) { // Log slow requests
      console.warn(`[RateLimit] Slow request completed in ${requestDuration}ms`)
    }
    return result
  } catch (error) {
    const requestDuration = Date.now() - requestStart
    if (retries > 0) {
      console.warn(`[RateLimit] Request failed after ${requestDuration}ms, retrying (${retries} attempts left): ${error.message}`)
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))
      await delay(10000)
      return await limit(fn, retries - 1)
    } else {
      console.error(`[RateLimit] Request failed permanently after ${requestDuration}ms: ${error.message}`)
      throw error
    }
  }
}

export default limit
