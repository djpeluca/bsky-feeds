import { BaseFeedManager } from './BaseFeedManager'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import setListMembers from '../addn/setListMembers'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'
import { AppBskyGraphDefs } from '@atproto/api'
import getUserLists from '../addn/getUserLists'
import { safeAddToSet } from '../util/safeAddToSet'

dotenv.config()

export const shortname = 'argentina'

const MAIN_PATTERNS = [
  /(^|[\s\W])🇦🇷($|[\W\s])/im,
  /(^|[\s\W])Argenti($|[\W\s])/im,
  /(^|[\s\W])Argento($|[\W\s])/im,
  /(^|[\s\W])Argenta($|[\W\s])/im,
  /(^|[\s\W])Milei($|[\W\s])/im,
  /(^|[\s\W])Cyberciruj($|[\W\s])/im,
  /(^|[\s\W])TwitterArg($|[\W\s])/im,
];
const LOCATION_PATTERNS = [
  /(^|[\s\W])Buenos Aires($|[\W\s])/im,
  /(^|[\s\W])Tierra del Fuego($|[\W\s])/im,
  /(^|[\s\W])Gualeguaych[úu]($|[\W\s])/im,
  /(^|[\s\W])Capital Federal($|[\W\s])/im,
  /(^|[\s\W])Puerto Madero($|[\W\s])/im,
  /(^|[\s\W])Patagonia($|[\W\s])/im,
  /(^|[\s\W])La Bombonera($|[\W\s])/im,
  /(^|[\s\W])Monumental de Nuñez($|[\W\s])/im,
  /(^|[\s\W])Casa Rosada($|[\W\s])/im,
  /(^|[\s\W])Perito Moreno($|[\W\s])/im,
  /(^|[\s\W])San Mart[ií]n de los Andes($|[\W\s])/im,
];
const PEOPLE_PATTERNS = [
  /(^|[\s\W])Maradona($|[\W\s])/im,
  /(^|[\s\W])Lionel Messi($|[\W\s])/im,
  /(^|[\s\W])Eva Per[óo]n($|[\W\s])/im,
  /(^|[\s\W])Evita Per[óo]n($|[\W\s])/im,
  /(^|[\s\W])Domingo Per[óo]n($|[\W\s])/im,
  /(^|[\s\W])Juan Per[óo]n($|[\W\s])/im,
  /(^|[\s\W])Jorge Luis Borges($|[\W\s])/im,
  /(^|[\s\W])Mercedes Sosa($|[\W\s])/im,
  /(^|[\s\W])Carlos Gardel($|[\W\s])/im,
  /(^|[\s\W])Victoria Villarruel($|[\W\s])/im,
  /(^|[\s\W])Sergio Massa($|[\W\s])/im,
  /(^|[\s\W])Larreta($|[\W\s])/im,
  /(^|[\s\W])Patricia Bullrich($|[\W\s])/im,
  /(^|[\s\W])Pato Bullrich($|[\W\s])/im,
  /(^|[\s\W])Cris Morena($|[\W\s])/im,
  /(^|[\s\W])Spreen($|[\W\s])/im,
  /(^|[\s\W])Colapinto($|[\W\s])/im,
  /(^|[\s\W])Jorge Rial($|[\W\s])/im,
  /(^|[\s\W])Susana Gimenez($|[\W\s])/im,
  /(^|[\s\W])Kicillof($|[\W\s])/im,
  /(^|[\s\W])Macri($|[\W\s])/im,
];
const POLITICAL_PATTERNS = [
  /(^|[\s\W])Malvinas($|[\W\s])/im,
  /(^|[\s\W])conourbano($|[\W\s])/im,
  /(^|[\s\W])Kirchner($|[\W\s])/im,
  /(^|[\s\W])Alberto Fernandez($|[\W\s])/im,
  /(^|[\s\W])Per[óo]nia($|[\W\s])/im,
  /(^|[\s\W])Per[óo]nismo($|[\W\s])/im,
];

export class manager extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  protected PATTERNS = [
    ...MAIN_PATTERNS,
    ...LOCATION_PATTERNS,
    ...PEOPLE_PATTERNS,
    ...POLITICAL_PATTERNS,
  ]
  protected LISTS_ENV = 'ARGENTINA_LISTS'

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
      LOCATION_PATTERNS,
      PEOPLE_PATTERNS,
      POLITICAL_PATTERNS,
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

export const handler = async (ctx, params) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })
  let feed = builder.map((row) => ({ post: row.uri }))
  let cursor: string | undefined
  const last = builder.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }
  return { cursor, feed }
}