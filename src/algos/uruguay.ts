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
  public authorList: string[]
  public author_collection = 'list_members'

  public async start() {
    this.authorList = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )
  }

  public matchTerms: string[] = [
    '🇺🇾',
    '#Uruguay',
    'URUGUAY',
    'uruguay',
    'Uruguay',
    'Uruguai',
    'Uruguaya',
    'Uruguayo',
    'Uruguayas',
    'Uruguayos',
    'uruguayo',
    'uruguaya',
    'Uruguayan',
    'uruguayan',
    'Uruguayans',
    'Montevideo',
    'montevideo',
    'Montevideano',
    'Montevideana',
    'montevideano',
    'montevideana',
    'Charrua',
    'Charr[uú]a',
    'charrua',
    'punta del este',
    'Punta del Este',
    'Paysand[uú]',
    'Artigas',
    'yorugua',
    'U R U G U A Y'
  ]

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
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )

    if (this.authorList === undefined) {
      console.log(`${this.name}: Initialising authors from database`)
      await this.start()
    }

    const lists: string[] = `${process.env.URUGUAY_LISTS}`.split('|')

    if (process.env.SCIENCE_RECURSE === 'true') {
      const list_owners: string[] = []

      for (const list of lists) {
        const members = await getListMembers(list, this.agent)
        members.forEach((member) => {
          if (!list_owners.includes(member)) list_owners.push(member)
        })
      }
      for (const owner of list_owners) {
        const owner_lists = await getUserLists(owner, this.agent)
        const owner_name = await resoveDIDToHandle(owner, this.agent)
        owner_lists.forEach((list) => {
          if (list.name.includes(`${process.env.SCIENCE_SYMBOL}`)) {
            console.log(
              `${this.name}: Adding ${list.name} (${owner_name}) to lists`,
            )
            lists.push(list.atURL)
          }
        })
      }
    }

    console.log(`${this.name}: Watching ${lists.length} lists`)

    let list_members: string[] = []

    for (let i = 0; i < lists.length; i++) {
      const members = await getListMembers(lists[i], this.agent)
      members.forEach((member) => {
        if (!list_members.includes(member)) list_members.push(member)
      })
    }

    if (process.env.BLOCKLIST) {
      const blocked_members: string[] = await getListMembers(
        process.env.BLOCKLIST,
        this.agent,
      )
      list_members = list_members.filter((member) => {
        return !blocked_members.includes(member)
      })
    }

    const db_authors = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )

    const new_authors = list_members.filter((member) => {
      return !db_authors.includes(member)
    })
    const del_authors = db_authors.filter((member) => {
      return !list_members.includes(member)
    })

    console.log(
      `${this.name}: Watching ${db_authors.length} + ${new_authors.length} - ${del_authors.length} = ${list_members.length} authors`,
    )

    this.authorList = [...list_members]

    await dbClient.removeTagFromPostsForAuthor(this.name, del_authors)

    for (let i = 0; i < new_authors.length; i++) {
      process.stdout.write(`${this.name}: ${i + 1} of ${new_authors.length}: `)
      const all_posts = await getPostsForUser(new_authors[i], this.agent)

      const posts: Post[] = []

      for (let i = 0; i < all_posts.length; i++) {
        if ((await this.filter_post(all_posts[i])) == true) {
          posts.push(all_posts[i])
        }
      }

      posts.forEach(async (post) => {
        const existing = await this.db.getPostForURI(post.uri)
        if (existing === null) {
          post.algoTags = [this.name]
          await this.db.replaceOneURI('post', post.uri, post)
        } else {
          const tags = [...new Set([...existing.algoTags, this.name])]
          post.algoTags = tags
          await this.db.replaceOneURI('post', post.uri, post)
        }
      })

      await this.db.replaceOneDID(this.author_collection, new_authors[i], {
        did: new_authors[i],
      })
    }

    del_authors.forEach(async (author) => {
      if (this.agent !== null)
        console.log(
          `${this.name}: Removing ${await resoveDIDToHandle(
            author,
            this.agent,
          )}`,
        )
      await this.db.deleteManyDID(this.author_collection, [author])
    })
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

    this.matchPatterns.forEach((pattern) => {
      if (lowerCaseMatchString.match(pattern) !== null) {
        match = true;
      }
    });

    // Convert matchTerms to lowercase for comparison
    this.matchTerms.forEach((term) => {
      if (lowerCaseMatchString.includes(term.toLowerCase())) {
        match = true;
      }
    });

    if (this.matchUsers.includes(post.author)) {
      match = true;
    }
     // commenting it because of rate limits
    // const details = await getUserDetails(post.author, this.agent)
    // matchDescription = `${details.description} ${details.displayName}`.replace('\n', ' ')

    this.matchTerms.forEach((term) => {
      if (matchDescription.match(term) !== null) {
        match = true;
      }
    });

    if (this.authorList.includes(post.author)) {
      match = true;
    }

    return match
  }
}
