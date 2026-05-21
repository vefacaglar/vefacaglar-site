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

    // Seed admin user
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@vefacaglar.com'))
      .limit(1);

    if (existingUsers.length === 0) {
      const passwordHash = hashPassword('123');

      await db.insert(users).values({
        email: 'admin@vefacaglar.com',
        username: 'admin',
        displayName: 'Admin Vefa',
        passwordHash: passwordHash,
        role: 'admin',
        isActive: true,
      });

      console.log('✅ Admin user created successfully (email: admin@vefacaglar.com, password: 123)');
    } else {
      console.log('⚠️ Admin user already exists. Skipping user seed.');
    }

    // Seed pages
    const { pages } = await import('./schema/pages');

    const pagesToSeed = [
      {
        slug: 'home',
        title: 'Vefa Çağlar',
        content: `I'm a software engineer and indie game developer. I write about backend systems, game development, tools, and technical decisions from the projects I work on.

[About](/about)
[LinkedIn](https://linkedin.com)
[X (Twitter)](https://x.com)
[GitHub](https://github.com)

## Current Project

**Wastecross:** a post-apocalyptic top-down action RPG about reopening roads between fractured zones in Unity.`,
        status: 'published' as const,
        publishedAt: new Date(),
      },
      {
        slug: 'about',
        title: 'About',
        content: 'Software engineer with a focus on backend architecture, microservices, and indie game dev.',
        status: 'published' as const,
        publishedAt: new Date(),
      },
    ];

    for (const page of pagesToSeed) {
      const existingPages = await db
        .select()
        .from(pages)
        .where(eq(pages.slug, page.slug))
        .limit(1);

      if (existingPages.length === 0) {
        await db.insert(pages).values(page);
        console.log(`✅ Page '${page.slug}' created successfully.`);
      } else {
        console.log(`⚠️ Page '${page.slug}' already exists. Skipping.`);
      }
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seed();
