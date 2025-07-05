import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { BaseFeedManager } from './BaseFeedManager'
import dotenv from 'dotenv'
import dbClient from '../db/dbClient'

dotenv.config()

export const shortname = 'salesforce'

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
    ...[
      '#Salesforce',
      '#DF23',
      'Salesforce',
      'Data Cloud',
      '#SalesforceSaturday',
      '#TrailblazerCommunity',
      'Salesforce+',
      'Dreamforce',
      'AwesomeAdmin',
      'Agent Force',
      'Agentforce',
      'DF25',
      'DX25',
      'DubaiDreamin',
      'Dubai Dreamin',
      'Salesforce+',
      'DD24',
      'sfdx',
      'sfdc',
      'Einstein Conversation Insights',
      'MuleSoft',
      'Hyperforce',
      'Sales GPT',
      'Einstein Vision AI',
      'Salesblazer',
      'foodforce',
    ].map(term => new RegExp(`(^|[\\s\\W])${term}($|[\\W\\s])`, 'im'))
  ];
  protected LISTS_ENV = 'SALESFORCE_LISTS';

  public async filter_post(post: any): Promise<boolean> {
    // Exclude specific authors
    if ([
      'did:plc:mcb6n67plnrlx4lg35natk2b',
      'did:plc:pcpvhedjrmiu2x6hwe33qpvm',
      'did:plc:pdvjdejvjinix4lnt4sgzg7r',
    ].includes(post.author)) return false

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
