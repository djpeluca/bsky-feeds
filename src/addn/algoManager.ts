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
    if (params.cursor) return 600
    return 30
  }

  public async _start() {
    if (this._isStarting) {
      console.log(`${this.name}: Already starting`);
      return false;
    }
    console.log(`${this.name}: Starting algorithm manager`);
    this._isStarting = true;

    dotenv.config()

    let taskIntervalMins = 15;
    if (
      process.env.FEEDGEN_TASK_INTEVAL_MINS !== undefined &&
      Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS) > 0
    ) {
      taskIntervalMins = Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS)
    }
    console.log(`${this.name}: Task interval set to ${taskIntervalMins} minutes`);

    try {
      console.log(`${this.name}: Running initial periodic task`);
      await this.periodicTask()
    } catch (e) {
      console.error(`${this.name}: Error in initial periodic task:`, e);
    }

    const runPeriodicTask = async () => {
      console.log(`${this.name}: running ${taskIntervalMins}m task`)
      try {
        await this.periodicTask()
      } catch (e) {
        console.error(`${this.name}: error running periodic task:`, e)
      } finally {
        this.periodicIntervalId = setTimeout(runPeriodicTask, taskIntervalMins * 60 * 1000)
      }
    }

    runPeriodicTask() // Start the first execution

    try {
      console.log(`${this.name}: Running start() method`);
      await this.start()
    } catch (e) {
      console.error(`${this.name}: Error in start():`, e);
    }

    this._isReady = true;
    console.log(`${this.name}: Algorithm manager ready`);
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

  protected async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let retries = 0;
    let delay = initialDelay;

    while (true) {
      try {
        return await fn();
      } catch (error: any) {
        if (retries >= maxRetries || !error?.error?.includes('rate limit')) {
          throw error;
        }

        retries++;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
}
