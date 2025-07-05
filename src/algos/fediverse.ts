import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { BaseFeedManager } from './BaseFeedManager'
import dotenv from 'dotenv'
import dbClient from '../db/dbClient'

dotenv.config()

export const shortname = 'fediverse'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })

  let feed = builder.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = builder.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}

export class manager extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  protected PATTERNS = [
    // All your fediverse patterns here, as RegExp
    ...[
      'fediverse',
      'fediverso',
      'mastodon',
      'pixelfed',
      'activitypub',
      'ActivityStream',
      'pleroma',
      'Akkoma',
      'friendica',
      'funkwhale',
      'gnu social',
      'peertube',
      'diaspora',
      'hubzilla',
      'firefish',
      'Fedifollow',
      'WebFinger',
      'Fediblock',
      'Kbin',
      'RFC 9227',
      'RFC9227',
      'RFC 3987',
      'RFC3987',
      'Internationalized Resource Identifier',
    ].map(term => new RegExp(`(^|[\\s\\W])${term}($|[\\W\\s])`, 'im'))
  ];
  protected LISTS_ENV = 'FEDIVERSE_LISTS';

  public async filter_post(post: any): Promise<boolean> {
    // Exclude specific authors
    if (post.author === 'did:plc:mcb6n67plnrlx4lg35natk2b' || post.author === 'did:plc:zwxl6dnun52q3ywiao2ad3if') return false

    const parts: string[] = []
    if (post.text) parts.push(post.text)
    if (post.tags?.length) parts.push(post.tags.join(' '))
    if (post.embed?.alt) parts.push(post.embed.alt)
    if (post.embed?.media?.alt) parts.push(post.embed.media.alt)
    if (post.embed?.images?.length) {
      const imageAlts = post.embed.images.map((img: any) => img.alt).filter(Boolean)
      if (imageAlts.length) parts.push(imageAlts.join(' '))
    }
    const matchString = parts.join(' ').toLowerCase()
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }
    let matches = false
    for (const pattern of this.PATTERNS) {
      if (pattern.test(matchString)) {
        matches = true
        break
      }
    }
    this.patternCache.set(cacheKey, matches)
    return matches
  }
}
