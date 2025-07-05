// utils/safeAddToSet.ts
import dbClient from '../db/dbClient';

export async function safeAddToSet(db, posts, tag) {
  // 1. Find posts with bad algoTags
  const uris = posts.map(p => p.uri);
  const badDocs = await db.find('post', {
    uri: { $in: uris },
    $or: [
      { algoTags: { $exists: false } },
      { algoTags: null },
      { $and: [{ algoTags: { $exists: true } }, { $expr: { $not: { $isArray: '$algoTags' } } }] }
    ]
  }, { projection: { uri: 1 } });

  const badUris = new Set(badDocs.map(d => d.uri));

  // 2. Heal in batch
  if (badUris.size > 0) {
    await db.updateMany(
      'post',
      { uri: { $in: Array.from(badUris) } },
      { $set: { algoTags: [] } }
    );
  }

  // 3. Bulk addToSet for all posts
  const ops = posts.map(post => ({
    updateOne: {
      filter: { uri: post.uri },
      update: { $addToSet: { algoTags: tag } },
      upsert: true,
    }
  }));
  if (ops.length > 0) {
    await db.bulkWrite('post', ops);
  }
}