import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { BaseFeedManager } from './BaseFeedManager'
import dotenv from 'dotenv'
import dbClient from '../db/dbClient'

dotenv.config()

export const shortname = 'ai'

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

// Main AI patterns (strict acronyms and common terms)
const MAIN_PATTERNS = [
  /\bAI\b/,                        // AI as acronym
  /\bIA\b/,                        // Spanish/French acronym
  /\bArtificial Intelligence\b/i,
  /\bGenerative AI\b/i,
  /\bGenAI\b/i,
  /\bMachine Learning\b/i,
  /\bDeep Learning\b/i,
  /\bNeural Networks?\b/i,
  /\bLarge Language Models?\b/i,
  /\bLLMs?\b/i,                   // plural allowed
  /\bReasoning Model\b/i,
  /\bSmall Language Models?\b/i,   // SLM
  /\bFoundation Models?\b/i,
];

// AI Models and Technologies
const MODEL_PATTERNS = [
  /\bGPT-5\b/,
  /\bGPT-4(\.1|o)?(-mini)?\b/,     // GPT-4, 4.1, 4.1-mini, 4o
  /\bGPT-3(\.5)?\b/,
  /\bGPT\b/,
  /\bClaude( 3| 3\.5| Sonnet| Opus)?\b/,
  /\bGemini( Pro| Ultra)?\b/,
  /\bGrok( 2)?\b/,
  /\bMistral\b/,
  /\bMixtral\b/,
  /\bPhi-3\b/,
  /\bPaLM\b/,
  /\bBERT\b/,
  /\bDiffusion Models?\b/i,
  /\bStable Diffusion\b/i,
  /\bDALL-?E\b/i,
  /\bMidjourney\b/,
  /\bSora\b/,
  /\bRunway\b/,
  /\bDeepSeek\b/,
  /\bxLAM\b/i,
  /\bAgentforce\b/,
  /\bData Cloud\b/,
];

// AI Companies and Orgs
const COMPANY_PATTERNS = [
  /\bOpenAI\b/,
  /\bAnthropic\b/,
  /\bGoogle (AI|DeepMind)\b/i,
  /\bMeta AI\b/i,
  /\bMicrosoft AI\b/i,
  /\bNVIDIA\b/i,
  /\bHugging ?Face\b/i,
  /\bCohere\b/,
  /\bMistral\b/,
  /\bScale AI\b/,
  /\bDatabricks\b/,
  /\bPalantir\b/,
  /\bC3\.ai\b/,
  /\bUiPath\b/,
  /\bSnowflake\b/,
  /\bStability AI\b/,
  /\bMidjourney\b/,
  /\bElevenLabs\b/,
  /\bCharacter\.?ai\b/i,
  /\bPerplexity\b/,
  /\bInflection AI\b/,
  /\bDeepSeek\b/,
  /\bxAI\b/,          // Musk’s company
];

// AI Concepts and Technologies
const CONCEPT_PATTERNS = [
  /\bPrompt Engineering\b/i,
  /\bFine[- ]tuning\b/i,
  /\bRAG\b/,
  /\bRetrieval[- ]Augmented Generation\b/i,
  /\bChain[- ]of[- ]Thought\b/i,
  /\bFew[- ]shot Learning\b/i,
  /\bZero[- ]shot Learning\b/i,
  /\bTransfer Learning\b/i,
  /\b(Supervised|Unsupervised|Reinforcement) Learning\b/i,
  /\bComputer Vision\b/i,
  /\bNatural Language Processing\b/i,
  /\bNLP\b/,
  /\bSpeech (Recognition|to[- ]Text|Text[- ]to[- ]Speech)\b/i,
  /\bAGI\b/,
  /\bArtificial General Intelligence\b/i,
  /\bAI Alignment\b/i,
  /\b(Hallucination|AI Hallucination)\b/i,
  /\bAI (Bias|Ethics|Safety)\b/i,
  /\bVector Database\b/i,
  /\bLangChain\b/i,
  /\bFlowise\b/i,
  /\bAI Agents?\b/i,              // "AI agent" or "AI agents" — explicit and safe                // the adjective (agentic) only
  /\bAgent Workflows?\b/i,        // "Agent workflow" or "Agent workflows"// mixture of experts
];

// Explicitly exclude noisy hashtags (AIART, aigirl, etc.)
const EXCLUSION_PATTERNS = [
  /#AIART/i,
  /#aigirl/i,
  /#AICORE/i,
];
// AI Personalities and Researchers
const PERSONALITY_PATTERNS = [
  /\bSam Altman\b/,
  /\bDario Amodei\b/,
  /\bDaniela Amodei\b/,
  /\bDemis Hassabis\b/,
  /\bYann LeCun\b/,
  /\bGeoffrey Hinton\b/,
  /\bYoshua Bengio\b/,
  /\bAndrew Ng\b/,
  /\bFei-?Fei Li\b/,
  /\bAndrej Karpathy\b/,
  /\bIlya Sutskever\b/,
  /\bGreg Brockman\b/,
  /\bSundar Pichai\b/,
  /\bSatya Nadella\b/,
  /\bJensen Huang\b/,
  /\bMark Zuckerberg\b/,
  /\bClement Delangue\b/,
  /\bAidan Gomez\b/,
  /\bEmad Mostaque\b/,
  /\bDavid Holz\b/,
  /\bNoam Shazeer\b/,
  /\bAshish Vaswani\b/,
  /\bAlec Radford\b/,

  // Newer figures to track
  /\bMustafa Suleyman\b/,
  /\bReid Hoffman\b/,    // Inflection AI
  /\bRichard Socher\b/,  // You.com
];

