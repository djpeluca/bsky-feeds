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

// Main AI patterns
const MAIN_PATTERNS = [
  /\bAI\b/g, // Only "AI"
  /\bIA\b/g, // Only "IA"
  /(^|[\s\W])#ArtificialIntelligence($|[\W\s])/im,
  /(^|[\s\W])#GenerativeAI($|[\W\s])/im,
  /(^|[\s\W])#GenAI($|[\W\s])/im,
  /(^|[\s\W])GenAI($|[\W\s])/im,
  /(^|[\s\W])#MachineLearning($|[\W\s])/im,
  /(^|[\s\W])#DeepLearning($|[\W\s])/im,
  /(^|[\s\W])Artificial Intelligence($|[\W\s])/im,
  /(^|[\s\W])Generative AI($|[\W\s])/im,
  /(^|[\s\W])Machine Learning($|[\W\s])/im,
  /(^|[\s\W])Deep Learning($|[\W\s])/im,
  /(^|[\s\W])Neural Network($|[\W\s])/im,
  /(^|[\s\W])Neural Networks($|[\W\s])/im,
  /(^|[\s\W])Large Language Model($|[\W\s])/im,
  /(^|[\s\W])Large Language Models($|[\W\s])/im,
  /(^|[\s\W])LLM($|[\W\s])/im,
  /(^|[\s\W])LLMs($|[\W\s])/im,
  /(^|[\s\W])reasoning model($|[\W\s])/im,
];

// AI Models and Technologies
const MODEL_PATTERNS = [
  /(^|[\s\W])GPT-4($|[\W\s])/im,
  /(^|[\s\W])GPT($|[\W\s])/im,
  /(^|[\s\W])GPT-4o($|[\W\s])/im,
  /(^|[\s\W])GPT-3($|[\W\s])/im,
  /(^|[\s\W])LatamGPT($|[\W\s])/im,
  /(^|[\s\W])Latam-GPT($|[\W\s])/im,
  /(^|[\s\W])Claude($|[\W\s])/im,
  /(^|[\s\W])Claude 3($|[\W\s])/im,
  /(^|[\s\W])Claude 3.5($|[\W\s])/im,
  /(^|[\s\W])Gemini($|[\W\s])/im,
  /(^|[\s\W])Grok($|[\W\s])/im,
  /(^|[\s\W])Gemini Pro($|[\W\s])/im,
  /(^|[\s\W])Gemini Ultra($|[\W\s])/im,
  /(^|[\s\W])Llama($|[\W\s])/im,
  /(^|[\s\W])Llama 2($|[\W\s])/im,
  /(^|[\s\W])Llama 3($|[\W\s])/im,
  /(^|[\s\W])Mistral AI($|[\W\s])/im,
  /(^|[\s\W])PaLM($|[\W\s])/im,
  /(^|[\s\W])BERT($|[\W\s])/im,
  /(^|[\s\W])Diffusion Model($|[\W\s])/im,
  /(^|[\s\W])Diffusion Models($|[\W\s])/im,
  /(^|[\s\W])Stable Diffusion($|[\W\s])/im,
  /(^|[\s\W])DALL-E($|[\W\s])/im,
  /(^|[\s\W])Midjourney($|[\W\s])/im,
  /(^|[\s\W])Sora($|[\W\s])/im,
  /(^|[\s\W])Pika Labs($|[\W\s])/im,
  /(^|[\s\W])Data Cloud($|[\W\s])/im,
  /(^|[\s\W])Agentforce($|[\W\s])/im,
];

