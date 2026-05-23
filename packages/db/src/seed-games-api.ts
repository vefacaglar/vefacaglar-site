import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as fs from 'fs';

// Load environment variables manually to be 100% robust in the background task
const envPath = resolve(__dirname, '../../../.env');
console.log('--- ENV LOADING ---');
console.log('__dirname:', __dirname);
console.log('envPath resolved:', envPath);
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIdx = trimmed.indexOf('=');
    if (equalIdx === -1) continue;
    const key = trimmed.slice(0, equalIdx).trim();
    let val = trimmed.slice(equalIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
  console.log('Manual env parsing: SUCCESS');
} catch (err) {
  console.error('Manual env parsing error:', err);
}
console.log('API_URL after env load:', process.env.API_URL);
console.log('--------------------');

const API_URL = process.env.API_URL || 'http://localhost:3001';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/\//g, '-')            // Replace slashes with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars except hyphens
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return null;
  const d = new Date(parsed);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapPlatformName(name: string): string {
  const clean = name.trim();
  const lower = clean.toLowerCase();
  if (lower === 'ps1') return 'playstation';
  if (lower === 'ps2') return 'playstation 2';
  if (lower === 'ps3') return 'playstation 3';
  if (lower === 'ps4') return 'playstation 4';
  if (lower === 'ps5') return 'playstation 5';
  return clean;
}

interface GameDataInput {
  rank: number;
  title: string;
  developer: string[];
  publisher: string | string[];
  release_date: string;
  genre: string[];
  theme: string[];
  metacritic: number | null;
  opencritic: number | null;
  platforms: string[];
}

let sessionToken = '';

