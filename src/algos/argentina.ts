import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton';
import { AppContext } from '../config';
import { AlgoManager } from '../addn/algoManager';
import dotenv from 'dotenv';
import getListMembers from '../addn/getListMembers';
import getPostsForUser from '../addn/getPostsForUser';
import dbClient from '../db/dbClient';
import { Post } from '../db/schema';

dotenv.config();

// max 15 chars
export const shortname = 'argentina';

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  });

  let feed = builder.map((row) => ({
    post: row.uri,
  }));

  let cursor;
  const last = builder.at(-1);
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`;
  }

  return {
    cursor,
    feed,
  };
};

export class manager extends AlgoManager {
  public name: string = shortname;
  private authorList: Set<string> = new Set();
  public author_collection = 'list_members';
  private blocked_members: Set<string> = new Set();

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
  ].map((term) => new RegExp(`(^|[\s\W])${term}($|[\W\s])`, 'im'));

  public async start() {
    const authors = await dbClient.getDistinctFromCollection(this.author_collection, 'did');
    this.authorList = new Set(authors);
  }

  public async periodicTask() {
    dotenv.config();

    await this.db.removeTagFromOldPosts(
      this.name,
      Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    if (this.authorList.size === 0) {
      await this.start();
    }

    const lists = process.env.ARGENTINA_LISTS?.split('|') || [];
    const blockLists = process.env.BLOCKLIST?.split('|') || [];

    const [listMembers, blockedMembers] = await Promise.all([
      Promise.all(lists.map((list) => getListMembers(list, this.agent))).then((results) =>
        new Set(results.flat())
      ),
      Promise.all(blockLists.map((list) => getListMembers(list, this.agent))).then((results) =>
        new Set(results.flat())
      ),
    ]);

    this.blocked_members = blockedMembers;

    const db_authors = new Set(
      await dbClient.getDistinctFromCollection(this.author_collection, 'did')
    );

    const new_authors = Array.from(listMembers).filter((member) => !db_authors.has(member));
    const del_authors = Array.from(db_authors).filter((member) => !listMembers.has(member));

    this.authorList = listMembers;

    if (del_authors.length > 0) {
      await this.db.deleteManyDID(this.author_collection, del_authors);
    }

    const allPosts = await Promise.all(
      new_authors.map((author) => getPostsForUser(author, this.agent))
    );

    const bulkOps: any[] = [];

    for (const [index, new_author] of new_authors.entries()) {
      const posts = allPosts[index] || [];
      const validPosts = await Promise.all(
        posts.map((post) => this.filter_post(post).then((isValid) => (isValid ? post : null)))
      );

      validPosts.forEach((post) => {
        if (post !== null) {
          bulkOps.push({
            insertOne: { document: post },
          });
        }
      });

      bulkOps.push({
        updateOne: {
          filter: { did: new_author },
          update: { $set: { did: new_author } },
          upsert: true,
        },
      });
    }

    if (bulkOps.length > 0) {
      try {
        await this.db.bulkWrite('post', bulkOps);
      } catch (err) {
        console.error('Bulk write error:', err);
      }
    }
  }

  public async filter_post(post: Post): Promise<boolean> {
    if (this.blocked_members.has(post.author)) {
      return false;
    }

    if (this.authorList.has(post.author)) {
      return true;
    }

    const matchString = [
      post.embed?.images?.map((image) => image.alt).join(' ') || '',
      post.embed?.alt || '',
      post.embed?.media?.alt || '',
      post.tags?.join(' ') || '',
      post.text || '',
    ]
      .join(' ')
      .toLowerCase();

    return this.matchPatterns.some((pattern) => pattern.test(matchString));
  }
}
