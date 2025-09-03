import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import dbClient from './db/dbClient'
import { StreamSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { createLandingPageRouter } from './landing/index'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public jetstream: StreamSubscription
  public cfg: Config

  constructor(
    app: express.Application,
    jetstream: StreamSubscription,
    cfg: Config,
  ) {
    this.app = app
    this.jetstream = jetstream
    this.cfg = cfg
  }

  static create(cfg: Config) {
    const app = express()
    const db = dbClient
    const jetstream = new StreamSubscription(db)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }

    // Mount landing page router BEFORE API routers
    const landingRouter = createLandingPageRouter(ctx)
    app.use('/', landingRouter) // now '/' and '/dashboard' will work

    // Mount your feed generation methods
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)

    // Mount the XRCP server routes
    app.use(server.xrpc.router)

    // Mount well-known endpoints (like /.well-known)
    app.use(wellKnown(ctx))

    return new FeedGenerator(app, jetstream, cfg)
}

  async start(): Promise<http.Server> {
    this.jetstream.start()
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    return this.server
  }
}

export default FeedGenerator
