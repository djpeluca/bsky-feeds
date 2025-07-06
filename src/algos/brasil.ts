import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { BaseFeedManager } from './BaseFeedManager'
import dotenv from 'dotenv'
import dbClient from '../db/dbClient'

dotenv.config()

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

// Main Brasil patterns
const MAIN_PATTERNS = [
  /(^|[\s\W])🇧🇷($|[\W\s])/im,
  /(^|[\s\W])Brasil($|[\W\s])/im,
  /(^|[\s\W])Brazil($|[\W\s])/im,
  /(^|[\s\W])brasileir[ao]($|[\W\s])/im,
  /(^|[\s\W])brasileir[ao]s($|[\W\s])/im,
];

// Common Portuguese words and expressions
const PORTUGUESE_PATTERNS = [
  /(^|[\s\W])não($|[\W\s])/im,
  /(^|[\s\W])sim($|[\W\s])/im,
  /(^|[\s\W])muito($|[\W\s])/im,
  /(^|[\s\W])obrigad[ao]($|[\W\s])/im,
  /(^|[\s\W])isso($|[\W\s])/im,
  /(^|[\s\W])tamb[eé]m($|[\W\s])/im,
  /(^|[\s\W])então($|[\W\s])/im,
  /(^|[\s\W])você($|[\W\s])/im,
  /(^|[\s\W])depois($|[\W\s])/im,
  /(^|[\s\W])agora($|[\W\s])/im,
  /(^|[\s\W])falar($|[\W\s])/im,
  /(^|[\s\W])conosco($|[\W\s])/im,
  /(^|[\s\W])certo($|[\W\s])/im,
  /(^|[\s\W])assim($|[\W\s])/im,
  /(^|[\s\W])at[eé]($|[\W\s])/im,
  /(^|[\s\W])atrav[eé]s($|[\W\s])/im,
  /(^|[\s\W])embora($|[\W\s])/im,
  /(^|[\s\W])enquanto($|[\W\s])/im,
  /(^|[\s\W])portanto($|[\W\s])/im,
  /(^|[\s\W])pois($|[\W\s])/im,
  /(^|[\s\W])contudo($|[\W\s])/im,
  /(^|[\s\W])entretanto($|[\W\s])/im,
  /(^|[\s\W])por[eé]m($|[\W\s])/im,
  /(^|[\s\W])imenso($|[\W\s])/im,
  /(^|[\s\W])bom($|[\W\s])/im,
  /(^|[\s\W])boa($|[\W\s])/im,
  /(^|[\s\W])tudo($|[\W\s])/im,
  /(^|[\s\W])al[eé]m($|[\W\s])/im,
  /(^|[\s\W])algu[eé]m($|[\W\s])/im,
  /(^|[\s\W])ningu[eé]m($|[\W\s])/im,
  /(^|[\s\W])hoje($|[\W\s])/im,
  /(^|[\s\W])amanhã($|[\W\s])/im,
  /(^|[\s\W])sempre($|[\W\s])/im,
  /(^|[\s\W])ainda($|[\W\s])/im,
  /(^|[\s\W])quase($|[\W\s])/im,
  /(^|[\s\W])demais($|[\W\s])/im,
];

