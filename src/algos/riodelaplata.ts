import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'
import { getListMembers } from '../addn/getListMembers'
import { manager as UruguayManager } from './uruguay'
import { manager as ArgentinaManager } from './argentina'
import { Agent } from '@atproto/api'
import { BaseFeedManager } from './BaseFeedManager'

dotenv.config()

// max 15 chars
export const shortname = 'riodelaplata'


export const handler = async (ctx: AppContext, params: QueryParams) => {
  // Fetch posts tagged for either feed (union)
  const uruguayPosts = await dbClient.getLatestPostsForTag({
    tag: 'uruguay',
    limit: params.limit,
    cursor: params.cursor,
  })
  const argentinaPosts = await dbClient.getLatestPostsForTag({
    tag: 'argentina',
    limit: params.limit,
    cursor: params.cursor,
  })

  // Merge and deduplicate by URI
  const allPosts = [...uruguayPosts, ...argentinaPosts]
  const uniquePosts = Array.from(
    new Map(allPosts.map(post => [post.uri, post])).values()
  )

  // Sort by indexedAt/cid as needed
  uniquePosts.sort((a, b) => b.indexedAt - a.indexedAt || b.cid.localeCompare(a.cid))

  // Apply pagination/limit
  const feed = uniquePosts.slice(0, params.limit).map(row => ({ post: row.uri }))
  let cursor: string | undefined
  const last = uniquePosts[params.limit - 1]
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }
  return { cursor, feed }
}

export class manager extends BaseFeedManager {
  private uruguay: UruguayManager
  private argentina: ArgentinaManager
  protected PATTERNS = [
    /(^|[\s\W])Rio de la Plata($|[\W\s])/im,
    /(^|[\s\W])dulce de leche($|[\W\s])/im,
    /(^|[\s\W])carpincho($|[\W\s])/im,
    /(^|[\s\W])🧉($|[\W\s])/im,
  ];
  protected LISTS_ENV = '';
  public name = shortname;
  public author_collection = '';

  constructor(db: any, agent: Agent) {
    super(db, agent);
    this.uruguay = new UruguayManager(db, agent);
    this.argentina = new ArgentinaManager(db, agent);
  }

  async start() {
    await this.uruguay.start();
    await this.argentina.start();
  }

  public async filter_post(post: any): Promise<boolean> {
    const matchString = [
      post.text,
      ...(post.tags || []),
      post.embed?.alt,
      post.embed?.media?.alt,
      ...(post.embed?.images?.map((img: any) => img.alt) || [])
    ].filter(Boolean).join(' ').toLowerCase();

    if (this.PATTERNS.some(pattern => pattern.test(matchString))) {
      return true;
    }
    return !!(await this.uruguay.filter_post(post)) || !!(await this.argentina.filter_post(post));
  }
}
