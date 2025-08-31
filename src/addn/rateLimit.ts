import { pRateLimit } from 'p-ratelimit'
import { getRateLimitConfig } from '../config/rateLimit'

// Get configuration for rate limiting
const config = getRateLimitConfig()

// Configure rate limiting to stay within Bluesky's limits
const _limit = pRateLimit({
  interval: 1000,                    // 1 second window
  rate: config.requestsPerSecond,    // Configurable requests per second
  concurrency: config.maxConcurrency, // Configurable concurrency
  maxDelay: config.maxDelay,         // Configurable max delay
})

// Track consecutive failures for circuit breaker
let consecutiveFailures = 0
const CIRCUIT_BREAKER_THRESHOLD = config.circuitBreakerThreshold
const CIRCUIT_BREAKER_TIMEOUT = config.circuitBreakerTimeout

// Track rate limiting statistics
let totalRequests = 0
let successfulRequests = 0
let failedRequests = 0
let circuitBreakerTrips = 0

const limit = async <T>(fn: () => Promise<T>, retries?: number): Promise<T> => {
  const maxRetries = retries ?? config.maxRetries
  totalRequests++
  
  try {
    // Check circuit breaker first
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreakerTrips++
      console.log(`[RateLimit] Circuit breaker open (${circuitBreakerTrips} trips) - waiting ${CIRCUIT_BREAKER_TIMEOUT/1000}s before retrying`)
      await new Promise(resolve => setTimeout(resolve, CIRCUIT_BREAKER_TIMEOUT))
      consecutiveFailures = 0
      console.log(`[RateLimit] Circuit breaker reset, retrying...`)
    }

    const result = await _limit(fn)
    
    // Reset failure counter on success
    if (consecutiveFailures > 0) {
      consecutiveFailures = Math.max(0, consecutiveFailures - 1)
    }
    
    successfulRequests++
    return result
  } catch (error) {
    consecutiveFailures++
    failedRequests++
    
    if (maxRetries > 0) {
      // Exponential backoff: baseDelay * 2^retry, capped at maxRetryDelay
      const delay = Math.min(config.baseDelay * Math.pow(2, config.maxRetries - maxRetries), config.maxRetryDelay)
      console.log(`[RateLimit] Rate limited (${consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD} failures), retrying in ${delay/1000}s`)
      
      // Log function details for debugging (truncated to avoid log spam)
      const fnStr = fn.toString().substring(0, 100)
      console.log(`[RateLimit] Function: ${fnStr}...`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return await limit(fn, maxRetries - 1)
    } else {
      console.log(`[RateLimit] Rate limit exceeded after retries (${consecutiveFailures} consecutive failures)`)
      
      // If we're at circuit breaker threshold, log the function that caused it
      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        const fnStr = fn.toString().substring(0, 100)
        console.error(`[RateLimit] Circuit breaker triggered by: ${fnStr}...`)
      }
      
      throw error
    }
  }
}

// Export statistics for monitoring
export const getRateLimitStats = () => ({
  totalRequests,
  successfulRequests,
  failedRequests,
  consecutiveFailures,
  circuitBreakerTrips,
  successRate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) + '%' : '0%',
  circuitBreakerStatus: consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD ? 'OPEN' : 'CLOSED'
})

// Reset statistics (useful for monitoring)
export const resetRateLimitStats = () => {
  totalRequests = 0
  successfulRequests = 0
  failedRequests = 0
  consecutiveFailures = 0
  circuitBreakerTrips = 0
}

export default limit
