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

dotenv.config()

// max 15 chars
export const shortname = 'uruguay'

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
  private authorList: string[] = []
  public author_collection = 'list_members'

  public async start() {
    this.authorList = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )
  }

  public matchPatterns: RegExp[] = [
    /(^|[\s\W])Uruguay($|[\W\s])/im,
    /(^|[\s\W])Montevideo($|[\W\s])/im,
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
    /(^|[\s\W])Capurro($|[\W\s])/im,
    /(^|[\s\W])Villa Española($|[\W\s])/im,
    /(^|[\s\W])Tres Cruces($|[\W\s])/im,
    /(^|[\s\W])Barrio Sur($|[\W\s])/im,
    /(^|[\s\W])Bañados de Carrasco($|[\W\s])/im,
    /(^|[\s\W])Casab[oó]($|[\W\s])/im,
    /(^|[\s\W])Paso de la Arena($|[\W\s])/im,
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
    /(^|[\s\W])Orsi($|[\W\s])/im,
    /(^|[\s\W])Yamand[úu]($|[\W\s])/im,
    /(^|[\s\W])udelar($|[\W\s])/im,
    /(^|[\s\W])Universidad de la rep[uú]blica]($|[\W\s])/im,
    /(^|[\s\W])cuarteto de nos($|[\W\s])/im,
    /(^|[\s\W])Vela puerca($|[\W\s])/im,
    /(^|[\s\W])Jaime Ross($|[\W\s])/im,
    /(^|[\s\W])Leo Masliah($|[\W\s])/im,
    /(^|[\s\W])cndf($|[\W\s])/im,
    /(^|[\s\W])Antel($|[\W\s])/im,
    /(^|[\s\W])Sodre($|[\W\s])/im,
    /(^|[\s\W])Frente Amplio($|[\W\s])/im,
    /(^|[\s\W])FrenteAmplio($|[\W\s])/im,
    /(^|[\s\W])La celeste($|[\W\s])/im,
  ]

  // Include Uruguayan users here to always include their posts
  public matchUsers: string[] = []

  // Exclude posts from these users
  public bannedUsers: string[] = [
    //
  ]

  public async periodicTask() {
    dotenv.config()

    await this.db.removeTagFromOldPosts(
      this.name,
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    )

    if (this.authorList === undefined) {
      console.log(`${this.name}: Initialising authors from database`)
      await this.start()
    }

    const lists: string[] = `${process.env.URUGUAY_LISTS}`.split('|')
    const listMembersPromises = lists.map(list => getListMembers(list, this.agent))
    const allMembers = await Promise.all(listMembersPromises)
    let list_members = [...new Set(allMembers.flat())]

    // Handle blocked members
    if (process.env.BLOCKLIST) {
      const blocked_members: string[] = await getListMembers(
        process.env.BLOCKLIST,
        this.agent,
      )
      list_members = list_members.filter(member => !blocked_members.includes(member))
    }

    const db_authors = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )

    // Combine new and deleted authors in one go
    const new_authors = list_members.filter(member => !db_authors.includes(member))
    const del_authors = db_authors.filter(member => !list_members.includes(member))

    // Update authorList in one go
    this.authorList = [...list_members]

    // Define the type for bulk operations
    const bulkOps: { updateMany?: any; updateOne?: any }[] = [];

    // Remove tags for deleted authors
    if (del_authors.length > 0) {
      bulkOps.push({
        updateMany: {
          filter: { author: { $in: del_authors } },
          update: { $pull: { algoTags: this.name } }
        }
      })
    }

    // Fetch all posts for new authors in a single call
    const allPostsPromises = new_authors.map(new_author => getPostsForUser(new_author, this.agent))
    const allPosts = await Promise.all(allPostsPromises)

    for (const [index, new_author] of new_authors.entries()) {
      const posts = allPosts[index]
      const validPosts = await Promise.all(posts.map(async post => (await this.filter_post(post)) ? post : null))

      // Filter out null values
      const filteredPosts = validPosts.filter(post => post !== null)

      for (const post of filteredPosts) {
        const existing = await this.db.getPostForURI(post.uri)
        post.algoTags = existing ? [...new Set([...existing.algoTags, this.name])] : [this.name]

        // Prepare bulk update for posts
        bulkOps.push({
          updateOne: {
            filter: { uri: post.uri },
            update: { $set: post },
            upsert: true // Insert if not found
          }
        })
      }

      // Prepare bulk operation for new authors
      bulkOps.push({
        updateOne: {
          filter: { did: new_author },
          update: { $set: { did: new_author } },
          upsert: true // Insert if not found
        }
      })
    }

    // Execute bulk operations
    if (bulkOps.length > 0) {
      await this.db.collection('post').bulkWrite(bulkOps)
    }

    // Delete authors in one go
    if (del_authors.length > 0) {
      await this.db.deleteManyDID(this.author_collection, del_authors)
    }
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (this.agent === null) {
      await this.start();
      if (this.agent === null) return false; // Early return if agent is still null
    }

    // Check if the post's author is in the cached authorList
    if (this.authorList.includes(post.author)) {
      return true; // Skip pattern matching for these posts
    }

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
      this.matchPatterns.some(pattern => lowerCaseMatchString.match(pattern)) ||
      this.authorList.includes(post.author)
    );
  }
}
