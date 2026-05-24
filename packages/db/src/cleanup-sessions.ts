import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { lt, or, and, isNotNull, sql } from 'drizzle-orm';

async function cleanupSessions() {
  console.log('🧹 Cleaning up expired and stale revoked sessions...');

  try {
    const { db } = await import('./index');
    const { sessions } = await import('./schema/sessions');

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(sessions)
      .where(
        or(
          lt(sessions.expiresAt, new Date()),
          and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, cutoff))
        )
      )
      .returning({ id: sessions.id });

    console.log(`✅ Deleted ${result.length} session(s).`);
  } catch (error) {
    console.error('❌ Session cleanup failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

cleanupSessions();
