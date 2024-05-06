import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { InvalidRequestError } from '@atproto/xrpc-server'

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

  async deleteManyURI(collection: string, uris: string[]) {
    await this.db?.run(`DELETE FROM ${collection} WHERE uri IN (?)`, uris)
  }

  async deleteManyDID(collection: string, dids: string[]) {
    await this.db?.run(`DELETE FROM ${collection} WHERE did IN (?)`, dids)
  }

  async replaceOneURI(collection: string, uri: string, data: any) {
    // Implement logic for replacing one record by URI in SQLite
  }

  // Implement other methods similarly

}


const dbClient = new dbSingleton(process.env.FEEDGEN_SQLITE_PATH);

export default dbClient