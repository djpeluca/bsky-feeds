import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

dotenv.config()

// max 15 chars
export const shortname = 'brasil'

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
    '🇧🇷',
    'não',
    'sim',
    'muito',
    'obrigado',
    'obrigada',
    'isso',
    'tamb[eé]m',
    'então',
    'você',
    'l[aá]',
    'depois',
    'agora',
    'bem',
    'falar',
    'conosco',
    'certo',
    'assim',
    'at[eé]',
    'atrav[eé]s',
    'embora',
    'enquanto',
    'portanto',
    'ali[aá]s',
    'pois',
    'contudo',
    'entretanto',
    'por[eé]m',
    'imenso',
    'bom',
    'boa',
    'tudo',
    'al[eé]m',
    'algu[eé]m',
    'ningu[eé]m',
    'ontem',
    'hoje',
    'amanhã',
    'sempre',
    'nunca',
    'j[aá]',
    'ainda',
    'quase',
    'demais',
    'c[aá]',
    'brasil',
    'a[ií]',
    'uruguai'
  ]



  // Include Portuguese users here to always include their posts
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
      new Date().getTime() - 1 * 24 * 60 * 60 * 1000,
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
      this.matchTerms.some(pattern => lowerCaseMatchString.match(pattern))
    );
  }
}