import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as uruguay from './uruguay'
import * as argentina from './argentina'
import * as riodelaplata from './riodelaplata'
import * as brasil from './brasil'
import * as salesforce from './salesforce'
import * as fediverse from './fediverse'
import * as peniarol from './peniarol'
import * as ai from './ai'

import * as external from './externalList'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos = {
  [uruguay.shortname]: {
    handler: <AlgoHandler>uruguay.handler,
    manager: uruguay.manager,
  },
  [peniarol.shortname]: {
    handler: <AlgoHandler>peniarol.handler,
    manager: peniarol.manager,
  },
  [argentina.shortname]: {
    handler: <AlgoHandler>argentina.handler,
    manager: argentina.manager,
  },
  [riodelaplata.shortname]: {
    handler: <AlgoHandler>riodelaplata.handler,
    manager: riodelaplata.manager,
  },
  [brasil.shortname]: {
    handler: <AlgoHandler>brasil.handler,
    manager: brasil.manager,
  },
  [salesforce.shortname]: {
    handler: <AlgoHandler>salesforce.handler,
    manager: salesforce.manager,
  },
  [ai.shortname]: {
    handler: <AlgoHandler>ai.handler,
    manager: ai.manager,
  },
  [fediverse.shortname]: {
    handler: <AlgoHandler>fediverse.handler,
    manager: fediverse.manager,
  },
  [external.shortname]: {
    handler: <AlgoHandler>external.handler,
    manager: external.manager,
  },
}

export default algos
