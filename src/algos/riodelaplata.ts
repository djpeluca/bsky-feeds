import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

dotenv.config()

// max 15 chars
export const shortname = 'riodelaplata'

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

  public matchPatterns: RegExp[] = [
    /(?!uruguaiana)(?:urugua|uruguash|montevid|charrua|🇺🇾|punta del este|yorugua|U R U G U A Y|eleccionesuy|Jose Mujica|Jos[eé] Mujica|Pepe Mujica|Carolina Cosse|Yamandu Orsi|Yamand[uú] Orsi|[aá]lvaro Delgado|Blanca Rodriguez|Blanca Rodr[ií]guez|Alvaro Delgado|Valeria Ripoll|Lacalle Pou|Batllismo|Willsonismo|Herrerismo|Batllista|Willsonista|herrerista|peñarol|Parque Rod[oó]|Parque Rodo|chivito)\w*/,
    /(^|[\s\W])Colonia del Sacramento($|[\W\s])/im,
    /(^|[\s\W])Cabo Polonio($|[\W\s])/im,
    /(^|[\s\W])Piri[aá]polis($|[\W\s])/im,
    /(^|[\s\W])Valizas($|[\W\s])/im,
    /(^|[\s\W])Aguas Dulces($|[\W\s])/im,
    /(^|[\s\W])Laguna Garz[oó]n($|[\W\s])/im,
    /(^|[\s\W])Ciudad Vieja($|[\W\s])/im,
    /(^|[\s\W])Mercado del Puerto($|[\W\s])/im,
    /(^|[\s\W])Rambla de Montevideo($|[\W\s])/im,
    /(^|[\s\W])Cerro San Antonio($|[\W\s])/im,
    /(^|[\s\W])Termas del Daym[aá]n($|[\W\s])/im,
    /(^|[\s\W])Salto Grande($|[\W\s])/im,
    /(^|[\s\W])Pocitos($|[\W\s])/im,
    /(^|[\s\W])Punta Carretas($|[\W\s])/im,
    /(^|[\s\W])Malv[ií]n($|[\W\s])/im,
    /(^|[\s\W])Carrasco($|[\W\s])/im,
    /(^|[\s\W])Capurro($|[\W\s])/im,
    /(^|[\s\W])Villa Española($|[\W\s])/im,
    /(^|[\s\W])Tres Cruces($|[\W\s])/im,
    /(^|[\s\W])Barrio Sur($|[\W\s])/im,
    /(^|[\s\W])Bañados de Carrasco($|[\W\s])/im,
    /(^|[\s\W])Casab[oó]($|[\W\s])/im,
    /(^|[\s\W])Paso de la Arena($|[\W\s])/im,
    /(^|[\s\W])Col[oó]n($|[\W\s])/im,
    /(^|[\s\W])Sayago($|[\W\s])/im,
    /(^|[\s\W])Jacinto Vera($|[\W\s])/im,
    /(^|[\s\W])Villa Dolores($|[\W\s])/im,
    /(^|[\s\W])Piedras Blancas($|[\W\s])/im,
    /(^|[\s\W])Las Acacias($|[\W\s])/im,
    /(^|[\s\W])Nuevo Par[ií]s($|[\W\s])/im,
    /(^|[\s\W])Flor de Maroñas($|[\W\s])/im,
    /(^|[\s\W])Cerrito de la Victoria($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Gervasio Artigas($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Enrique Rod[oó]($|[\W\s])/im,
    /(^|[\s\W])Juana de Ibarbourou($|[\W\s])/im,
    /(^|[\s\W])Mario Benedetti($|[\W\s])/im,
    /(^|[\s\W])Eduardo Galeano($|[\W\s])/im,
    /(^|[\s\W])Luis Su[aá]rez($|[\W\s])/im,
    /(^|[\s\W])Edinson Cavani($|[\W\s])/im,
    /(^|[\s\W])Diego Forl[aá]n($|[\W\s])/im,
    /(^|[\s\W])[oó]scar Tab[aá]rez($|[\W\s])/im,
    /(^|[\s\W])Enzo Francescoli($|[\W\s])/im,
    /(^|[\s\W])Alfredo Zitarrosa($|[\W\s])/im,
    /(^|[\s\W])Carlos Gardel($|[\W\s])/im,
    /(^|[\s\W])Rub[eé]n Rada($|[\W\s])/im,
    /(^|[\s\W])Jorge Drexler($|[\W\s])/im,
    /(^|[\s\W])China Zorrilla($|[\W\s])/im,
    /(^|[\s\W])Daniel Hendler($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Mujica($|[\W\s])/im,
    /(^|[\s\W])Tabar[eé] V[aá]zquez($|[\W\s])/im,
    /(^|[\s\W])Luis Lacalle Pou($|[\W\s])/im,
    /(^|[\s\W])Julio Mar[ií]a Sanguinetti($|[\W\s])/im,
    /(^|[\s\W])#Balotaje2024($|[\W\s])/im,
    /(^|[\s\W])#UruguayDecide($|[\W\s])/im,
    /(^|[\s\W])#BalotajeUy($|[\W\s])/im,
    /(^|[\s\W])#OrsiPresidente($|[\W\s])/im,
    /(^|[\s\W])ñeri($|[\W\s])/im,
    /(^|[\s\W])nieri($|[\W\s])/im,
    /(^|[\s\W])Level Uy($|[\W\s])/im,
    /(^|[\s\W])Argent($|[\W\s])/im,
    /(^|[\s\W])Buenos Aires($|[\W\s])/im,
    /(^|[\s\W])Malvinas($|[\W\s])/im,
    /(^|[\s\W])Maradona($|[\W\s])/im,
    /(^|[\s\W])Maradonian($|[\W\s])/im,
    /(^|[\s\W])Puerto Madero($|[\W\s])/im,
    /(^|[\s\W])Patagonia($|[\W\s])/im,
    /(^|[\s\W])Kirchner($|[\W\s])/im,
    /(^|[\s\W])CFK($|[\W\s])/im,
    /(^|[\s\W])Alberto Fernandez($|[\W\s])/im,
    /(^|[\s\W])Milei($|[\W\s])/im,
    /(^|[\s\W])Cyberciruja($|[\W\s])/im,
    /(^|[\s\W])Paysand[uú]($|[\W\s])/im,
    /(^|[\s\W])Artigas($|[\W\s])/im,
    /(^|[\s\W])Rio de la Plata($|[\W\s])/im,
    /(^|[\s\W])dulce de leche($|[\W\s])/im,
    /(^|[\s\W])carpincho($|[\W\s])/im,
    /(^|[\s\W])🧉($|[\W\s])/im,
  ]

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

    let match = false

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
