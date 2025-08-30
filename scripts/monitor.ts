#!/usr/bin/env ts-node

import dbClient from '../src/db/dbClient'
import dotenv from 'dotenv'

dotenv.config()

interface FeedHealth {
  name: string
  postCount: number
  lastUpdate: Date
  status: 'healthy' | 'warning' | 'critical'
}

class FeedMonitor {
  private checkInterval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL_MS = 60000 // 1 minute
  private readonly WARNING_THRESHOLD = 5 * 60 * 1000 // 5 minutes
  private readonly CRITICAL_THRESHOLD = 20 * 60 * 1000 // 20 minutes

  async start() {
    console.log('🚀 Starting Feed Health Monitor...')
    console.log(`📊 Monitoring interval: ${this.CHECK_INTERVAL_MS / 1000}s`)
    console.log(`⚠️  Warning threshold: ${this.WARNING_THRESHOLD / 1000}s`)
    console.log(`🚨 Critical threshold: ${this.CRITICAL_THRESHOLD / 1000}s`)
    console.log('─'.repeat(80))
    
    // Initial check
    await this.performHealthCheck()
    
    // Start periodic monitoring
    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, this.CHECK_INTERVAL_MS)
  }

  async performHealthCheck() {
    const timestamp = new Date().toISOString()
    console.log(`\n🔍 Health Check at ${timestamp}`)
    console.log('─'.repeat(80))
    
    try {
      // Get overall system stats
      const systemStats = await this.getSystemStats()
      console.log(`📈 System Stats:`)
      console.log(`   Total Posts: ${systemStats.totalPosts}`)
      console.log(`   Total Authors: ${systemStats.totalAuthors}`)
      console.log(`   Database Size: ${systemStats.dbSize}`)
      
      // Check each feed
      const feeds = await this.getFeedHealth()
      console.log(`\n📋 Feed Health:`)
      
      let healthyFeeds = 0
      let warningFeeds = 0
      let criticalFeeds = 0
      
      for (const feed of feeds) {
        const statusIcon = this.getStatusIcon(feed.status)
        const timeSinceUpdate = Date.now() - feed.lastUpdate.getTime()
        const timeStr = this.formatDuration(timeSinceUpdate)
        
        console.log(`   ${statusIcon} ${feed.name}: ${feed.postCount} posts, last update: ${timeStr}`)
        
        if (feed.status === 'healthy') healthyFeeds++
        else if (feed.status === 'warning') warningFeeds++
        else criticalFeeds++
      }
      
      // Summary
      console.log(`\n📊 Summary:`)
      console.log(`   ✅ Healthy: ${healthyFeeds}`)
      console.log(`   ⚠️  Warning: ${warningFeeds}`)
      console.log(`   🚨 Critical: ${criticalFeeds}`)
      
      // Check for recent activity
      await this.checkRecentActivity()
      
      // Check for potential issues
      await this.checkForIssues()
      
    } catch (error) {
      console.error('❌ Health check failed:', error)
    }
    
    console.log('─'.repeat(80))
  }

  private async getSystemStats() {
    try {
      const posts = await dbClient.getCollection('post')
      const authors = await dbClient.getCollection('author')
      
      // Calculate approximate database size (rough estimate)
      const postSize = posts.length * 1024 // Assume ~1KB per post
      const authorSize = authors.length * 512 // Assume ~512B per author
      const totalSize = (postSize + authorSize) / (1024 * 1024) // Convert to MB
      
      return {
        totalPosts: posts.length,
        totalAuthors: authors.length,
        dbSize: `${totalSize.toFixed(2)} MB`
      }
    } catch (error) {
      console.error('Error getting system stats:', error)
      return { totalPosts: 0, totalAuthors: 0, dbSize: 'Unknown' }
    }
  }

  private async getFeedHealth(): Promise<FeedHealth[]> {
    try {
      const posts = await dbClient.getCollection('post')
      const feeds = new Map<string, { count: number, lastUpdate: number }>()
      
      // Group posts by algorithm tags
      for (const post of posts) {
        if (post.algoTags && Array.isArray(post.algoTags)) {
          for (const tag of post.algoTags) {
            if (!feeds.has(tag)) {
              feeds.set(tag, { count: 0, lastUpdate: 0 })
            }
            feeds.get(tag)!.count++
            feeds.get(tag)!.lastUpdate = Math.max(feeds.get(tag)!.lastUpdate, post.indexedAt || 0)
          }
        }
      }
      
      // Convert to FeedHealth objects
      const feedHealth: FeedHealth[] = []
      for (const [name, data] of feeds.entries()) {
        const lastUpdate = new Date(data.lastUpdate)
        const timeSinceUpdate = Date.now() - data.lastUpdate
        
        let status: 'healthy' | 'warning' | 'critical' = 'healthy'
        if (timeSinceUpdate > this.CRITICAL_THRESHOLD) {
          status = 'critical'
        } else if (timeSinceUpdate > this.WARNING_THRESHOLD) {
          status = 'warning'
        }
        
        feedHealth.push({
          name,
          postCount: data.count,
          lastUpdate,
          status
        })
      }
      
      // Sort by status (critical first) then by name
      return feedHealth.sort((a, b) => {
        const statusOrder = { critical: 0, warning: 1, healthy: 2 }
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status]
        }
        return a.name.localeCompare(b.name)
      })
      
    } catch (error) {
      console.error('Error getting feed health:', error)
      return []
    }
  }

  private async checkRecentActivity() {
    try {
      const now = Date.now()
      const oneHourAgo = now - 60 * 60 * 1000
      const recentPosts = await dbClient.getCollection('post')
      
      const recentCount = recentPosts.filter(post => 
        post.indexedAt && post.indexedAt > oneHourAgo
      ).length
      
      console.log(`\n⏰ Recent Activity (last hour):`)
      console.log(`   Posts indexed: ${recentCount}`)
      
      if (recentCount === 0) {
        console.log(`   🚨 WARNING: No posts indexed in the last hour!`)
      } else if (recentCount < 10) {
        console.log(`   ⚠️  Low activity: Only ${recentCount} posts in the last hour`)
      } else {
        console.log(`   ✅ Normal activity level`)
      }
      
    } catch (error) {
      console.error('Error checking recent activity:', error)
    }
  }

  private async checkForIssues() {
    try {
      console.log(`\n🔍 Issue Detection:`)
      
      // Check for posts without algorithm tags
      const posts = await dbClient.getCollection('post')
      const untaggedPosts = posts.filter(post => 
        !post.algoTags || post.algoTags.length === 0
      ).length
      
      if (untaggedPosts > 0) {
        console.log(`   ⚠️  Found ${untaggedPosts} posts without algorithm tags`)
      }
      
      // Check for posts with very old timestamps
      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000
      const oldPosts = posts.filter(post => 
        post.indexedAt && post.indexedAt < oneDayAgo
      ).length
      
      if (oldPosts > 0) {
        console.log(`   📅 Found ${oldPosts} posts older than 24 hours`)
      }
      
      // Check for potential data inconsistencies
      const postsWithMissingData = posts.filter(post => 
        !post.uri || !post.author || !post.indexedAt
      ).length
      
      if (postsWithMissingData > 0) {
        console.log(`   🚨 Found ${postsWithMissingData} posts with missing critical data`)
      }
      
      if (untaggedPosts === 0 && oldPosts === 0 && postsWithMissingData === 0) {
        console.log(`   ✅ No obvious issues detected`)
      }
      
    } catch (error) {
      console.error('Error checking for issues:', error)
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '✅'
      case 'warning': return '⚠️'
      case 'critical': return '🚨'
      default: return '❓'
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      console.log('\n🛑 Feed Health Monitor stopped')
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

// Start the monitor
const monitor = new FeedMonitor()
monitor.start().catch(console.error)
