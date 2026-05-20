import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from the root .env file at the very start
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { eq } from 'drizzle-orm';
import { scryptSync, randomBytes } from 'crypto';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    // Dynamically import db and users to prevent import hoisting from bypassing dotenv.config()
    const { db } = await import('./index');
    const { users } = await import('./schema/users');

    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@vefacaglar.com'))
      .limit(1);

    if (existingUsers.length > 0) {
      console.log('⚠️ Admin user already exists. Skipping user seed.');
      process.exit(0);
    }

    const passwordHash = hashPassword('123');

    await db.insert(users).values({
      email: 'admin@vefacaglar.com',
      displayName: 'Admin Vefa',
      passwordHash: passwordHash,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin user created successfully (email: admin@vefacaglar.com, password: 123)');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
