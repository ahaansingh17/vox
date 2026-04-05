import {
  vectorUpsert as _vectorUpsert,
  vectorSearch as _vectorSearch,
  vectorRemove as _vectorRemove,
  vectorCount as _vectorCount
} from '@vox-ai-app/storage/vectors'
import { getDb } from './db.js'

export const vectorUpsert = (collection, id, embedding, metadata) =>
  _vectorUpsert(getDb(), collection, id, embedding, metadata)

export const vectorSearch = (collection, queryEmbedding, queryText, topK) =>
  _vectorSearch(getDb(), collection, queryEmbedding, queryText, topK)

export const vectorRemove = (collection, id) => _vectorRemove(getDb(), collection, id)

export const vectorCount = (collection) => _vectorCount(getDb(), collection)
