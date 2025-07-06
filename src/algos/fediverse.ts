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

const MAIN_PATTERNS = [
  /(^|[\s\W])fediverse($|[\W\s])/im,
  /(^|[\s\W])fediverso($|[\W\s])/im,
  /(^|[\s\W])mastodon($|[\W\s])/im,
  /(^|[\s\W])pixelfed($|[\W\s])/im,
  /(^|[\s\W])activitypub($|[\W\s])/im,
];

const PLATFORM_PATTERNS = [
  /(^|[\s\W])pleroma($|[\W\s])/im,
  /(^|[\s\W])Akkoma($|[\W\s])/im,
  /(^|[\s\W])friendica($|[\W\s])/im,
  /(^|[\s\W])funkwhale($|[\W\s])/im,
  /(^|[\s\W])gnu social($|[\W\s])/im,
  /(^|[\s\W])peertube($|[\W\s])/im,
  /(^|[\s\W])hubzilla($|[\W\s])/im,
  /(^|[\s\W])firefish($|[\W\s])/im,
];

const COMMUNITY_PATTERNS = [
  /(^|[\s\W])Fedifollow($|[\W\s])/im,
  /(^|[\s\W])Fediblock($|[\W\s])/im,
  /(^|[\s\W])Kbin($|[\W\s])/im,
  /(^|[\s\W])FediCon($|[\W\s])/im,
];

const PROTOCOL_PATTERNS = [
  /(^|[\s\W])ActivityStream($|[\W\s])/im,
  /(^|[\s\W])WebFinger($|[\W\s])/im,
  /(^|[\s\W])RFC 9227($|[\W\s])/im,
  /(^|[\s\W])RFC9227($|[\W\s])/im,
  /(^|[\s\W])RFC 3987($|[\W\s])/im,
  /(^|[\s\W])RFC3987($|[\W\s])/im,
  /(^|[\s\W])Internationalized Resource Identifier($|[\W\s])/im,
];

export class manager extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  // Combine for PATTERNS (optional, for compatibility)
  protected PATTERNS = [
    ...MAIN_PATTERNS,
    ...PLATFORM_PATTERNS,
    ...COMMUNITY_PATTERNS,
    ...PROTOCOL_PATTERNS,
  ];
  protected LISTS_ENV = 'FEDIVERSE_LISTS';

  public async filter_post(post: any): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
      if (this.agent === null) return false
    }
    if (this.blockedSet.has(post.author)) return false
    if (this.authorSet.has(post.author)) return true
    
    // Filter out unwanted cross-posts with "Original post on" links
    const matchString = this.buildMatchString(post)
    if (matchString.includes('original post on') || matchString.includes('[original post on')) {
      return false
    }
    
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }
    // Grouped pattern matching for early exit
    const groups = [
      MAIN_PATTERNS,
      PLATFORM_PATTERNS,
      COMMUNITY_PATTERNS,
      PROTOCOL_PATTERNS,
    ];
    let matches = false;
    for (const group of groups) {
      if (group.some(pattern => pattern.test(matchString))) {
        matches = true;
        break;
      }
    }
    this.patternCache.set(cacheKey, matches)
    return matches
  }

  private buildMatchString(post: any): string {
    const parts: string[] = []
    if (post.text) parts.push(post.text)
    if (post.tags?.length) parts.push(post.tags.join(' '))
    if (post.embed?.alt) parts.push(post.embed.alt)
    if (post.embed?.media?.alt) parts.push(post.embed.media.alt)
    if (post.embed?.images?.length) {
      const imageAlts = post.embed.images.map((img: any) => img.alt).filter(Boolean)
      if (imageAlts.length) parts.push(imageAlts.join(' '))
    }
    return parts.join(' ').toLowerCase()
  }
}
