// utils/safeAddToSet.ts
import dbClient from '../db/dbClient';

export async function safeAddToSet(db, posts, tag) {
  const BATCH_SIZE = parseInt(process.env.FEED_POST_BATCH_SIZE || '50', 10);
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const ops = batch.map(post => ({
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
}