// AI Applications and Use Cases
const APPLICATION_PATTERNS = [
  /\bChatbots?\b/i,
  /\bVirtual Assistants?\b/i,
  /\bCode (Generation|Completion)\b/i,
  /\bGitHub Copilot\b/i,
  /\bCopilot\b/i,
  /\bContent Generation\b/i,
  /\b(Image|Video|Audio|Text) Generation\b/i,
  /\bMachine Translation\b/i,
  /\bRecommendation Systems?\b/i,
  /\bPredictive Analytics\b/i,
  /\bAutonomous Vehicles?\b/i,
  /\bSelf[- ]?driving\b/i,

  // Newer/expanded apps
  /\bAI Agents?\b/i,
  /\bDigital Humans?\b/i,
  /\bAI Companions?\b/i,
  /\bAI Video Dubbing\b/i,
  /\bOffice Copilot\b/i,
  /\bCopilot Studio\b/i,
  /\bAI Search\b/i,
];

const REGULATION_PATTERNS = [
  /\bEU AI Act\b/i,
  /\bAI Bill of Rights\b/i,
  /\bAI Safety Summit\b/i,
  /\bExecutive Order on AI\b/i,
  /\bNIST AI Risk Framework\b/i,
  /\bOECD AI Principles\b/i,
  /\bUNESCO AI Ethics\b/i,
];

const TOOL_PATTERNS = [
  /\bAutoGPT\b/i,
  /\bBabyAGI\b/i,
  /\bLangSmith\b/i,
  /\bCrewAI\b/i,
  /\bOllama\b/i,
  /\bWeights & Biases\b/i,
  /\bComet\.ml\b/i,
  /\bReplicate\b/i,
  /\bGradio\b/i,
];

const HARDWARE_PATTERNS = [
  /\bNVIDIA H100\b/i,
  /\bNVIDIA H200\b/i,
  /\bNVIDIA B200\b/i,
  /\bTensor Processing Unit\b/i,
  /\bTPU\b/,
  /\bASICs?\b/i,
  /\bNeuromorphic\b/i,
];
const ETHICS_PATTERNS = [
  /\bAI Safety\b/i,
  /\bAI Alignment\b/i,
  /\bAI Risk(s)?\b/i,
  /\bAI Bias\b/i,
  /\bDeepfake(s)?\b/i,
  /\bAI Misinformation\b/i,
  /\bAI Disinformation\b/i,
  /\bSynthetic Media\b/i,
  /\bJob Displacement\b/i,
];

const BENCHMARK_PATTERNS = [
  /\bMMLU\b/i,
  /\bBIG-bench\b/i,
  /\bMT-Bench\b/i,
  /\bHELM\b/i,
  /\bHumanEval\b/i,
];


export class manager extends BaseFeedManager {
  public name = shortname
  public author_collection = 'list_members'
  protected PATTERNS = [
    ...MAIN_PATTERNS,
    ...MODEL_PATTERNS,
    ...COMPANY_PATTERNS,
    ...CONCEPT_PATTERNS,
    ...PERSONALITY_PATTERNS,
    ...APPLICATION_PATTERNS,
    ...REGULATION_PATTERNS,
    ...TOOL_PATTERNS,
    ...HARDWARE_PATTERNS,
    ...ETHICS_PATTERNS,
    ...BENCHMARK_PATTERNS,
  ]
  protected LISTS_ENV = 'AI_LISTS'

  public async filter_post(post: any): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
      if (this.agent === null) return false
    }

    // ❌ Exclude replies (post with parents)
    if (post.record?.reply?.parent) {
      return false
    }

    if (this.blockedSet.has(post.author)) return false
    if (this.authorSet.has(post.author)) return true

    const matchString = this.buildMatchString(post)
    const cacheKey = `${post.uri}:${matchString}`
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!
    }

    // ❌ Exclusion check — bail out early if it matches
    if (EXCLUSION_PATTERNS.some(pattern => pattern.test(matchString))) {
      this.patternCache.set(cacheKey, false)
      return false
    }

    // ✅ Positive pattern matching groups for early exit
    const groups = [
      MAIN_PATTERNS,
      MODEL_PATTERNS,
      COMPANY_PATTERNS,
      CONCEPT_PATTERNS,
      PERSONALITY_PATTERNS,
      APPLICATION_PATTERNS,
      REGULATION_PATTERNS,
      TOOL_PATTERNS,
      HARDWARE_PATTERNS,
      ETHICS_PATTERNS,
      BENCHMARK_PATTERNS,
    ]

    let matches = false
    for (const group of groups) {
      if (group.some(pattern => pattern.test(matchString))) {
        matches = true
        break
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