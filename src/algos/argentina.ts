import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
export const shortname = 'argentina'

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

export class manager extends AlgoManager {
  public name: string = shortname

  // Define matchPatterns as a class member
  public matchPatterns: RegExp[] = [
    '🇦🇷',
    'Argenti',
    'Argento',
    'Argenta',
    'TwitterArg',
    'Buenos Aires',
    'Malvinas',
    'Maradona',
    'conourbano',
    'Tierra del Fuego',
    'Gualeguaych[úu]',
    'Capital Federal',
    'Puerto Madero',
    'Patagonia',
    'Kirchner',
    'Alberto Fernandez',
    'Milei',
    'Cyberciruj',
    'Lionel Messi',
    'Eva Per[óo]n',
    'Evita Per[óo]n',
    'Domingo Per[óo]n',
    'Juan Per[óo]n',
    'Per[óo]nia',
    'Per[óo]nismo',
    'Jorge Luis Borges',
    'Mercedes Sosa',
    'Carlos Gardel',
    'La Bombonera',
    'Monumental de Nuñez',
    'Casa Rosada',
    'Perito Moreno',
    'San Mart[ií]n de los Andes',
    'Victoria Villarruel',
    'Sergio Massa',
    'Larreta', 
    'Patricia Bullrich',
    'Pato Bullrich',
    'Cris Morena',
    'Spreen',
    'Colapinto',
    'Jorge Rial',
    'Susana Gimenez',
    'Kicillof',
    'Macri',
  ].map(term => new RegExp(`(^|[\\s\\W])${term}($|[\\W\\s])`, 'im'));

  // Include Argentinian users here to always include their posts
  public matchUsers: string[] = [
    //
  ]

  // Exclude posts from these users
  public bannedUsers: string[] = [
    //
  ]

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.author === 'did:plc:mcb6n67plnrlx4lg35natk2b') return false // sorry nowbreezing.ntw.app
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    // Build matchString from post properties
    const matchString = [
      post.embed?.images?.map(image => image.alt).join(' ') ?? '',
      post.embed?.alt ?? '',
      post.embed?.media?.alt ?? '',
      post.tags?.join(' ') ?? '',
      post.text
    ].join(' ');

    const lowerCaseMatchString = matchString.toLowerCase();

    // Combine match checks
    return (
      this.matchPatterns.some(pattern => lowerCaseMatchString.match(pattern))
    );
  }
}
