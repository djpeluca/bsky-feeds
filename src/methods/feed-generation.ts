import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { AtUri } from '@atproto/syntax'
import moize from 'moize'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req, res }) => {
    const requestStart = Date.now()
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey].handler
    if (
      //feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }

    const cacheAge = algos[feedUri.rkey].manager.cacheAge(params)
    if (cacheAge.valueOf() > 0) {
      res.setHeader('Cache-Control', `public, max-age=${cacheAge}`)
    } else {
      res.setHeader('Cache-Control', `no-cache`)
    }

    /**
     * Example of how to check auth if giving user-specific results:
     *
     * const requesterDid = await validateAuth(
     *   req,
     *   ctx.cfg.serviceDid,
     *   ctx.didResolver,
     * )
     */

    const algoHandlerMoized = moize(algo, {
      isPromise: true,
      maxAge: 5000, // 5 seconds in milliseconds (was 30ms before, which was too short)
      isShallowEqual: true,
    })

    const body = await algoHandlerMoized(ctx, params)
    if (body.feed.length < params.limit) body.cursor = undefined

    const requestDuration = Date.now() - requestStart
    
    // Log slow feed requests
    if (requestDuration > 2000) {
      console.warn(`[FeedGeneration] Slow feed request for ${feedUri.rkey}: ${requestDuration}ms, cache age: ${cacheAge}s, results: ${body.feed.length}`)
    }
    
    // Log periodic stats for feed requests
    if (Math.random() < 0.01) { // 1% sampling for monitoring
      console.log(`[FeedGeneration] Feed ${feedUri.rkey} request: ${requestDuration}ms, cache: ${cacheAge}s, cursor: ${params.cursor ? 'yes' : 'no'}, results: ${body.feed.length}`)
    }

    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
