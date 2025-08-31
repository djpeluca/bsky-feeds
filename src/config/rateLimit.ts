import dotenv from 'dotenv'

dotenv.config()

export interface RateLimitConfig {
  // Rate limiting settings
  requestsPerSecond: number
  maxConcurrency: number
  maxDelay: number
  
  // Retry settings
  maxRetries: number
  baseDelay: number
  maxRetryDelay: number
  
  // Circuit breaker settings
  circuitBreakerThreshold: number
  circuitBreakerTimeout: number
  
  // Task intervals
  taskIntervalMinutes: number
  pollIntervalMs: number
  batchSize: number
}

export const getRateLimitConfig = (): RateLimitConfig => {
  return {
    // Rate limiting - conservative to stay under Bluesky limits
    requestsPerSecond: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_SECOND || '10'),
    maxConcurrency: parseInt(process.env.RATE_LIMIT_MAX_CONCURRENCY || '5'),
    maxDelay: parseInt(process.env.RATE_LIMIT_MAX_DELAY || '60000'),
    
    // Retry settings - exponential backoff
    maxRetries: parseInt(process.env.RATE_LIMIT_MAX_RETRIES || '2'),
    baseDelay: parseInt(process.env.RATE_LIMIT_BASE_DELAY || '30000'),
    maxRetryDelay: parseInt(process.env.RATE_LIMIT_MAX_RETRY_DELAY || '120000'),
    
    // Circuit breaker - stops retrying when overwhelmed
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
    circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '300000'), // 5 minutes
    
    // Task intervals - reduce frequency to avoid rate limits
    taskIntervalMinutes: parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS || '30'), // Increased from 15
    pollIntervalMs: parseInt(process.env.FEED_POLL_INTERVAL_MS || '30000'), // Increased from 10000
    batchSize: parseInt(process.env.FEED_BATCH_SIZE || '50'), // Reduced from default
  }
}

export const getEnvironmentSummary = () => {
  const config = getRateLimitConfig()
  
  return {
    // Critical settings
    mongodbConnection: process.env.FEEDGEN_MONGODB_CONNECTION_STRING ? 'SET' : 'NOT SET',
    blueskyCredentials: process.env.FEEDGEN_HANDLE && process.env.FEEDGEN_PASSWORD ? 'SET' : 'NOT SET',
    
    // Rate limiting settings
    requestsPerSecond: config.requestsPerSecond,
    maxConcurrency: config.maxConcurrency,
    taskIntervalMinutes: config.taskIntervalMinutes,
    pollIntervalMs: config.pollIntervalMs,
    
    // Recommendations
    recommendations: [
      config.taskIntervalMinutes < 20 ? 'Consider increasing FEEDGEN_TASK_INTEVAL_MINS to 30+ minutes' : null,
      config.pollIntervalMs < 20000 ? 'Consider increasing FEED_POLL_INTERVAL_MS to 30+ seconds' : null,
      config.requestsPerSecond > 15 ? 'Consider reducing RATE_LIMIT_REQUESTS_PER_SECOND to 10 or less' : null,
    ].filter(Boolean)
  }
}
