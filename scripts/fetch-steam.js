/**
 * Script para generar cache local de la biblioteca de Steam
 *
 * 1. Obtiene todos los juegos de la biblioteca via GetOwnedGames
 * 2. Enriquece cada juego con detalles de la tienda + logros (en paralelo)
 * 3. Busca covers y ratings de IGDB como fallback
 * 4. Guarda todo en src/data/cache/steam.json
 *
 * Uso: npm run fetch:steam
 * Requiere: .env con Steam_KEY, Twitch_Client_ID, Twitch_Client_Secret
 *
 * Para HLTB usar: npm run fetch:steam:hltb (script separado que parchea el cache)
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuracion
// ============================================

const STEAM_KEY = process.env.Steam_KEY;
const STEAM_ID = "76561198071323076";

if (!STEAM_KEY) {
    console.error("Falta Steam_KEY en .env");
    process.exit(1);
}

const TWITCH_CLIENT_ID = process.env.Twitch_Client_ID;
const TWITCH_CLIENT_SECRET = process.env.Twitch_Client_Secret;

const BASE_URL = "https://api.steampowered.com";
const STORE_URL = "https://store.steampowered.com/api";
const STEAM_CDN = "https://cdn.akamai.steamstatic.com/steam/apps";
const IGDB_BASE_URL = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

// Store API tiene rate limit estricto (~200 req/5min), usamos 1.5s entre requests
const STORE_REQUEST_DELAY = 1500;
// IGDB permite ~4 req/s
const IGDB_REQUEST_DELAY = 300;

// ============================================
// Helpers
// ============================================

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================
// Steam API
// ============================================

async function fetchOwnedGames() {
    console.log("Obteniendo biblioteca de Steam...\n");

    const url = `${BASE_URL}/IPlayerService/GetOwnedGames/v1/?key=${STEAM_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Steam API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const library = data.response;
    console.log(`   ${library.game_count} juegos encontrados en la biblioteca\n`);
    return library.games || [];
}

async function fetchAppDetails(appid, retries = 2) {
    const url = `${STORE_URL}/appdetails?appids=${appid}&l=spanish`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);

            if (response.status === 429) {
                console.warn(`  Rate limited (429) para appid ${appid}. Esperando 30s...`);
                await delay(30000);
                continue;
            }

            if (!response.ok) return null;

            const data = await response.json();
            const appData = data[String(appid)];
            if (!appData?.success) return null;
            return appData.data;
        } catch (error) {
            if (attempt === retries) {
                console.warn(`  Error obteniendo detalles de ${appid}: ${error.message}`);
                return null;
            }
            await delay(2000);
        }
    }
    return null;
}

/**
 * Obtener logros del jugador para un juego
 * @returns {{ obtained: number, total: number } | null}
 */
async function fetchPlayerAchievements(appid) {
    const url = `${BASE_URL}/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appid}&key=${STEAM_KEY}&steamid=${STEAM_ID}`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        const achievements = data.playerstats?.achievements;
        if (!achievements || achievements.length === 0) return null;

        return {
            obtained: achievements.filter(a => a.achieved === 1).length,
            total: achievements.length,
        };
    } catch {
        return null;
    }
}

/**
 * Obtener detalles de tienda + logros en paralelo para un juego
 * Store API es el cuello de botella (1.5s delay), achievements es rapido.
 * Se ejecutan ambos al mismo tiempo para ahorrar el tiempo de achievements.
 */
async function fetchStoreAndAchievements(appid) {
    const [storeDetails, achievements] = await Promise.all([
        fetchAppDetails(appid),
        fetchPlayerAchievements(appid),
    ]);
    return { storeDetails, achievements };
}

// ============================================
// IGDB API - Covers + Ratings como fallback
// ============================================