// AI Companies and Organizations
const COMPANY_PATTERNS = [
  /(^|[\s\W])OpenAI($|[\W\s])/m,
  /(^|[\s\W])Anthropic($|[\W\s])/m,
  /(^|[\s\W])Google AI($|[\W\s])/m,
  /(^|[\s\W])DeepMind($|[\W\s])/m,
  /(^|[\s\W])Meta AI($|[\W\s])/m,
  /(^|[\s\W])Microsoft AI($|[\W\s])/m,
  /(^|[\s\W])NVIDIA AI($|[\W\s])/m,
  /(^|[\s\W])Hugging Face($|[\W\s])/m,
  /(^|[\s\W])HuggingFace($|[\W\s])/m,
  /(^|[\s\W])Cohere($|[\W\s])/m,
  /(^|[\s\W])Scale AI($|[\W\s])/m,
  /(^|[\s\W])Databricks($|[\W\s])/m,
  /(^|[\s\W])Palantir($|[\W\s])/m,
  /(^|[\s\W])C3.ai($|[\W\s])/m,
  /(^|[\s\W])UiPath($|[\W\s])/m,
  /(^|[\s\W])Snowflake($|[\W\s])/m,
  /(^|[\s\W])Databricks($|[\W\s])/m,
  /(^|[\s\W])Stability AI($|[\W\s])/m,
  /(^|[\s\W])Midjourney($|[\W\s])/m,
  /(^|[\s\W])Runway ML($|[\W\s])/m,
  /(^|[\s\W])Pika Labs($|[\W\s])/m,
  /(^|[\s\W])ElevenLabs($|[\W\s])/m,
  /(^|[\s\W])Character.ai($|[\W\s])/m,
  /(^|[\s\W])CharacterAI($|[\W\s])/m,
  /(^|[\s\W])Perplexity($|[\W\s])/m,
  /(^|[\s\W])Inflection AI($|[\W\s])/m,
  /(^|[\s\W])Cluely($|[\W\s])/m,
  /(^|[\s\W])Pi AI($|[\W\s])/m,
  /(^|[\s\W])Manus\.ai($|[\W\s])/m,  
  /(^|[\s\W])DeepSeek($|[\W\s])/m, 
  /(^|[\s\W])Altimetrik($|[\W\s])/m,
  /(^|[\s\W])X AI($|[\W\s])/m,
];

// AI Concepts and Technologies
const CONCEPT_PATTERNS = [
  /(^|[\s\W])Prompt Engineering($|[\W\s])/im,
  /(^|[\s\W])Fine-tuning($|[\W\s])/im,
  /(^|[\s\W])Fine tuning($|[\W\s])/im,
  /(^|[\s\W])RAG($|[\W\s])/im,
  /(^|[\s\W])Retrieval-Augmented Generation($|[\W\s])/im,
  /(^|[\s\W])Chain-of-Thought($|[\W\s])/im,
  /(^|[\s\W])Chain of Thought($|[\W\s])/im,
  /(^|[\s\W])Few-shot Learning($|[\W\s])/im,
  /(^|[\s\W])Few shot Learning($|[\W\s])/im,
  /(^|[\s\W])Zero-shot Learning($|[\W\s])/im,
  /(^|[\s\W])Zero shot Learning($|[\W\s])/im,
  /(^|[\s\W])Transfer Learning($|[\W\s])/im,
  /(^|[\s\W])Supervised Learning($|[\W\s])/im,
  /(^|[\s\W])Unsupervised Learning($|[\W\s])/im,
  /(^|[\s\W])Reinforcement Learning($|[\W\s])/im,
  /(^|[\s\W])Computer Vision($|[\W\s])/im,
  /(^|[\s\W])Natural Language Processing($|[\W\s])/im,
  /(^|[\s\W])NLP($|[\W\s])/im,
  /(^|[\s\W])Computer Vision($|[\W\s])/im,
  /(^|[\s\W])Speech Recognition($|[\W\s])/im,
  /(^|[\s\W])Text-to-Speech($|[\W\s])/im,
  /(^|[\s\W])Text to Speech($|[\W\s])/im,
  /(^|[\s\W])Speech-to-Text($|[\W\s])/im,
  /(^|[\s\W])Speech to Text($|[\W\s])/im,
  /(^|[\s\W])Multimodal($|[\W\s])/im,
  /(^|[\s\W])Multi-modal($|[\W\s])/im,
  /(^|[\s\W])AGI($|[\W\s])/im,
  /(^|[\s\W])Artificial General Intelligence($|[\W\s])/im,
  /(^|[\s\W])Alignment($|[\W\s])/im,
  /(^|[\s\W])AI Alignment($|[\W\s])/im,
  /(^|[\s\W])Hallucination($|[\W\s])/im,
  /(^|[\s\W])AI Hallucination($|[\W\s])/im,
  /(^|[\s\W])Bias($|[\W\s])/im,
  /(^|[\s\W])AI Bias($|[\W\s])/im,
  /(^|[\s\W])AI Ethics($|[\W\s])/im,
  /(^|[\s\W])Safety($|[\W\s])/im,
  /(^|[\s\W])AI Safety($|[\W\s])/im,
  /(^|[\s\W])Vector Database($|[\W\s])/im,
  /(^|[\s\W])langchain($|[\W\s])/im,
  /(^|[\s\W])flowise($|[\W\s])/im,
  /(^|[\s\W])agentic($|[\W\s])/im,
];

