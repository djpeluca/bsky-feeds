// utils/safeAddToSet.ts
import dbClient from '../db/dbClient';

export async function safeAddToSet(db, posts, tag) {
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