// Regional patterns (Brazilian regions, states, cities, and cultural references)
const REGIONAL_PATTERNS = [
  // Major cities (Brazil-specific)
  /(^|[\s\W])São Paulo($|[\W\s])/im,
  /(^|[\s\W])Rio de Janeiro($|[\W\s])/im,
  /(^|[\s\W])Brasília($|[\W\s])/im,
  /(^|[\s\W])Salvador($|[\W\s])/im,
  /(^|[\s\W])Fortaleza($|[\W\s])/im,
  /(^|[\s\W])Belo Horizonte($|[\W\s])/im,
  /(^|[\s\W])Manaus($|[\W\s])/im,
  /(^|[\s\W])Curitiba($|[\W\s])/im,
  /(^|[\s\W])Recife($|[\W\s])/im,
  /(^|[\s\W])Porto Alegre($|[\W\s])/im,
  /(^|[\s\W])Belém($|[\W\s])/im,
  /(^|[\s\W])Goiânia($|[\W\s])/im,
  /(^|[\s\W])Guarulhos($|[\W\s])/im,
  /(^|[\s\W])Campinas($|[\W\s])/im,
  /(^|[\s\W])Natal($|[\W\s])/im,
  /(^|[\s\W])Maceió($|[\W\s])/im,
  /(^|[\s\W])João Pessoa($|[\W\s])/im,
  /(^|[\s\W])Teresina($|[\W\s])/im,
  /(^|[\s\W])Aracaju($|[\W\s])/im,
  /(^|[\s\W])Vitória($|[\W\s])/im,
  /(^|[\s\W])Florianópolis($|[\W\s])/im,
  /(^|[\s\W])Cuiabá($|[\W\s])/im,
  /(^|[\s\W])Campo Grande($|[\W\s])/im,
  /(^|[\s\W])Palmas($|[\W\s])/im,
  /(^|[\s\W])Boa Vista($|[\W\s])/im,
  /(^|[\s\W])Porto Velho($|[\W\s])/im,
  /(^|[\s\W])Rio Branco($|[\W\s])/im,
  /(^|[\s\W])Macapá($|[\W\s])/im,
  
  // States (Brazil-specific)
  /(^|[\s\W])Acre($|[\W\s])/im,
  /(^|[\s\W])Alagoas($|[\W\s])/im,
  /(^|[\s\W])Amapá($|[\W\s])/im,
  /(^|[\s\W])Amazonas($|[\W\s])/im,
  /(^|[\s\W])Bahia($|[\W\s])/im,
  /(^|[\s\W])Ceará($|[\W\s])/im,
  /(^|[\s\W])Distrito Federal($|[\W\s])/im,
  /(^|[\s\W])Espírito Santo($|[\W\s])/im,
  /(^|[\s\W])Goiás($|[\W\s])/im,
  /(^|[\s\W])Maranhão($|[\W\s])/im,
  /(^|[\s\W])Mato Grosso($|[\W\s])/im,
  /(^|[\s\W])Mato Grosso do Sul($|[\W\s])/im,
  /(^|[\s\W])Minas Gerais($|[\W\s])/im,
  /(^|[\s\W])Paraíba($|[\W\s])/im,
  /(^|[\s\W])Paraná($|[\W\s])/im,
  /(^|[\s\W])Pernambuco($|[\W\s])/im,
  /(^|[\s\W])Piauí($|[\W\s])/im,
  /(^|[\s\W])Rio de Janeiro($|[\W\s])/im,
  /(^|[\s\W])Rio Grande do Norte($|[\W\s])/im,
  /(^|[\s\W])Rio Grande do Sul($|[\W\s])/im,
  /(^|[\s\W])Rondônia($|[\W\s])/im,
  /(^|[\s\W])Roraima($|[\W\s])/im,
  /(^|[\s\W])Santa Catarina($|[\W\s])/im,
  /(^|[\s\W])São Paulo($|[\W\s])/im,
  /(^|[\s\W])Sergipe($|[\W\s])/im,
  /(^|[\s\W])Tocantins($|[\W\s])/im,
  
  // Cultural and landmarks (Brazil-specific)
  /(^|[\s\W])Cristo Redentor($|[\W\s])/im,
  /(^|[\s\W])Pão de Açúcar($|[\W\s])/im,
  /(^|[\s\W])Copacabana($|[\W\s])/im,
  /(^|[\s\W])Ipanema($|[\W\s])/im,
  /(^|[\s\W])Favela($|[\W\s])/im,
  /(^|[\s\W])Samba($|[\W\s])/im,
  /(^|[\s\W])Bossa Nova($|[\W\s])/im,
  /(^|[\s\W])Capoeira($|[\W\s])/im,
  /(^|[\s\W])Feijoada($|[\W\s])/im,
  /(^|[\s\W])Caipirinha($|[\W\s])/im,
  /(^|[\s\W])Picanha($|[\W\s])/im,
  /(^|[\s\W])Açaí($|[\W\s])/im,
  /(^|[\s\W])Guaraná($|[\W\s])/im,
  /(^|[\s\W])Cachaça($|[\W\s])/im,
  /(^|[\s\W])Cafezinho($|[\W\s])/im,
];

export class manager extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  protected PATTERNS = [
    ...MAIN_PATTERNS,
    ...PORTUGUESE_PATTERNS,
    ...REGIONAL_PATTERNS,
  ]
  protected LISTS_ENV = 'BRASIL_LISTS'

  public async filter_post(post: any): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
      if (this.agent === null) return false
    }
    if (this.blockedSet.has(post.author)) return false
    if (this.authorSet.has(post.author)) return true
    const matchString = this.buildMatchString(post)
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }
    // Grouped pattern matching for early exit
    const groups = [
      MAIN_PATTERNS,
      PORTUGUESE_PATTERNS,
      REGIONAL_PATTERNS,
    ];
    let matches = false;
    for (const group of groups) {
      if (group.some(pattern => pattern.test(matchString))) {
        matches = true;
        break;
      }
    }
    this.patternCache.set(cacheKey, matches)
    return matches
  }

  private buildMatchString(post: any): string {
    const parts: string[] = []
    if (post.text) parts.push(post.text)
    if (post.tags?.length) parts.push(post.tags.join(' '))
    if (post.embed?.alt) parts.push(post.embed.alt)
    if (post.embed?.media?.alt) parts.push(post.embed.media.alt)
    if (post.embed?.images?.length) {
      const imageAlts = post.embed.images.map((img: any) => img.alt).filter(Boolean)
      if (imageAlts.length) parts.push(imageAlts.join(' '))
    }
    return parts.join(' ').toLowerCase()
  }
}