// AI Personalities and Researchers
const PERSONALITY_PATTERNS = [
  /(^|[\s\W])Sam Altman($|[\W\s])/im,
  /(^|[\s\W])Dario Amodei($|[\W\s])/im,
  /(^|[\s\W])Demis Hassabis($|[\W\s])/im,
  /(^|[\s\W])Yann LeCun($|[\W\s])/im,
  /(^|[\s\W])Geoffrey Hinton($|[\W\s])/im,
  /(^|[\s\W])Yoshua Bengio($|[\W\s])/im,
  /(^|[\s\W])Andrew Ng($|[\W\s])/im,
  /(^|[\s\W])Fei-Fei Li($|[\W\s])/im,
  /(^|[\s\W])Andrej Karpathy($|[\W\s])/im,
  /(^|[\s\W])Ilya Sutskever($|[\W\s])/im,
  /(^|[\s\W])Greg Brockman($|[\W\s])/im,
  /(^|[\s\W])Sundar Pichai($|[\W\s])/im,
  /(^|[\s\W])Satya Nadella($|[\W\s])/im,
  /(^|[\s\W])Jensen Huang($|[\W\s])/im,
  /(^|[\s\W])Mark Zuckerberg($|[\W\s])/im,
  /(^|[\s\W])Jensen Huang($|[\W\s])/im,
  /(^|[\s\W])Clement Delangue($|[\W\s])/im,
  /(^|[\s\W])Aidan Gomez($|[\W\s])/im,
  /(^|[\s\W])Emad Mostaque($|[\W\s])/im,
  /(^|[\s\W])David Holz($|[\W\s])/im,
  /(^|[\s\W])Noam Shazeer($|[\W\s])/im,
  /(^|[\s\W])Ashish Vaswani($|[\W\s])/im,
  /(^|[\s\W])Alec Radford($|[\W\s])/im,
  /(^|[\s\W])Dario Amodei($|[\W\s])/im,
  /(^|[\s\W])Daniela Amodei($|[\W\s])/im,
];

// AI Applications and Use Cases
const APPLICATION_PATTERNS = [
  /(^|[\s\W])Chatbot($|[\W\s])/im,
  /(^|[\s\W])Chatbots($|[\W\s])/im,
  /(^|[\s\W])Virtual Assistant($|[\W\s])/im,
  /(^|[\s\W])Virtual Assistants($|[\W\s])/im,
  /(^|[\s\W])Code Generation($|[\W\s])/im,
  /(^|[\s\W])Code Completion($|[\W\s])/im,
  /(^|[\s\W])GitHub Copilot($|[\W\s])/im,
  /(^|[\s\W])Copilot($|[\W\s])/im,
  /(^|[\s\W])Content Generation($|[\W\s])/im,
  /(^|[\s\W])Image Generation($|[\W\s])/im,
  /(^|[\s\W])Video Generation($|[\W\s])/im,
  /(^|[\s\W])Audio Generation($|[\W\s])/im,
  /(^|[\s\W])Text Generation($|[\W\s])/im,
  /(^|[\s\W])Machine Translation($|[\W\s])/im,
  /(^|[\s\W])Sentiment Analysis($|[\W\s])/im,
  /(^|[\s\W])Recommendation System($|[\W\s])/im,
  /(^|[\s\W])Recommendation Systems($|[\W\s])/im,
  /(^|[\s\W])Fraud Detection($|[\W\s])/im,
  /(^|[\s\W])Predictive Analytics($|[\W\s])/im,
  /(^|[\s\W])Autonomous Vehicle($|[\W\s])/im,
  /(^|[\s\W])Autonomous Vehicles($|[\W\s])/im,
  /(^|[\s\W])Self-driving($|[\W\s])/im,
  /(^|[\s\W])Self driving($|[\W\s])/im,
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
  ]
  protected LISTS_ENV = 'AI_LISTS'

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
      MODEL_PATTERNS,
      COMPANY_PATTERNS,
      CONCEPT_PATTERNS,
      PERSONALITY_PATTERNS,
      APPLICATION_PATTERNS,
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