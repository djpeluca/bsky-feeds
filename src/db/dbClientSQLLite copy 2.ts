import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import dotenv from 'dotenv'
import { InvalidRequestError } from '@atproto/xrpc-server'

dotenv.config()

class dbSingleton {
  db: Database | null = null

  constructor(dbPath: string) {
    this.init(dbPath)
  }

  async init(dbPath: string) {
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    })
  }

  // Implement other methods similarly

}

// Set the path for the SQLite database file
const dbPath = process.env.FEEDGEN_SQLITE_PATH;

// Instantiate the SQLite singleton with the specified path
const dbClient = new dbSingleton(dbPath)

export default dbClient
