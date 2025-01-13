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
  private authorList: string[] = []
  public author_collection = 'list_members'
  private blocked_members: string[] = []

  public async start() {
    this.authorList = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )
  }

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
  public matchUsers: string[] = []

  public async periodicTask() {
    dotenv.config()

    await this.db.removeTagFromOldPosts(
      this.name,
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    );

    if (this.authorList === undefined) {
      await this.start()
    }

    const lists: string[] = `${process.env.ARGENTINA_LISTS}`.split('|');
    const listMembersPromises = lists.map(list => getListMembers(list, this.agent));
    const allMembers = await Promise.all(listMembersPromises);
    let list_members = [...new Set(allMembers.flat())];

    // Handle blocked members
    if (process.env.BLOCKLIST) {
      const blockLists: string[] = `${process.env.BLOCKLIST}`.split('|');
      const blockedMembersPromises = blockLists.map(list => getListMembers(list, this.agent));
      const allBlockedMembers = await Promise.all(blockedMembersPromises);
      this.blocked_members = [...new Set(allBlockedMembers.flat())];
    }

    // Fetch all distinct authors in one go
    const db_authors = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    );

    // Use Set for faster lookups
    const authorSet = new Set(db_authors);
    const new_authors = list_members.filter(member => !authorSet.has(member));
    const del_authors = db_authors.filter(member => !list_members.includes(member));

    // Update authorList in one go
    this.authorList = [...list_members];

    // Remove tags for deleted authors in bulk
    if (del_authors.length > 0) {
      await this.db.deleteManyDID(this.author_collection, del_authors);
    }

    // Fetch all posts for new authors in a single call
    const allPostsPromises = new_authors.map(new_author => getPostsForUser(new_author, this.agent));
    let allPosts = await Promise.all(allPostsPromises);

    // Declare bulkOps array to hold operations
    let bulkOps: any[] = [];

    for (const [index, new_author] of new_authors.entries()) {
      const posts = allPosts[index];
      const validPosts = await Promise.all(posts.map(async post => (await this.filter_post(post)) ? post : null));

      // Filter out null values
      const filteredPosts = validPosts.filter(post => post !== null);

      // Prepare bulk operation for author updates
      bulkOps.push({
        updateOne: {
          filter: { did: new_author },
          update: { $set: { did: new_author } },
          upsert: true,
        },
      });
    }

    // Execute bulk operations for posts
    if (bulkOps.length > 0) {
      await this.db.bulkWrite('post', bulkOps);
    }
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (this.agent === null) {
      await this.start();
      if (this.agent === null) return false; // Early return if agent is still null
    }

    // Check if the post author is in the blocked members list
    if (this.blocked_members.includes(post.author)) {
      return false; // Block the post
    }

    // Use Set for faster lookups
    const authorSet = new Set(this.authorList);
    if (authorSet.has(post.author)) {
      return true; // Skip pattern matching for these posts
    }

    // Build matchString from post properties
    const matchString = [
      post.embed?.images?.map(image => image.alt).join(' ') ?? '',
      post.embed?.alt ?? '',
      post.embed?.media?.alt ?? '',
      post.tags?.join(' ') ?? '',
      post.text
    ].join(' ').toLowerCase(); // Convert to lower case once

    // Combine match checks
    return this.matchPatterns.some(pattern => pattern.test(matchString));
  }
}
