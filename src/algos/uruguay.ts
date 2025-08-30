import { BaseFeedManager } from './BaseFeedManager'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import setListMembers from '../addn/setListMembers'
import getPostsForUser from '../addn/getPostsForUser'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'
import { AppBskyGraphDefs } from '@atproto/api'
import getUserLists from '../addn/getUserLists'
import { safeAddToSet } from '../util/safeAddToSet'

dotenv.config()

// max 15 chars
export const shortname = 'uruguay'

// Main Uruguay pattern(s)
const MAIN_PATTERNS = [
  /\b(?!uruguaiana\b)(?:urugua|montevid|charrua|tacuaremb[oó]|paysand[ú]|semana de turismo|semana de la cerveza|daym[áa]n|guaviyú|arapey|🇺🇾|punta del este|yorugua|U R U G U A Y|Jose Mujica|Jos[eé] Mujica|Pepe Mujica|Carolina Cosse|Yamand[uú] Orsi|[aá]lvaro Delgado|Blanca Rodr[ií]guez|Valeria Ripoll|Lacalle Pou|Batllismo|Willsonismo|Herrerismo|Batllista|Willsonista|herrerista|peñarol|Parque Rod[oó])\b/i,
];
const LOCATION_PATTERNS = [
  /\bColonia del Sacramento\b/i,
  /\bCabo Polonio\b/i,
  /\bPiri[aá]polis\b/i,
  /\bValizas\b/i,
  /\bAguas Dulces\b/i,
  /\bLaguna Garz[oó]n\b/i,
  /\bMercado del Puerto\b/i,
  /\bCerro San Antonio\b/i,
  /\bTermas del Daym[aá]n\b/i,
  /\bSalto Grande\b/i,
  /\bPocitos\b/i,
  /\bPunta Carretas\b/i,
  /\bMalv[ií]n\b/i,
  /\bVilla Española\b/i,
  /\bBañados de Carrasco\b/i,
  /\bCasab[oó]\b/i,
  /\bPaso de la Arena\b/i,
  /\bJacinto Vera\b/i,
  /\bVilla Dolores\b/i,
  /\bLas Acacias\b/i,
  /\bNuevo Par[ií]s\b/i,
  /\bFlor de Maroñas\b/i,
  /\bCerrito de la Victoria\b/i,
];
const PEOPLE_PATTERNS = [
  /\bJos[eé] Gervasio Artigas\b/i,
  /\bJos[eé] Enrique Rod[oó]\b/i,
  /\bJuana de Ibarbourou\b/i,
  /\bMario Benedetti\b/i,
  /\bEduardo Galeano\b/i,
  /\bLuis Su[aá]rez\b/i,
  /\bEdinson Cavani\b/i,
  /\bDiego Forl[aá]n\b/i,
  /\b[oó]scar Tab[aá]rez\b/i,
  /\bEnzo Francescoli\b/i,
  /\bAlfredo Zitarrosa\b/i,
  /\bCarlos Gardel\b/i,
  /\bRub[eé]n Rada\b/i,
  /\bJorge Drexler\b/i,
  /\bChina Zorrilla\b/i,
  /\bFede [aá]lvarez\b/i,
  /\bFede Vigevani\b/i,
  /\bDaniel Hendler\b/i,
  /\bJos[eé] Mujica\b/i,
  /\bTabar[eé] V[aá]zquez\b/i,
  /\bLuis Lacalle Pou\b/i,
  /\bJulio Mar[ií]a Sanguinetti\b/i,
];
const INSTITUTION_PATTERNS = [
  /\budelar\b/i,
  /\bUniversidad de la rep[uú]blica\b/i,
  /\bcuarteto de nos\b/i,
  /\bVela puerca\b/i,
  /\bJaime Ross\b/i,
  /\bLeo Masliah\b/i,
  /\bcndf\b/i,
  /\bmauricio zunino\b/i,
];

// Change the class name from 'manager' to 'managerClass' to avoid naming conflict
class managerClass extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  protected PATTERNS = [
    ...MAIN_PATTERNS,
    ...LOCATION_PATTERNS,
    ...PEOPLE_PATTERNS,
    ...INSTITUTION_PATTERNS,
  ]
  protected LISTS_ENV = 'URUGUAY_LISTS'

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
      INSTITUTION_PATTERNS,
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

export const manager = new managerClass({} as any, {} as any);

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