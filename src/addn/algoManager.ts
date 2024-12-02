import dotenv from 'dotenv'
import { Database } from '../db'
import { Post } from '../db/schema'
import { Agent } from '@atproto/api'

export class AlgoManager {
  private static _instance: AlgoManager

  public db: Database
  public agent: Agent
  public periodicIntervalId: NodeJS.Timer

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
    if (params.cursor) return 600
    return 30
  }

  public async _start() {
    if (this._isStarting) return false
    this._isStarting = true

    const taskIntervalMins = Math.max(
      1,
      Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS || '15') || 15
    )

    await this.periodicTask()

    if (!this.periodicIntervalId) {
      this.periodicIntervalId = setInterval(async () => {
        console.log(`${this.name}: running ${taskIntervalMins}m task`)
        try {
          await this.periodicTask()
        } catch (e) {
          console.error(`${this.name}: error running periodic task ${e.message}`)
        }
      }, taskIntervalMins * 60 * 1000)
    }

    await this.start()
    this._isReady = true
    return this._isReady
  }

  public async start() {
    return
  }

  public async ready(): Promise<Boolean> {
    if (this._isReady) return this._isReady
    else return await this._start()
  }

  public async periodicTask() {
    return
  }

  public async filter_post(post: Post): Promise<Boolean> {
    return false
  }
}
