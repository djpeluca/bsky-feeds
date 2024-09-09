import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

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

  public matchPatterns: RegExp[] = [
    /(?!uruguaiana)(?:urugua|uruguash|montevid|charrua|🇺🇾|punta del este|yorugua|U R U G U A Y|eleccionesuy|udelar|Jose Mujica|José Mujica|Pepe Mujica|Carolina Cosse|Yamandu Orsi|Yamandú Orsi|Álvaro Delgado|Alvaro Delgado|Batlle|Lacalle Pou|peñarol|Parque Rodó|Parque Rodo|chivito|)\w*/gi,
  ]

  // Include Uruguayan users here to always include their posts
  public matchUsers: string[] = [
    //
  ]

  // Exclude posts from these users
  public bannedUsers: string[] = [
    //
  ]

  /*public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }*/

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

    matchString = `${post.text} ${matchString}`.replace('\n', ' ')

    this.matchPatterns.forEach((pattern) => {
      if (matchString.match(pattern) !== null) {
        match = true
      }
    })

    this.matchUsers.forEach((user) => {
      if (matchString.match(user) !== null) {
        match = true
      }
    })

    // commenting it because of rate limits
    // const details = await getUserDetails(post.author, this.agent)
    // matchDescription = `${details.description} ${details.displayName}`.replace('\n', ' ')

   // this.matchPatterns.forEach((pattern) => {
   //   if (matchDescription.match(pattern) !== null) {
   //     match = true
   //   }
   // })

    return match
  }
}