async function apiRequest(path: string, method: string, body?: any) {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error on ${method} ${path}: Status ${response.status} - ${text}`);
  }

  return response.json();
}

async function apiGet(path: string) {
  return apiRequest(path, 'GET');
}

async function apiPost(path: string, body: any) {
  return apiRequest(path, 'POST', body);
}

async function apiPut(path: string, body: any) {
  return apiRequest(path, 'PUT', body);
}

async function main() {
  console.log('🔑 Authenticating as administrator...');
  const loginRes = await apiPost('/api/auth/login', {
    email: '[EMAIL_ADDRESS]',
    password: '[PASSWORD]',
  });
  sessionToken = loginRes.token;
  console.log(`✅ Logged in successfully as: ${loginRes.user.displayName} (${loginRes.user.role})`);

  // Load gameslist.json
  const jsonPath = resolve(__dirname, '../../../gameslist.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ JSON file not found at: ${jsonPath}`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(jsonPath, 'utf8');
  const gamesData: GameDataInput[] = JSON.parse(fileData);
  console.log(`📋 Loaded ${gamesData.length} games from gameslist.json`);

  console.log('📥 Fetching current catalog records from the API for caching...');

  // High limit = 1000 to get everything in 1 page
  const allGamesRes = await apiGet('/api/games/games?limit=1000');
  const allDevsRes = await apiGet('/api/games/developers?limit=1000');
  const allPubsRes = await apiGet('/api/games/publishers?limit=1000');
  const allGensRes = await apiGet('/api/games/genres?limit=1000');
  const allPlatsRes = await apiGet('/api/games/platforms?limit=1000');
  const allThsRes = await apiGet('/api/games/themes?limit=1000');

  const allGames = allGamesRes.items || [];
  const allDevs = allDevsRes.items || [];
  const allPubs = allPubsRes.items || [];
  const allGens = allGensRes.items || [];
  const allPlats = allPlatsRes.items || [];
  const allThs = allThsRes.items || [];

  console.log(`🔍 API Caches: ${allGames.length} Games, ${allDevs.length} Devs, ${allPubs.length} Pubs, ${allGens.length} Genres, ${allPlats.length} Platforms, ${allThs.length} Themes`);

  // Build Cache Maps
  const gameCache = new Map<string, string>(); // slug/titleLower -> id
  const devCache = new Map<string, string>();  // nameLower/slug -> id
  const pubCache = new Map<string, string>();  // nameLower/slug -> id
  const genCache = new Map<string, string>();  // nameLower/slug -> id
  const platCache = new Map<string, string>(); // nameLower/slug -> id
  const thCache = new Map<string, string>();   // nameLower/slug -> id

  for (const g of allGames) {
    gameCache.set(g.slug, g.id);
    gameCache.set(g.title.toLowerCase().trim(), g.id);
  }
  for (const d of allDevs) {
    devCache.set(d.name.toLowerCase().trim(), d.id);
    devCache.set(d.slug, d.id);
  }
  for (const p of allPubs) {
    pubCache.set(p.name.toLowerCase().trim(), p.id);
    pubCache.set(p.slug, p.id);
  }
  for (const gn of allGens) {
    genCache.set(gn.name.toLowerCase().trim(), gn.id);
    genCache.set(gn.slug, gn.id);
  }
  for (const pl of allPlats) {
    platCache.set(pl.name.toLowerCase().trim(), pl.id);
    platCache.set(pl.slug, pl.id);
  }
  for (const th of allThs) {
    thCache.set(th.name.toLowerCase().trim(), th.id);
    thCache.set(th.slug, th.id);
  }

  console.log('🏁 Starting API seeding process...');

  let createdGamesCount = 0;
  let updatedGamesCount = 0;

  for (const gameData of gamesData) {
    const title = gameData.title.trim();
    const titleLower = title.toLowerCase();
    const gameSlug = slugify(title);

    // 1. Resolve Developer IDs
    const developerIds: string[] = [];
    for (const devName of gameData.developer || []) {
      const cleanDevName = devName.trim();
      if (!cleanDevName) continue;
      const devLower = cleanDevName.toLowerCase();
      const devSlug = slugify(cleanDevName);

      let devId = devCache.get(devLower) || devCache.get(devSlug);
      if (!devId) {
        console.log(`➕ Developer [${cleanDevName}] not found. Creating via API...`);
        const newDev = await apiPost('/api/games/developers', {
          name: devLower,
          slug: devSlug
        });
        devId = newDev.id;
        devCache.set(devLower, devId!);
        devCache.set(devSlug, devId!);
      }
      developerIds.push(devId!);
    }

    // 2. Resolve Publisher IDs
    const publisherIds: string[] = [];
    const publishersInput = typeof gameData.publisher === 'string'
      ? [gameData.publisher]
      : Array.isArray(gameData.publisher)
        ? gameData.publisher
        : [];

    for (const pubName of publishersInput) {
      const cleanPubName = pubName.trim();
      if (!cleanPubName) continue;
      const pubLower = cleanPubName.toLowerCase();
      const pubSlug = slugify(cleanPubName);

      let pubId = pubCache.get(pubLower) || pubCache.get(pubSlug);
      if (!pubId) {
        console.log(`➕ Publisher [${cleanPubName}] not found. Creating via API...`);
        const newPub = await apiPost('/api/games/publishers', {
          name: pubLower,
          slug: pubSlug
        });
        pubId = newPub.id;
        pubCache.set(pubLower, pubId!);
        pubCache.set(pubSlug, pubId!);
      }
      publisherIds.push(pubId!);
    }

    // 3. Resolve Genre IDs
    const genreIds: string[] = [];
    for (const genName of gameData.genre || []) {
      const cleanGenName = genName.trim();
      if (!cleanGenName) continue;
      const genLower = cleanGenName.toLowerCase();
      const genSlug = slugify(cleanGenName);

      let genId = genCache.get(genLower) || genCache.get(genSlug);
      if (!genId) {
        console.log(`➕ Genre [${cleanGenName}] not found. Creating via API...`);
        const newGen = await apiPost('/api/games/genres', {
          name: genLower,
          slug: genSlug
        });
        genId = newGen.id;
        genCache.set(genLower, genId!);
        genCache.set(genSlug, genId!);
      }
      genreIds.push(genId!);
    }

    // 4. Resolve Theme IDs
    const themeIds: string[] = [];
    for (const thName of gameData.theme || []) {
      const cleanThName = thName.trim();
      if (!cleanThName) continue;
      const thLower = cleanThName.toLowerCase();
      const thSlug = slugify(cleanThName);

      let thId = thCache.get(thLower) || thCache.get(thSlug);
      if (!thId) {
        console.log(`➕ Theme [${cleanThName}] not found. Creating via API...`);
        const newTh = await apiPost('/api/games/themes', {
          name: thLower,
          slug: thSlug
        });
        thId = newTh.id;
        thCache.set(thLower, thId!);
        thCache.set(thSlug, thId!);
      }
      themeIds.push(thId!);
    }

    // 5. Resolve Platform IDs
    const platformIds: string[] = [];
    for (const rawPlatName of gameData.platforms || []) {
      const mappedName = mapPlatformName(rawPlatName);
      const platLower = mappedName.toLowerCase();
      const platSlug = slugify(mappedName);

      let platId = platCache.get(platLower) || platCache.get(platSlug);
      if (!platId) {
        console.log(`➕ Platform [${mappedName}] not found. Creating via API...`);
        const newPlat = await apiPost('/api/games/platforms', {
          name: platLower,
          slug: platSlug
        });
        platId = newPlat.id;
        platCache.set(platLower, platId!);
        platCache.set(platSlug, platId!);
      }
      platformIds.push(platId!);
    }

    // 6. Create or Update Game via API
    let gameId = gameCache.get(gameSlug) || gameCache.get(titleLower);
    const releaseDate = parseDate(gameData.release_date);

    const payload = {
      title,
      slug: gameSlug,
      releaseDate,
      metacriticScore: gameData.metacritic,
      openCriticScore: gameData.opencritic,
      developerIds,
      publisherIds,
      genreIds,
      themeIds,
      platformIds,
    };

    if (gameId) {
      // Update existing game
      await apiPut(`/api/games/games/${gameId}`, payload);
      updatedGamesCount++;
      console.log(`🔄 [Rank ${gameData.rank}] Updated: "${title}" (ID: ${gameId})`);
    } else {
      // Insert new game
      const newGame = await apiPost('/api/games/games', payload);
      gameId = newGame.id;
      gameCache.set(gameSlug, gameId!);
      gameCache.set(titleLower, gameId!);
      createdGamesCount++;
      console.log(`➕ [Rank ${gameData.rank}] Created: "${title}" (ID: ${gameId})`);
    }

    // 10ms minimal delay to prevent thread starving
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  console.log('\n🏁 Seeding process completed successfully via API!');
  console.log(`➕ Newly created games: ${createdGamesCount}`);
  console.log(`🔄 Existing games updated: ${updatedGamesCount}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeding script encountered an error:', err);
    process.exit(1);
  });
