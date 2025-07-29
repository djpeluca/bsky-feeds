import dotenv from 'dotenv'
import { Database } from '../db'
import { Post } from '../db/schema'
import { Agent } from '@atproto/api'

export class AlgoManager {
  private static _instance: AlgoManager

  public db: Database
  public agent: Agent
  public periodicIntervalId: NodeJS.Timer | null = null

  public name: string = ''

  public _isReady: Boolean = false
  public _isStarting: Boolean = false

  constructor(db: Database, agent: Agent) {
    this.db = db
    this.agent = agent
    this._isReady = false
    this._isStarting = false
  }

  public static cacheAge(params): Number {
    // For cursor-based requests (pagination), use longer cache
    if (params.cursor) return 300 // 5 minutes for paginated results
    
    // For fresh feed requests, use minimal cache for instant refresh
    return 5 // 5 seconds only for top-level feed requests to enable near-instant refresh
  }

  public async _start() {
    if (this._isStarting) return false
    this._isStarting = true

    dotenv.config()

    let taskIntervalMins = 15
    if (
      process.env.FEEDGEN_TASK_INTEVAL_MINS !== undefined &&
      Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS) > 0
    ) {
      taskIntervalMins = Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS)
    }

    const startTime = Date.now()
    console.log(`[${this.name}] Starting periodic tasks with ${taskIntervalMins}m interval at ${new Date().toISOString()}`)
    
    await this.periodicTask()

    const runPeriodicTask = async () => {
      const taskStart = Date.now()
      console.log(`[${this.name}] Running ${taskIntervalMins}m periodic task at ${new Date().toISOString()}`)
      
      try {
        await this.periodicTask()
        const taskDuration = Date.now() - taskStart
        console.log(`[${this.name}] Periodic task completed in ${taskDuration}ms`)
      } catch (e) {
        const taskDuration = Date.now() - taskStart
        console.error(`[${this.name}] Periodic task failed after ${taskDuration}ms: ${e.message}`)
      } finally {
        const nextRunTime = new Date(Date.now() + (taskIntervalMins * 60 * 1000))
        console.log(`[${this.name}] Next periodic task scheduled for ${nextRunTime.toISOString()}`)
        this.periodicIntervalId = setTimeout(runPeriodicTask, taskIntervalMins * 60 * 1000)
      }
    }

    runPeriodicTask() // Start the first execution

    await this.start()

    this._isReady = true
    return this._isReady
  }

  public async start() {
    return
  }

  public async ready(): Promise<Boolean> {
    if (this._isReady) return this._isReady
    return await this._start()
  }

  public async periodicTask() {
    return
  }

  public async filter_post(post: Post): Promise<Boolean> {
    return false
  }
}
