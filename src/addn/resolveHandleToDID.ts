import { Agent } from '@atproto/api'
import limit from './rateLimit'

export const resolveHandleToDID = async (
  author: string,
  agent: Agent,
): Promise<string> => {
  return (
    await limit(() =>
      agent.com.atproto.identity.resolveHandle({
        handle: author,
      }),
    )
  ).data.did
}

export default resolveHandleToDID