async function authenticateTwitch() {
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
        console.warn("   Twitch credentials no disponibles, saltando IGDB\n");
        return null;
    }

    console.log("Autenticando con Twitch OAuth2...\n");
    const url = `${TWITCH_TOKEN_URL}?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
    const response = await fetch(url, { method: "POST" });

    if (!response.ok) {
        console.warn(`   Twitch OAuth fallo (${response.status}), saltando IGDB\n`);
        return null;
    }

    const data = await response.json();
    console.log(`   Token obtenido (expira en ${Math.round(data.expires_in / 3600)}h)\n`);
    return data.access_token;
}

async function fetchIGDB(accessToken, endpoint, body, retries = 3) {
    const url = `${IGDB_BASE_URL}${endpoint}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Client-ID": TWITCH_CLIENT_ID,
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "text/plain",
                },
                body,
            });

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
                console.warn(`  Rate limited IGDB (429). Esperando ${retryAfter}s...`);
                await delay(retryAfter * 1000);
                continue;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`IGDB ${response.status}: ${text}`);
            }

            await delay(IGDB_REQUEST_DELAY);
            return await response.json();
        } catch (error) {
            if (attempt === retries) throw error;
            await delay(2000);
        }
    }
}

/**
 * Buscar covers y aggregated_rating de IGDB en batch usando Steam app IDs
 * Usa el endpoint external_games (external_game_source = 1 = Steam) para mapear appids -> IGDB IDs
 * Luego obtiene covers y ratings de esos juegos
 *
 * @returns {{ coverMap: Map<string, string>, ratingMap: Map<string, number>, appidToIgdbId: Map<string, number> }}
 */
async function fetchIGDBData(accessToken, appids) {
    const coverMap = new Map();   // appid -> igdb cover url
    const ratingMap = new Map();  // appid -> aggregated_rating (metacritic fallback)

    if (!accessToken || appids.length === 0) return { coverMap, ratingMap };

    const BATCH = 100;

    console.log(`Buscando datos IGDB para ${appids.length} juegos...\n`);

    // Paso 1: Mapear Steam appids -> IGDB game IDs via external_games
    const appidToIgdbId = new Map();

    for (let i = 0; i < appids.length; i += BATCH) {
        const batch = appids.slice(i, i + BATCH);
        const uids = batch.map(id => `"${id}"`).join(",");
        const body = `fields game, uid; where external_game_source = 1 & uid = (${uids}); limit ${BATCH};`;

        try {
            const results = await fetchIGDB(accessToken, "/external_games", body);
            for (const r of results) {
                appidToIgdbId.set(String(r.uid), r.game);
            }
            console.log(`   [${Math.min(i + BATCH, appids.length)}/${appids.length}] ${results.length} mapeados en IGDB`);
        } catch (error) {
            console.warn(`   Error buscando external_games batch: ${error.message}`);
        }
    }

    console.log(`   ${appidToIgdbId.size}/${appids.length} juegos encontrados en IGDB\n`);

    // Paso 2: Obtener covers + aggregated_rating de los IGDB game IDs
    const igdbIds = [...new Set(appidToIgdbId.values())];

    for (let i = 0; i < igdbIds.length; i += BATCH) {
        const batch = igdbIds.slice(i, i + BATCH);
        const ids = batch.join(",");
        const body = `fields id, cover.image_id, aggregated_rating; where id = (${ids}); limit ${BATCH};`;

        try {
            const results = await fetchIGDB(accessToken, "/games", body);
            const igdbIdToData = new Map();
            for (const r of results) {
                igdbIdToData.set(r.id, {
                    coverId: r.cover?.image_id || null,
                    rating: r.aggregated_rating ? Math.round(r.aggregated_rating) : null,
                });
            }

            // Mapear de vuelta a Steam appids
            for (const [appid, igdbId] of appidToIgdbId) {
                const igdbData = igdbIdToData.get(igdbId);
                if (igdbData) {
                    if (igdbData.coverId) {
                        coverMap.set(appid, `https://images.igdb.com/igdb/image/upload/t_cover_big/${igdbData.coverId}.webp`);
                    }
                    if (igdbData.rating) {
                        ratingMap.set(appid, igdbData.rating);
                    }
                }
            }
        } catch (error) {
            console.warn(`   Error obteniendo datos IGDB batch: ${error.message}`);
        }
    }

    console.log(`   ${coverMap.size} covers IGDB obtenidos`);
    console.log(`   ${ratingMap.size} ratings IGDB obtenidos\n`);
    return { coverMap, ratingMap };
}

