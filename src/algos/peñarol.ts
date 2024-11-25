import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'
import { AppBskyGraphDefs } from '@atproto/api'

dotenv.config()

// max 15 chars
export const shortname = 'peñarol'

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
    /(^|[\s\W])Leonardo Fern[aá]ndez L[oó]pez($|[\W\s])/im,
    /(^|[\s\W])Washington Aguerre($|[\W\s])/im,
    /(^|[\s\W])Matheus Babi($|[\W\s])/im,
    /(^|[\s\W])Dami[aá]n Su[aá]rez($|[\W\s])/im,
    /(^|[\s\W])Jaime B[aá]ez($|[\W\s])/im,
    /(^|[\s\W])Maximiliano Silvera($|[\W\s])/im,
    /(^|[\s\W])Facundo Batista($|[\W\s])/im,
    /(^|[\s\W])Rodrigo P[eé]rez Casada($|[\W\s])/im,
    /(^|[\s\W])Alan Medina Silva($|[\W\s])/im,
    /(^|[\s\W])Guzm[aá]n Rodr[ií]guez($|[\W\s])/im,
    /(^|[\s\W])Gast[oó]n Ram[ií]rez($|[\W\s])/im,
    /(^|[\s\W])Javier Cabrera($|[\W\s])/im,
    /(^|[\s\W])Nahuel Acosta($|[\W\s])/im,
    /(^|[\s\W])Felipe Avenatti($|[\W\s])/im,
    /(^|[\s\W])[oó]scar Javier M[eé]ndez($|[\W\s])/im,
    /(^|[\s\W])Lucas Hern[aá]ndez Perdomo($|[\W\s])/im,
    /(^|[\s\W])Eduardo Darias($|[\W\s])/im,
    /(^|[\s\W])Maximiliano Olivera($|[\W\s])/im,
    /(^|[\s\W])Leonardo Sequeira($|[\W\s])/im,
    /(^|[\s\W])Guillermo de Amores($|[\W\s])/im,
    /(^|[\s\W])Pedro Milans($|[\W\s])/im,
    /(^|[\s\W])Leonardo Henriques Coelho($|[\W\s])/im,
    /(^|[\s\W])Adri[aá]n Marcos Fern[aá]ndez($|[\W\s])/im,
    /(^|[\s\W])Diego Sosa($|[\W\s])/im,
    /(^|[\s\W])Nahuel Herrera($|[\W\s])/im,
    /(^|[\s\W])Camilo Mayada($|[\W\s])/im,
    /(^|[\s\W])Sebasti[aá]n Crist[oó]foro($|[\W\s])/im,
    /(^|[\s\W])Tom[aá]s Olase Curutchet($|[\W\s])/im,
    /(^|[\s\W])Ignacio Sosa($|[\W\s])/im,
    /(^|[\s\W])Germ[aá]n Barbas D[ií]az($|[\W\s])/im,
    /(^|[\s\W])Nicol[aá]s Rossi($|[\W\s])/im,
    /(^|[\s\W])Kevin Mario Morgan Michelena($|[\W\s])/im,
    /(^|[\s\W])Mart[ií]n Gianoli($|[\W\s])/im,
    /(^|[\s\W])Edison Luciano Gonz[aá]lez Ribeiro($|[\W\s])/im,
    /(^|[\s\W])Nahuel de Armas Fajardo($|[\W\s])/im,
    /(^|[\s\W])Santiago Miguel Ben[ií]tez Hegui($|[\W\s])/im,
    /(^|[\s\W])Sergio Dami[aá]n Garc[ií]a Graña($|[\W\s])/im,
    /(^|[\s\W])Peñarol($|[\W\s])/im,
    /(^|[\s\W])Carbonero($|[\W\s])/im,
    /(^|[\s\W])Manyas($|[\W\s])/im,
    /(^|[\s\W])Mirasoles($|[\W\s])/im,
    /(^|[\s\W])Aurinegro($|[\W\s])/im,
    /(^|[\s\W])Campe[oó]n del Siglo($|[\W\s])/im,
    /(^|[\s\W])oficialcap($|[\W\s])/im,
    /(^|[\s\W])Magallanes 1721($|[\W\s])/im,
    /(^|[\s\W])N[eé]stor Goncalves($|[\W\s])/im,
    /(^|[\s\W])Tito Goncalves($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Piendibene($|[\W\s])/im,
    /(^|[\s\W])William Mart[ií]nez($|[\W\s])/im,
    /(^|[\s\W])Walter Olivera($|[\W\s])/im,
    /(^|[\s\W])Indio Olivera($|[\W\s])/im,
    /(^|[\s\W])Eduardo Pereira($|[\W\s])/im,
    /(^|[\s\W])Luis Maidana($|[\W\s])/im,
    /(^|[\s\W])Antonio Pacheco($|[\W\s])/im,
    /(^|[\s\W])Ladislao Mazurkiewicz($|[\W\s])/im,
    /(^|[\s\W])John Harley($|[\W\s])/im,
    /(^|[\s\W])Juan Pena($|[\W\s])/im,
    /(^|[\s\W])Juan Legnazzi($|[\W\s])/im,
    /(^|[\s\W])Pablo Terevinto($|[\W\s])/im,
    /(^|[\s\W])Isabelino Grad[ií]n($|[\W\s])/im,
    /(^|[\s\W])Leonard Crossley($|[\W\s])/im,
    /(^|[\s\W])Aniceto Camacho($|[\W\s])/im,
    /(^|[\s\W])Lorenzo Fern[aá]ndez($|[\W\s])/im,
    /(^|[\s\W])Alvaro Gestido($|[\W\s])/im,
    /(^|[\s\W])Juan Delgado($|[\W\s])/im,
    /(^|[\s\W])Juan Pelegrin Anselmo($|[\W\s])/im,
    /(^|[\s\W])Jorge Pacheco($|[\W\s])/im,
    /(^|[\s\W])Julio Negr[oó]n($|[\W\s])/im,
    /(^|[\s\W])William Davis($|[\W\s])/im,
    /(^|[\s\W])John Woosey($|[\W\s])/im,
    /(^|[\s\W])John Mac Gregor($|[\W\s])/im,
    /(^|[\s\W])Thomas Lewis($|[\W\s])/im,
    /(^|[\s\W])Maquinita Lewis($|[\W\s])/im,
    /(^|[\s\W])Enrique Ballestero($|[\W\s])/im,
    /(^|[\s\W])Ernesto Mascheroni($|[\W\s])/im,
    /(^|[\s\W])Braulio Castro($|[\W\s])/im,
    /(^|[\s\W])Severino Varela($|[\W\s])/im,
    /(^|[\s\W])Antonio Campolo($|[\W\s])/im,
    /(^|[\s\W])Sixto Possamai($|[\W\s])/im,
    /(^|[\s\W])Juan Carlos Gonz[aá]lez($|[\W\s])/im,
    /(^|[\s\W])Ernesto Vidal($|[\W\s])/im,
    /(^|[\s\W])Patrullero Vidal($|[\W\s])/im,
    /(^|[\s\W])[oó]scar Chirimini($|[\W\s])/im,
    /(^|[\s\W])Roque Gast[oó]n M[aá]spoli($|[\W\s])/im,
    /(^|[\s\W])Luis Prais($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Mar[ií]a Ortiz($|[\W\s])/im,
    /(^|[\s\W])Flavio Pereyra Nattero($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Antonio V[aá]zquez($|[\W\s])/im,
    /(^|[\s\W])Ra[uú]l Schaffino($|[\W\s])/im,
    /(^|[\s\W])Domingo Gelpi($|[\W\s])/im,
    /(^|[\s\W])Nicol[aá]s Falero($|[\W\s])/im,
    /(^|[\s\W])[oó]scar Omar M[ií]guez($|[\W\s])/im,
    /(^|[\s\W])Alcides Edgardo Ghiggia($|[\W\s])/im,
    /(^|[\s\W])Juan Eduardo Hohberg($|[\W\s])/im,
    /(^|[\s\W])Jardín de infantes 356($|[\W\s])/im,
    /(^|[\s\W])Atahualpa del Cioppo($|[\W\s])/im,
    /(^|[\s\W])Escuela 258($|[\W\s])/im,
    /(^|[\s\W])Juan Bautista Crosa de Pinerolo($|[\W\s])/im,
    /(^|[\s\W])Aparicio Saravia 4683($|[\W\s])/im,
    /(^|[\s\W])Barra Amsterdam($|[\W\s])/im,
    /(^|[\s\W])Fernando Morena($|[\W\s])/im,
    /(^|[\s\W])Pablo Bengoechea($|[\W\s])/im,
    /(^|[\s\W])Obdulio Varela($|[\W\s])/im,
    /(^|[\s\W])Walter Olivera($|[\W\s])/im,
    /(^|[\s\W])padre y decano($|[\W\s])/im,
    /(^|[\s\W])padreydecano($|[\W\s])/im,
    /(^|[\s\W])Diego Aguirre($|[\W\s])/im,
  ]

  // Include Peñarol users here to always include their posts
  public matchUsers: string[] = []

  // Exclude posts from these users
  public bannedUsers: string[] = [
    //
  ]

  public async fetchListMembers(uri: string) {
    let cursor: string | undefined
    let members: AppBskyGraphDefs.ListItemView[] = []

    do {
      const res = await this.agent.app.bsky.graph.getList({
        list: uri,
        limit: 150,
        cursor,
      })
      cursor = res.data.cursor
      members = members.concat(res.data.items)
    } while (cursor)

    this.matchUsers = members.map(member => member.subject.did)
  }

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let match = false
    let matchString = ''
    let matchDescription = ''
    
    if (post.embed?.images) {
      const imagesArr = post.embed.images
      imagesArr.forEach((image) => {
        matchString = `${matchString} ${image.alt}`.replace('\n', ' ')
      })
    }

    if (post.embed?.alt) {
      matchString = `${matchString} ${post.embed.alt}`.replace('\n', ' ')
    }

    if (post.embed?.media?.alt) {
      matchString = `${matchString} ${post.embed?.media?.alt}`.replace(
        '\n',
        ' ',
      )
    }

    if (post.tags) {
      matchString = `${post.tags.join(' ')} ${matchString}`
    }

    matchString = `${post.text} ${matchString}`.replace('\n', ' ')

    let lowerCaseMatchString = matchString.toLowerCase();
    let lowerCaseMatchDescription = matchDescription.toLowerCase();

    this.matchPatterns.forEach((pattern) => {
      if (lowerCaseMatchString.match(pattern) !== null) {
        match = true;
      }
    });

    if (this.matchUsers.includes(post.author)) {
      match = true;
    }
     // commenting it because of rate limits
    // const details = await getUserDetails(post.author, this.agent)
    // matchDescription = `${details.description} ${details.displayName}`.replace('\n', ' ')

    this.matchPatterns.forEach((pattern) => {
      if (lowerCaseMatchDescription.match(pattern) !== null) {
        match = true;
      }
    });

    return match
  }
}
