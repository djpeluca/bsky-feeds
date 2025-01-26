import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import { getListMembers } from '../addn/getListMembers'

dotenv.config()

// max 15 chars
export const shortname = 'argentina'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  });

  let feed = builder.map((row) => ({
    post: row.uri,
  }));

  let cursor: string | undefined;import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
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
  const last = builder.at(-1);
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`;
  }

  return {
    cursor,
    feed,
  };
}

export class manager extends AlgoManager {
  public name: string = shortname;

  // Cache the compiled patterns
  private readonly compiledPatterns: RegExp[] = [
    /(?:argenti|argento|argenta|🇦🇷|TwitterArg)\w*/i,
    /(^|[\s\W])Buenos Aires($|[\W\s])/im,
    /(^|[\s\W])Malvinas($|[\W\s])/im,
    /(^|[\s\W])Maradona($|[\W\s])/im,
    /(^|[\s\W])conourbano($|[\W\s])/im,
    /(^|[\s\W])Tierra del Fuego($|[\W\s])/im,
    /(^|[\s\W])Gualeguaych[úu]($|[\W\s])/im,
    /(^|[\s\W])Capital Federal($|[\W\s])/im,
    /(^|[\s\W])Puerto Madero($|[\W\s])/im,
    /(^|[\s\W])Patagonia($|[\W\s])/im,
    /(^|[\s\W])Kirchner($|[\W\s])/im,
    /(^|[\s\W])Alberto Fernandez($|[\W\s])/im,
    /(^|[\s\W])Milei($|[\W\s])/im,
    /(^|[\s\W])Cyberciruja($|[\W\s])/im,
    /(^|[\s\W])Lionel Messi($|[\W\s])/im,
    /(^|[\s\W])Eva Per[óo]n($|[\W\s])/im,
    /(^|[\s\W])Evita Per[óo]n($|[\W\s])/im,
    /(^|[\s\W])Domingo Per[óo]n($|[\W\s])/im,
    /(^|[\s\W])Juan Per[óo]n($|[\W\s])/im,
    /(^|[\s\W])Per[óo]nia($|[\W\s])/im,
    /(^|[\s\W])Per[óo]nismo($|[\W\s])/im,
    /(^|[\s\W])Jorge Luis Borges($|[\W\s])/im,
    /(^|[\s\W])Mercedes Sosa($|[\W\s])/im,
    /(^|[\s\W])Carlos Gardel($|[\W\s])/im,
    /(^|[\s\W])La Bombonera($|[\W\s])/im,
    /(^|[\s\W])Monumental de Nuñez($|[\W\s])/im,
    /(^|[\s\W])Casa Rosada($|[\W\s])/im,
    /(^|[\s\W])Perito Moreno($|[\W\s])/im,
    /(^|[\s\W])San Mart[ií]n de los Andes($|[\W\s])/im,
    /(^|[\s\W])Victoria Villarruel($|[\W\s])/im,
    /(^|[\s\W])Sergio Massa($|[\W\s])/im,
    /(^|[\s\W])Larreta($|[\W\s])/im,
    /(^|[\s\W])Patricia Bullrich($|[\W\s])/im,
    /(^|[\s\W])Pato Bullrich($|[\W\s])/im,
    /(^|[\s\W])Cris Morena($|[\W\s])/im,
    /(^|[\s\W])Spreen($|[\W\s])/im,
    /(^|[\s\W])Colapinto($|[\W\s])/im,
    /(^|[\s\W])Jorge Rial($|[\W\s])/im,
    /(^|[\s\W])Susana Gimenez($|[\W\s])/im,
    /(^|[\s\W])Kicillof($|[\W\s])/im,
    /(^|[\s\W])Macri($|[\W\s])/im
  ]
  

  // Include Argentinian users here to always include their posts
  public matchUsers: string[] = [
    //
  ]

  // Exclude posts from these users
  public bannedUsers: string[] = [
    //
  ]

  private whitelistedAuthors = new Set<string>();
  private blacklistedAuthors = new Set<string>();

  public async start() {
    console.log(`${this.name}: Starting argentina algorithm`);
    try {
      // Get whitelist members
      if (process.env.ARGENTINA_LISTS) {
        const lists: string[] = `${process.env.ARGENTINA_LISTS}`.split('|');
        console.log(`${this.name}: Processing ${lists.length} whitelist lists:`, lists);
        const listMembersPromises = lists.map(list => getListMembers(list, this.agent));
        const allMembers = await Promise.all(listMembersPromises);
        this.whitelistedAuthors = new Set(allMembers.flat());
        console.log(`${this.name}: Added ${this.whitelistedAuthors.size} whitelisted authors`);
      } else {
        console.log(`${this.name}: No ARGENTINA_LISTS environment variable found`);
      }

      // Get blacklist members
      if (process.env.BLOCKLIST) {
        const blockLists: string[] = `${process.env.BLOCKLIST}`.split('|');
        console.log(`${this.name}: Processing ${blockLists.length} block lists:`, blockLists);
        const blockedMembersPromises = blockLists.map(list => getListMembers(list, this.agent));
        const allBlockedMembers = await Promise.all(blockedMembersPromises);
        this.blacklistedAuthors = new Set(allBlockedMembers.flat());
        console.log(`${this.name}: Added ${this.blacklistedAuthors.size} blacklisted authors`);
      } else {
        console.log(`${this.name}: No BLOCKLIST environment variable found`);
      }
    } catch (error) {
      console.error(`${this.name}: Error in start():`, error);
      throw error;
    }
  }

  public async periodicTask() {
    try {
      console.log(`${this.name}: Starting periodic task`);
      const twoWeeksAgo = new Date().getTime() - 14 * 24 * 60 * 60 * 1000;
      await this.db.removeTagFromOldPosts(this.name, twoWeeksAgo);
      console.log(`${this.name}: Completed periodic task, removed old posts`);
    } catch (error) {
      console.error(`${this.name}: Error in periodicTask:`, error);
    }
  }

  public async filter_post(post: Post): Promise<Boolean> {
    // Quick author checks first
    if (this.whitelistedAuthors.has(post.author)) return true;
    if (this.blacklistedAuthors.has(post.author)) return false;

    if (!this.agent) return false;

    const matchString = [
      ...(post.embed?.images?.map(img => img.alt) || []),
      post.embed?.alt,
      post.embed?.media?.alt,
      ...(post.tags || []),
      post.text
    ].filter(Boolean).join(' ').toLowerCase();

    return this.compiledPatterns.some(pattern => pattern.test(matchString));
  }
}