// ============================================
// Normalizacion
// ============================================

function normalizeGame(steamGame, storeDetails, igdbCover = null, igdbRating = null, achievements = null) {
    const appid = steamGame.appid;

    // Metacritic: preferir Steam Store, fallback a IGDB aggregated_rating
    const metacritic = storeDetails?.metacritic?.score || igdbRating || null;

    return {
        appid,
        name: steamGame.name,
        playtime_forever: steamGame.playtime_forever || 0,
        playtime_2weeks: steamGame.playtime_2weeks || 0,
        playtime_windows: steamGame.playtime_windows_forever || 0,
        playtime_mac: steamGame.playtime_mac_forever || 0,
        playtime_linux: steamGame.playtime_linux_forever || 0,
        playtime_deck: steamGame.playtime_deck_forever || 0,
        rtime_last_played: steamGame.rtime_last_played || 0,
        // Imagenes
        headerImage: `${STEAM_CDN}/${appid}/header.jpg`,
        capsuleImage: `${STEAM_CDN}/${appid}/library_600x900.jpg`,
        igdbCover: igdbCover || null,
        iconUrl: steamGame.img_icon_url
            ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${steamGame.img_icon_url}.jpg`
            : null,
        // Store details
        genres: storeDetails?.genres?.map(g => g.description) || [],
        shortDescription: storeDetails?.short_description || null,
        developers: storeDetails?.developers || [],
        publishers: storeDetails?.publishers || [],
        releaseDate: storeDetails?.release_date?.date || null,
        categories: storeDetails?.categories?.map(c => c.description) || [],
        metacritic,
        // HowLongToBeat (se parchea desde fetch-steam-hltb.js)
        hltb: null,
        // Logros
        achievements: achievements || null,
        // URL
        storeUrl: `https://store.steampowered.com/app/${appid}`,
    };
}

// ============================================
// Logica principal
// ============================================

