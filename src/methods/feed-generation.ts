import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { AtUri } from '@atproto/syntax'
import moize from 'moize'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req, res }) => {
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

    // Get cache age from the manager class
    const manager = algos[feedUri.rkey].manager
    let cacheAge = 30 // Default cache age
    
    // Try to get cacheAge from the manager class (static method)
    try {
      if (manager && typeof manager === 'function' && (manager as any).cacheAge) {
        // If manager is a class constructor
        cacheAge = Number((manager as any).cacheAge(params))
      } else if (manager && (manager as any).constructor && (manager as any).constructor.cacheAge) {
        // If manager is an instance, try constructor
        cacheAge = Number((manager as any).constructor.cacheAge(params))
      }
    } catch (error) {
      // Use default cache age if there's an error
      cacheAge = 30
    }
    
    if (cacheAge > 0) {
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
      maxAge: 30, // 30 seconds
      isShallowEqual: true,
    })

    const body = await algoHandlerMoized(ctx, params)
    if (body.feed.length < params.limit) body.cursor = undefined

    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
