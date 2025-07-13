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
];

// Salesforce Event Patterns (Dreamin' and others)
const EVENT_PATTERNS = [
  /(^|[\s\W])Dreamforce($|[\W\s])/im,
  /(^|[\s\W])DF25($|[\W\s])/im,
  /(^|[\s\W])DX25($|[\W\s])/im,
  /(^|[\s\W])DubaiDreamin($|[\W\s])/im,
  /(^|[\s\W])Dubai Dreamin($|[\W\s])/im,
  /(^|[\s\W])DD25($|[\W\s])/im,
  /(^|[\s\W])MidAtlanticDreamin\b/im,
  /(^|[\s\W])Midwest Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])MidwestDreamin'?($|[\W\s])/im,
  /(^|[\s\W])Texas Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])TexasDreamin'?($|[\W\s])/im,
  /(^|[\s\W])Florida Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])FloridaDreamin'?($|[\W\s])/im,
  /(^|[\s\W])Northeast Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])NortheastDreamin'?($|[\W\s])/im,
  /(^|[\s\W])SouthEast Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])SouthEastDreamin'?($|[\W\s])/im,
  /(^|[\s\W])NorCal Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])NorCalDreamin'?($|[\W\s])/im,
  /(^|[\s\W])Forcelandia($|[\W\s])/im,
  /(^|[\s\W])Tahoe Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])TahoeDreamin'?($|[\W\s])/im,
  /(^|[\s\W])WITness Success($|[\W\s])/im,
  /(^|[\s\W])WITnessSuccess($|[\W\s])/im,
  /(^|[\s\W])Philly Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])PhillyDreamin'?($|[\W\s])/im,
  /(^|[\s\W])London’s Calling($|[\W\s])/im,
  /(^|[\s\W])Londons Calling($|[\W\s])/im,
  /(^|[\s\W])LondonsCalling($|[\W\s])/im,
  /(^|[\s\W])CzechDreamin($|[\W\s])/im,
  /(^|[\s\W])Czech Dreamin($|[\W\s])/im,
  /(^|[\s\W])French Touch Dreamin($|[\W\s])/im,
  /(^|[\s\W])FrenchTouchDreamin($|[\W\s])/im,
  /(^|[\s\W])YeurDreamin($|[\W\s])/im,
  /(^|[\s\W])Yeur Dreamin($|[\W\s])/im,
  /(^|[\s\W])Alps Dreamin'?($|[\W\s])/im,
  /(^|[\s\W])AlpsDreamin'?($|[\W\s])/im,
  /(^|[\s\W])DreamOle($|[\W\s])/im,
  /(^|[\s\W])India Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])IndiaDreamin’?($|[\W\s])/im,
  /(^|[\s\W])Japan Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])JapanDreamin’?($|[\W\s])/im,
  /(^|[\s\W])Down Under Dreaming($|[\W\s])/im,
  /(^|[\s\W])DownUnderDreaming($|[\W\s])/im,
  /(^|[\s\W])Brasil Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])BrasilDreamin’?($|[\W\s])/im,
  /(^|[\s\W])Dreamin’ Argentina($|[\W\s])/im,
  /(^|[\s\W])Dreamin Argentina($|[\W\s])/im,
  /(^|[\s\W])Africa Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])AfricaDreamin’?($|[\W\s])/im,
  /(^|[\s\W])DevOps Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])DevOpsDreamin’?($|[\W\s])/im,
  /(^|[\s\W])Nonprofit Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])NonprofitDreamin’?($|[\W\s])/im,
  /(^|[\s\W])True North Dreamin’?($|[\W\s])/im,
  /(^|[\s\W])TrueNorthDreamin’?($|[\W\s])/im,
];

const PRODUCT_PATTERNS = [
  /(^|[\s\W])Data Cloud($|[\W\s])/im,
  /(^|[\s\W])sfdc($|[\W\s])/im,
  /(^|[\s\W])Einstein Conversation Insights($|[\W\s])/im,
  /(^|[\s\W])MuleSoft($|[\W\s])/im,
  /(^|[\s\W])Sales GPT($|[\W\s])/im,
  /(^|[\s\W])Einstein Vision AI($|[\W\s])/im,
  /(^|[\s\W])Agent Force($|[\W\s])/im,
  /(^|[\s\W])Agentforce($|[\W\s])/im,
];

const CERTIFICATION_PATTERNS = [
  /certified\s+(admin|developer|architect|consultant|specialist|marketer|analyst|designer|instructor|trainer)/i,
];

const COMMUNITY_PATTERNS = [
  /trailblazer\s+community/i,
  /trailhead\s+live/i,
  /#trailheart/i,
  /(^|[\s\W])foodforce($|[\W\s])/im,
  /(^|[\s\W])#SalesforceSaturday($|[\W\s])/im,
  /(^|[\s\W])#TrailblazerCommunity($|[\W\s])/im,
  /(^|[\s\W])Salesblazer($|[\W\s])/im,
  /(^|[\s\W])AwesomeAdmin($|[\W\s])/im,
];

const ACQUIRED_PRODUCT_PATTERNS = [
  /\bexacttarget\b/i,
  /(^|[\s\W])Slack('?)(?=$|[\W\s])/,
  /(^|[\s\W])slackapi($|[\W\s])/i,
];

const PARTNER_PATTERNS = [
  /\bapp\s+exchange\b/i,
  /\bappexchange\b/i,
  /\bisv\s+partner\b/i,
  /\bpartner\s+community\b/i,
  /#sfpartner/i,
];

const DEVELOPER_PATTERNS = [
  /\bapex\s+code\b/i,
  /\blightning\s+web\s+components?\b/i,
  /\bvisualforce\b/i,
  /\bsoql\b/i,
  /\bsosl\b/i,
  /\bflow builder\b/i,
  /\bprompt builder\b/i,
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
    const matchString = this.buildMatchString(post);

    // Exclude posts that ONLY contain "salesforce tower" and no other Salesforce pattern
    if (matchString.includes('salesforce tower')) {
      // Remove "salesforce tower" from the string for further matching
      const matchStringWithoutTower = matchString.replace(/salesforce tower/gi, '');
      // Check if any other pattern matches (excluding the generic "salesforce" pattern)
      const groupsToCheck = [
        // All your pattern groups except MAIN_PATTERNS, or filter MAIN_PATTERNS to exclude the generic salesforce pattern
        EVENT_PATTERNS,
        PRODUCT_PATTERNS,
        CERTIFICATION_PATTERNS,
        COMMUNITY_PATTERNS,
        ACQUIRED_PRODUCT_PATTERNS,
        PARTNER_PATTERNS,
        DEVELOPER_PATTERNS,
      ];
      let matchesOther = false;
      for (const group of groupsToCheck) {
        if (group.some(pattern => pattern.test(matchStringWithoutTower))) {
          matchesOther = true;
          break;
        }
      }
      if (!matchesOther) {
        // Only "salesforce tower" matched, so exclude
        return false;
      }
    }
    // Exclude posts containing #F1DriveroftheDay (case-insensitive)
    if (matchString.includes('#f1driveroftheday')) return false;

    // Exclude posts containing "my.salesforce-sites.com" (case-insensitive)
    if (matchString.includes('my.salesforce-sites.com')) return false;

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