async function main() {
    const startTime = Date.now();
    console.log("Fetching Steam library...\n");

    // PASO 1: Obtener todos los juegos de la biblioteca
    const rawGames = await fetchOwnedGames();

    // Ordenar por playtime (mas jugados primero)
    const sortedGames = [...rawGames].sort((a, b) =>
        (b.playtime_forever || 0) - (a.playtime_forever || 0)
    );

    // PASO 2: Enriquecer con detalles de la Store API + logros (en paralelo por juego)
    console.log(`Enriqueciendo ${sortedGames.length} juegos con detalles de tienda + logros...\n`);

    const storeDetailsMap = new Map();
    const achievementsMap = new Map();
    let enrichedCount = 0;
    let achievementsFound = 0;

    for (let i = 0; i < sortedGames.length; i++) {
        const game = sortedGames[i];
        const progress = `[${i + 1}/${sortedGames.length}]`;

        // Store details + achievements en paralelo
        const { storeDetails, achievements } = await fetchStoreAndAchievements(game.appid);

        if (storeDetails) {
            enrichedCount++;
            storeDetailsMap.set(game.appid, storeDetails);
        }

        if (achievements) {
            achievementsFound++;
            achievementsMap.set(game.appid, achievements);
        }

        const genres = storeDetails?.genres?.map(g => g.description).join(', ') || 'sin generos';
        const achText = achievements ? `${achievements.obtained}/${achievements.total} logros` : 'sin logros';
        console.log(`   ${progress} ${game.name} - ${genres} | ${achText}`);

        // El delay lo dicta Store API (el mas lento), achievements es instantaneo
        if (i < sortedGames.length - 1) {
            await delay(STORE_REQUEST_DELAY);
        }
    }

    console.log(`\n   Enriquecidos: ${enrichedCount}/${sortedGames.length}`);
    console.log(`   Logros: ${achievementsFound}/${sortedGames.length} juegos con logros\n`);

    // PASO 3: Obtener covers + ratings de IGDB como fallback
    const accessToken = await authenticateTwitch();
    const allAppids = sortedGames.map(g => String(g.appid));
    const { coverMap: igdbCoverMap, ratingMap: igdbRatingMap } = await fetchIGDBData(accessToken, allAppids);

    // PASO 4: Combinar todo y normalizar
    // Intentar preservar hltb del cache existente
    let existingHltbMap = new Map();
    try {
        const cachePath = resolve(__dirname, "../src/data/cache/steam.json");
        if (existsSync(cachePath)) {
            const { readFileSync } = await import('fs');
            const existing = JSON.parse(readFileSync(cachePath, 'utf-8'));
            for (const g of (existing.games || [])) {
                if (g.hltb) existingHltbMap.set(g.appid, g.hltb);
            }
            console.log(`   Preservando ${existingHltbMap.size} datos HLTB del cache existente\n`);
        }
    } catch { /* sin cache previo */ }

    const enrichedGames = sortedGames.map(game => {
        const normalized = normalizeGame(
            game,
            storeDetailsMap.get(game.appid) || null,
            igdbCoverMap.get(String(game.appid)) || null,
            igdbRatingMap.get(String(game.appid)) || null,
            achievementsMap.get(game.appid) || null,
        );
        // Preservar HLTB del cache existente
        normalized.hltb = existingHltbMap.get(game.appid) || null;
        return normalized;
    });

    // PASO 5: Calcular estadisticas
    const totalPlaytime = enrichedGames.reduce((sum, g) => sum + g.playtime_forever, 0);
    const playedGames = enrichedGames.filter(g => g.playtime_forever > 0);
    const recentGames = enrichedGames.filter(g => g.playtime_2weeks > 0);
    const gamesWithHLTB = enrichedGames.filter(g => g.hltb?.main).length;
    const gamesWithMetacritic = enrichedGames.filter(g => g.metacritic).length;

    // PASO 6: Guardar en JSON
    const cacheData = {
        fetchedAt: new Date().toISOString(),
        steamId: STEAM_ID,
        totalGames: enrichedGames.length,
        playedGames: playedGames.length,
        neverPlayed: enrichedGames.length - playedGames.length,
        recentlyPlayed: recentGames.length,
        totalPlaytimeMinutes: totalPlaytime,
        totalPlaytimeHours: Math.round(totalPlaytime / 60),
        gamesWithHLTB,
        gamesWithMetacritic,
        games: enrichedGames,
    };

    const cachePath = resolve(__dirname, "../src/data/cache/steam.json");
    const cacheDir = dirname(cachePath);

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (Buffer.byteLength(JSON.stringify(cacheData)) / 1024).toFixed(1);

    console.log("===================================");
    console.log(`Steam library cache guardado en src/data/cache/steam.json`);
    console.log(`   ${enrichedGames.length} juegos totales`);
    console.log(`   ${playedGames.length} jugados (${enrichedGames.length - playedGames.length} nunca jugados)`);
    console.log(`   ${recentGames.length} jugados recientemente`);
    console.log(`   ${Math.round(totalPlaytime / 60).toLocaleString()}h totales`);
    console.log(`   ${gamesWithMetacritic} juegos con metacritic`);
    console.log(`   ${gamesWithHLTB} juegos con datos HLTB (preservados)`);
    console.log(`   ${igdbCoverMap.size} covers IGDB`);
    console.log(`   ${fileSize} KB`);
    console.log(`   ${elapsed}s`);
    console.log("===================================");
}

main().catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
});
