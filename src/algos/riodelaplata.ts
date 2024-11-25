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

  public matchTerms: string[] = [
    '🇦🇷',
    '#Argentina',
    '#TwitterArg',
    '#Twitterarg',
    '#twitterarg',
    'Argentina',
    'Argentino',
    'Argentine',
    'Argenta',
    'Argentinas',
    'Argentinos',
    'Argentinian',
    'Argentinians',
    'Buenos Aires',
    'Malvinas',
    'Maradona',
    'Maradonian',
    'Puerto Madero',
    'Patagonia',
    'Cristina Kirchner',
    'Alberto Fernandez',
    'Milei',
    'Cyberciruja',
    '🇺🇾',
    '#Uruguay',
    'Uruguay',
    'Uruguai',
    'Uruguaya',
    'Uruguayo',
    'Uruguayas',
    'Uruguayos',
    'Uruguayan',
    'Uruguayans',
    'Montevideo',
    'Punta del Este',
    'Paysandu',
    'Paysandú',
    'Artigas',
    'Rio de la Plata',
    'dulce de leche',
    'carpincho',
    '🧉',
  ]

  public matchPatterns: RegExp[] = [
    /(^|[\s\W])Uruguay($|[\W\s])/im,
    /(^|[\s\W])Argentina($|[\W\s])/im,
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

    this.matchPatterns.forEach((pattern) => {
      if (matchString.match(pattern) !== null) {
        match = true
      }
    })

    this.matchTerms.forEach((term) => {
      if (matchString.match(term) !== null) {
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

    this.matchTerms.forEach((term) => {
      if (matchDescription.match(term) !== null) {
        match = true
      }
    })

    // Fetch list members to check against post authors
    const uri = 'at://did:plc:jupasj2qzpxnulq2xa7evmmh/app.bsky.graph.list/3kdknibmw3q2f'; // Replace with your actual list URI
    let members: AppBskyGraphDefs.ListItemView[] = [];

    console.log(`Starting to fetch members from the list at URI: ${uri}`); // Log the start of fetching

    const res = await this.agent.app.bsky.graph.getList({
      list: uri,
      limit: 150, // Adjust the limit as needed
    }) as unknown as { items: AppBskyGraphDefs.ListItemView[] };

    // Log each member being added
    res.items.forEach(member => {
      console.log(`Adding member: ${member.subject.did}`); // Log each member's ID
    });

    members = res.items; // Directly assign the fetched items to members

    console.log(`Finished fetching members. Total members retrieved: ${members.length}`); // Log the end of fetching

    const memberIds = members.map(member => member.subject); // Extract user IDs from members

    // Check if the post author is in the list of members
    if (members.some(member => member.subject.did === post.author)) {
      console.log(`Match found: Author ${post.author} is a member of the list.`); // Log when a match is found
      match = true; // Match if the author is a member
    }

    return match
  }
}
