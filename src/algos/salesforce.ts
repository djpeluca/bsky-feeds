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

const MAIN_PATTERNS = [
  /(^|[\s\W])#Salesforce($|[\W\s])/im,
  /(^|[\s\W])Salesforce($|[\W\s])/im,
  /(^|[\s\W])Salesforce\+($|[\W\s])/im,
  /(^|[\s\W])#SalesforceSaturday($|[\W\s])/im,
  /(^|[\s\W])#TrailblazerCommunity($|[\W\s])/im,
  /(^|[\s\W])Salesblazer($|[\W\s])/im,
  /(^|[\s\W])AwesomeAdmin($|[\W\s])/im,
  /(^|[\s\W])Agent Force($|[\W\s])/im,
  /(^|[\s\W])Agentforce($|[\W\s])/im,
];

const EVENT_PATTERNS = [
  /(^|[\s\W])Dreamforce($|[\W\s])/im,
  /(^|[\s\W])#DF23($|[\W\s])/im,
  /(^|[\s\W])DF25($|[\W\s])/im,
  /(^|[\s\W])DX25($|[\W\s])/im,
  /(^|[\s\W])DubaiDreamin($|[\W\s])/im,
  /(^|[\s\W])Dubai Dreamin($|[\W\s])/im,
  /(^|[\s\W])DD25($|[\W\s])/im,
  /(^|[\s\W])Dreamin\b/im,
];

const PRODUCT_PATTERNS = [
  /(^|[\s\W])Data Cloud($|[\W\s])/im,
  /(^|[\s\W])sfdx($|[\W\s])/im,
  /(^|[\s\W])sfdc($|[\W\s])/im,
  /(^|[\s\W])Einstein Conversation Insights($|[\W\s])/im,
  /(^|[\s\W])MuleSoft($|[\W\s])/im,
  /(^|[\s\W])Hyperforce($|[\W\s])/im,
  /(^|[\s\W])Sales GPT($|[\W\s])/im,
  /(^|[\s\W])Einstein Vision AI($|[\W\s])/im,
  /(^|[\s\W])foodforce($|[\W\s])/im,
];

const CERTIFICATION_PATTERNS = [
  /certified\s+(admin|developer|architect|consultant|specialist|marketer|analyst|designer|instructor|trainer)/i,
];

const COMMUNITY_PATTERNS = [
  /trailblazer\s+community/i,
  /trailhead\s+live/i,
  /#trailheart/i,
];

const ACQUIRED_PRODUCT_PATTERNS = [
  /\bheroku\b/i,
  /\bslack\b/i,
  /\bquip\b/i,
  /\bexacttarget\b/i,
];

const PARTNER_PATTERNS = [
  /\bapp\s+exchange\b/i,
  /\bappexchange\b/i,
  /\bisv\s+partner\b/i,
  /\bconsulting\s+partner\b/i,
  /\bpartner\s+community\b/i,
  /#sfpartner/i,
];

const DEVELOPER_PATTERNS = [
  /\bapex\s+code\b/i,
  /\blwc\b/i,
  /\blightning\s+web\s+components?\b/i,
  /\bvisualforce\b/i,
  /\bsoql\b/i,
  /\bsosl\b/i,
  /\bsfdx\s+cli\b/i,
];

export class manager extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  protected PATTERNS = [
    ...MAIN_PATTERNS,
    ...EVENT_PATTERNS,
    ...PRODUCT_PATTERNS,
    ...CERTIFICATION_PATTERNS,
    ...COMMUNITY_PATTERNS,
    ...ACQUIRED_PRODUCT_PATTERNS,
    ...PARTNER_PATTERNS,
    ...DEVELOPER_PATTERNS,
  ];
  protected LISTS_ENV = 'SALESFORCE_LISTS';

  public async filter_post(post: any): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
      if (this.agent === null) return false
    }
    if (this.blockedSet.has(post.author)) return false
    if (this.authorSet.has(post.author)) return true
    const matchString = this.buildMatchString(post)
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }
    // Grouped pattern matching for early exit
    const groups = [
      MAIN_PATTERNS,
      EVENT_PATTERNS,
      PRODUCT_PATTERNS,
      CERTIFICATION_PATTERNS,
      COMMUNITY_PATTERNS,
      ACQUIRED_PRODUCT_PATTERNS,
      PARTNER_PATTERNS,
      DEVELOPER_PATTERNS,
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
