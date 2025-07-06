import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { BaseFeedManager } from './BaseFeedManager'
import dotenv from 'dotenv'
import dbClient from '../db/dbClient'

dotenv.config()

export const shortname = 'riodelaplata'

// Argentina patterns first
const ARG_MAIN_PATTERNS = [
  /(^|[\s\W])🇦🇷($|[\W\s])/im,
  /(^|[\s\W])Argenti($|[\W\s])/im,
  /(^|[\s\W])Argento($|[\W\s])/im,
  /(^|[\s\W])Argenta($|[\W\s])/im,
  /(^|[\s\W])Milei($|[\W\s])/im,
  /(^|[\s\W])Cyberciruj($|[\W\s])/im,
  /(^|[\s\W])TwitterArg($|[\W\s])/im,
];
const ARG_LOCATION_PATTERNS = [
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
const ARG_PEOPLE_PATTERNS = [
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
const ARG_POLITICAL_PATTERNS = [
  /(^|[\s\W])Malvinas($|[\W\s])/im,
  /(^|[\s\W])conourbano($|[\W\s])/im,
  /(^|[\s\W])Kirchner($|[\W\s])/im,
  /(^|[\s\W])Alberto Fernandez($|[\W\s])/im,
  /(^|[\s\W])Per[óo]nia($|[\W\s])/im,
  /(^|[\s\W])Per[óo]nismo($|[\W\s])/im,
];
// Uruguay patterns
const URUGUAY_MAIN_PATTERNS = [
  /\b(?!uruguaiana\b)(?:urugua|montevid|charrua|tacuaremb[oó]|paysand[ú]|semana de turismo|semana de la cerveza|daym[áa]n|guaviyú|arapey|🇺🇾|punta del este|yorugua|U R U G U A Y|Jose Mujica|Jos[eé] Mujica|Pepe Mujica|Carolina Cosse|Yamand[uú] Orsi|[aá]lvaro Delgado|Blanca Rodr[ií]guez|Valeria Ripoll|Lacalle Pou|Batllismo|Willsonismo|Herrerismo|Batllista|Willsonista|herrerista|peñarol|Parque Rod[oó])\b/i,
];
const URUGUAY_LOCATION_PATTERNS = [
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
const URUGUAY_PEOPLE_PATTERNS = [
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
const URUGUAY_INSTITUTION_PATTERNS = [
  /\budelar\b/i,
  /\bUniversidad de la rep[uú]blica\b/i,
  /\bcuarteto de nos\b/i,
  /\bVela puerca\b/i,
  /\bJaime Ross\b/i,
  /\bLeo Masliah\b/i,
  /\bcndf\b/i,
  /\bmauricio zunino\b/i,
];
// Rio de la Plata specific patterns
const RIO_PATTERNS = [
  /(^|[\s\W])Rio de la Plata($|[\W\s])/im,
  /(^|[\s\W])dulce de leche($|[\W\s])/im,
  /(^|[\s\W])carpincho($|[\W\s])/im,
  /(^|[\s\W])🧉($|[\W\s])/im,
];

export class manager extends BaseFeedManager {
  public name = shortname;
  public author_collection = 'list_members';
  protected PATTERNS = [
    ...ARG_MAIN_PATTERNS,
    ...ARG_LOCATION_PATTERNS,
    ...ARG_PEOPLE_PATTERNS,
    ...ARG_POLITICAL_PATTERNS,
    ...URUGUAY_MAIN_PATTERNS,
    ...URUGUAY_LOCATION_PATTERNS,
    ...URUGUAY_PEOPLE_PATTERNS,
    ...URUGUAY_INSTITUTION_PATTERNS,
    ...RIO_PATTERNS,
  ];
  protected LISTS_ENV = 'RIO_DE_LA_PLATA_LISTS';

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
      ARG_MAIN_PATTERNS,
      ARG_LOCATION_PATTERNS,
      ARG_PEOPLE_PATTERNS,
      ARG_POLITICAL_PATTERNS,
      URUGUAY_MAIN_PATTERNS,
      URUGUAY_LOCATION_PATTERNS,
      URUGUAY_PEOPLE_PATTERNS,
      URUGUAY_INSTITUTION_PATTERNS,
      RIO_PATTERNS,
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

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  });
  let feed = builder.map((row) => ({ post: row.uri }));
  let cursor: string | undefined;
  const last = builder.at(-1);
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`;
  }
  return { cursor, feed };
};
