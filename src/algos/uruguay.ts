import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton';
import { AppContext } from '../config';
import { AlgoManager } from '../addn/algoManager';
import dotenv from 'dotenv';
import getListMembers from '../addn/getListMembers';
import setListMembers from '../addn/setListMembers';
import getPostsForUser from '../addn/getPostsForUser';
import resoveDIDToHandle from '../addn/resolveDIDToHandle';
import { Post } from '../db/schema';
import dbClient from '../db/dbClient';
import getUserDetails from '../addn/getUserDetails';
import { AppBskyGraphDefs } from '@atproto/api';
import getUserLists from '../addn/getUserLists';

dotenv.config();

// max 15 chars
export const shortname = 'uruguay';

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

  public async start() {
    const authors = await dbClient.getDistinctFromCollection(this.author_collection, 'did');
    this.authorList = new Set(authors);
  }

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
    /(^|[\s\W])Fede [aá]lvarez($|[\W\s])/im,
    /(^|[\s\W])Fede Vigevani($|[\W\s])/im,
    /(^|[\s\W])Daniel Hendler($|[\W\s])/im,
    /(^|[\s\W])Jos[eé] Mujica($|[\W\s])/im,
    /(^|[\s\W])Tabar[eé] V[aá]zquez($|[\W\s])/im,
    /(^|[\s\W])Luis Lacalle Pou($|[\W\s])/im,
    /(^|[\s\W])Julio Mar[ií]a Sanguinetti($|[\W\s])/im,
    /(^|[\s\W])#UruguayDecide($|[\W\s])/im,
    /(^|[\s\W])#BalotajeUy($|[\W\s])/im,
    /(^|[\s\W])#OrsiPresidente($|[\W\s])/im,
    /(^|[\s\W])ñeri($|[\W\s])/im,
    /(^|[\s\W])nieri($|[\W\s])/im,
    /(^|[\s\W])Level Uy($|[\W\s])/im,
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

  ]

  public async periodicTask() {
    dotenv.config();

    await this.db.removeTagFromOldPosts(
      this.name,
      Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    if (this.authorList.size === 0) {
      await this.start();
    }

    const lists = process.env.URUGUAY_LISTS?.split('|') || [];
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

    const bulkOps = [];

    for (const [index, new_author] of new_authors.entries()) {
      const posts = allPosts[index] || [];
      const validPosts = await Promise.all(
        posts.map((post) => this.filter_post(post).then((isValid) => (isValid ? post : null)))
      );

      const bulkOps: any[] = [];

      // Prepare bulk operations for valid posts
      validPosts.forEach((post) => {
        if (post !== null) {
          bulkOps.push({
            insertOne: { document: post },
          });
        }
      });

      // Add an operation to update or insert the new author
      bulkOps.push({
        updateOne: {
          filter: { did: new_author },
          update: { $set: { did: new_author } },
          upsert: true,
        },
      });

      // Perform the bulk write
      if (bulkOps.length > 0) {
        try {
          await this.db.bulkWrite('post', bulkOps);
        } catch (err) {
          console.error('Bulk write error:', err);
        }
      }
    }

    if (bulkOps.length > 0) {
      await this.db.bulkWrite('post', bulkOps);
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