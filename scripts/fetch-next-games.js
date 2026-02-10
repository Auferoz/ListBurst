/**
 * Script para generar caché local de próximos juegos
 *
 * 1. Busca cada juego de tu lista personal (nextGamesDB.js) en IGDB
 * 2. Consulta IGDB por TODOS los lanzamientos mes a mes (hypes > 2)
 * 3. Merge: los de tu lista se marcan con inMyList=true
 * 4. Guarda todo en src/data/cache/nextGames.json
 *
 * Uso: npm run fetch:games
 * Requiere: .env con Twitch_Client_ID y Twitch_Client_Secret
 */

import 'dotenv/config';
import { proximamenteGames } from '../src/data/nextGamesDB.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuración
// ============================================

const TWITCH_CLIENT_ID = process.env.Twitch_Client_ID;
const TWITCH_CLIENT_SECRET = process.env.Twitch_Client_Secret;

if (!TWITCH_CLIENT_ID) {
    console.error("❌ Falta Twitch_Client_ID en .env");
    process.exit(1);
}
if (!TWITCH_CLIENT_SECRET) {
    console.error("❌ Falta Twitch_Client_Secret en .env");
    process.exit(1);
}

const IGDB_BASE_URL = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

// IGDB permite ~4 req/s, usamos 300ms entre requests
const REQUEST_DELAY = 300;
const BATCH_SIZE = 3;

// Plataformas principales (PC, PS5, PS4, Xbox Series, Xbox One, Switch, Switch 2)
const PLATFORM_IDS = [6, 48, 49, 130, 167, 169, 512];

// Filtro de relevancia: solo juegos con hypes > este valor
const MIN_HYPES = 2;

// Campos IGDB para la query de juegos por mes
const GAME_FIELDS = `name, summary, first_release_date, cover.image_id, genres.name, platforms.name, screenshots.image_id, artworks.image_id, slug, url, involved_companies.company.name, involved_companies.developer, involved_companies.publisher, hypes`;

// ============================================
// Helpers
// ============================================

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let igdbRequestCount = 0;

/**
 * Obtener access_token de Twitch OAuth2
 */
async function authenticateTwitch() {
    console.log("🔑 Autenticando con Twitch OAuth2...\n");

    const url = `${TWITCH_TOKEN_URL}?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;

    const response = await fetch(url, { method: "POST" });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Twitch OAuth falló (${response.status}): ${text}`);
    }

    const data = await response.json();
    console.log(`   ✅ Token obtenido (expira en ${Math.round(data.expires_in / 3600)}h)\n`);
    return data.access_token;
}

/**
 * Fetch a IGDB API con retry en 429
 */
async function fetchIGDB(accessToken, endpoint, body, retries = 3) {
    const url = `${IGDB_BASE_URL}${endpoint}`;
    igdbRequestCount++;

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
                console.warn(`  ⏳ Rate limited (429). Esperando ${retryAfter}s... (intento ${attempt}/${retries})`);
                await delay(retryAfter * 1000);
                continue;
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`IGDB ${response.status}: ${text} → ${endpoint}`);
            }

            await delay(REQUEST_DELAY);
            return await response.json();
        } catch (error) {
            if (attempt === retries) throw error;
            console.warn(`  ⚠️ Error en intento ${attempt}/${retries}: ${error.message}. Reintentando...`);
            await delay(2000);
        }
    }
}

/**
 * Buscar un juego en IGDB por título (para juegos de mi lista)
 */
async function searchGame(accessToken, title) {
    const cleanTitle = title.replace(/"/g, '\\"');

    const body = `search "${cleanTitle}"; fields ${GAME_FIELDS}, release_dates.human, release_dates.date, release_dates.platform.name; where version_parent = null; limit 5;`;

    try {
        const results = await fetchIGDB(accessToken, "/games", body);

        if (!results || results.length === 0) return null;

        // Intentar encontrar coincidencia exacta primero
        const exactMatch = results.find(
            (r) => r.name.toLowerCase() === title.toLowerCase()
        );

        return exactMatch || results[0];
    } catch (error) {
        console.warn(`     ⚠️ Error buscando "${title}": ${error.message}`);
        return null;
    }
}

/**
 * Normalizar datos de IGDB a estructura uniforme
 */
function normalizeIGDB(igdbData) {
    if (!igdbData) return null;
    return {
        id: igdbData.id,
        name: igdbData.name,
        slug: igdbData.slug,
        url: igdbData.url,
        summary: igdbData.summary || null,
        firstReleaseDate: igdbData.first_release_date || null,
        cover: igdbData.cover?.image_id || null,
        genres: igdbData.genres?.map((g) => g.name) || [],
        platforms: igdbData.platforms?.map((p) => p.name) || [],
        screenshots: igdbData.screenshots?.map((s) => s.image_id) || [],
        artworks: igdbData.artworks?.map((a) => a.image_id) || [],
        releaseDates: igdbData.release_dates?.map((rd) => ({
            human: rd.human,
            date: rd.date,
            platform: rd.platform?.name || null,
        })) || [],
        developers: igdbData.involved_companies
            ?.filter((ic) => ic.developer)
            ?.map((ic) => ic.company?.name)
            ?.filter(Boolean) || [],
        publishers: igdbData.involved_companies
            ?.filter((ic) => ic.publisher)
            ?.map((ic) => ic.company?.name)
            ?.filter(Boolean) || [],
        hypes: igdbData.hypes || 0,
    };
}

/**
 * Convertir Unix timestamp a formato DD-MM-YYYY
 */
function unixToDateStr(unix) {
    const d = new Date(unix * 1000);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
}

/**
 * Generar rango de meses desde hoy hasta fin de 2026
 * Retorna array de { label, startUnix, endUnix }
 */
function generateMonthRanges() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based

    const ranges = [];
    const endYear = 2026;
    const endMonth = 11; // Diciembre

    let y = currentYear;
    let m = currentMonth;

    while (y < endYear || (y === endYear && m <= endMonth)) {
        const start = new Date(Date.UTC(y, m, 1));
        const end = new Date(Date.UTC(y, m + 1, 1));
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        ranges.push({
            label: `${monthNames[m]} ${y}`,
            startUnix: Math.floor(start.getTime() / 1000),
            endUnix: Math.floor(end.getTime() / 1000),
        });

        m++;
        if (m > 11) {
            m = 0;
            y++;
        }
    }

    return ranges;
}

// ============================================
// Lógica principal
// ============================================

async function main() {
    const startTime = Date.now();
    console.log("🎮 Fetching next games from IGDB...\n");

    // PASO 1: Autenticación
    const accessToken = await authenticateTwitch();

    // ──────────────────────────────────────────
    // PASO 2: Buscar juegos de MI LISTA en IGDB
    // ──────────────────────────────────────────
    console.log(`📋 Buscando ${proximamenteGames.length} juegos de mi lista en IGDB...\n`);

    const myListResults = [];
    let myFoundCount = 0;

    for (let i = 0; i < proximamenteGames.length; i += BATCH_SIZE) {
        const batch = proximamenteGames.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(proximamenteGames.length / BATCH_SIZE);

        console.log(`  🔍 Batch ${batchNum}/${totalBatches}...`);

        const results = await Promise.all(
            batch.map(async (game) => {
                const igdbData = await searchGame(accessToken, game.title);

                if (igdbData) {
                    myFoundCount++;
                    console.log(`     ✅ ${game.title} → "${igdbData.name}" (ID: ${igdbData.id})`);
                } else {
                    console.log(`     ❌ ${game.title} → No encontrado`);
                }

                return {
                    localData: {
                        title: game.title,
                        poster: game.poster,
                        dateRelease: game.dateRelease,
                    },
                    igdb: normalizeIGDB(igdbData),
                    inMyList: true,
                    source: "mylist",
                };
            })
        );

        myListResults.push(...results);
    }

    console.log(`\n   ✅ Mi lista: ${myFoundCount}/${proximamenteGames.length} encontrados en IGDB\n`);

    // Set de IGDB IDs de mi lista para cruce posterior
    const myListIGDBIds = new Set(
        myListResults
            .filter((g) => g.igdb?.id)
            .map((g) => g.igdb.id)
    );

    // ──────────────────────────────────────────
    // PASO 3: Fetch de TODOS los lanzamientos por mes
    // ──────────────────────────────────────────
    const monthRanges = generateMonthRanges();
    console.log(`📅 Buscando lanzamientos por mes (${monthRanges.length} meses: ${monthRanges[0].label} → ${monthRanges[monthRanges.length - 1].label})...\n`);

    const apiGamesMap = new Map(); // igdbId → game data (para deduplicar)

    for (const range of monthRanges) {
        const body = `fields ${GAME_FIELDS}; where first_release_date >= ${range.startUnix} & first_release_date < ${range.endUnix} & platforms = (${PLATFORM_IDS.join(",")}) & cover != null & version_parent = null & parent_game = null & hypes > ${MIN_HYPES}; sort first_release_date asc; limit 500;`;

        try {
            const games = await fetchIGDB(accessToken, "/games", body);
            let newCount = 0;

            for (const game of games) {
                if (!apiGamesMap.has(game.id)) {
                    apiGamesMap.set(game.id, game);
                    newCount++;
                }
            }

            console.log(`   📅 ${range.label}: ${games.length} juegos (${newCount} nuevos)`);
        } catch (error) {
            console.warn(`   ⚠️ Error en ${range.label}: ${error.message}`);
        }
    }

    console.log(`\n   ✅ Total juegos de API: ${apiGamesMap.size}\n`);

    // ──────────────────────────────────────────
    // PASO 4: Merge - combinar mi lista con API
    // ──────────────────────────────────────────
    console.log("🔄 Merge: combinando mi lista con juegos de la API...\n");

    const finalGames = [];
    let bothCount = 0;
    let apiOnlyCount = 0;
    let myListOnlyCount = 0;

    // Primero: agregar todos los juegos de mi lista
    for (const myGame of myListResults) {
        const igdbId = myGame.igdb?.id;

        if (igdbId && apiGamesMap.has(igdbId)) {
            // El juego está en ambos: mi lista Y la API
            myGame.source = "both";
            bothCount++;
            // Eliminar de apiGamesMap para no duplicar
            apiGamesMap.delete(igdbId);
        } else {
            myListOnlyCount++;
        }

        finalGames.push(myGame);
    }

    // Segundo: agregar juegos de la API que NO están en mi lista
    for (const [igdbId, igdbData] of apiGamesMap) {
        if (myListIGDBIds.has(igdbId)) continue; // Ya está en mi lista

        const normalized = normalizeIGDB(igdbData);
        const coverUrl = normalized.cover
            ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${normalized.cover}.webp`
            : null;

        finalGames.push({
            localData: {
                title: normalized.name,
                poster: coverUrl || "",
                dateRelease: normalized.firstReleaseDate
                    ? unixToDateStr(normalized.firstReleaseDate)
                    : "31-12-2026", // TBA si no tiene fecha
            },
            igdb: normalized,
            inMyList: false,
            source: "api",
        });

        apiOnlyCount++;
    }

    console.log(`   📊 En ambos (mi lista + API): ${bothCount}`);
    console.log(`   📋 Solo en mi lista: ${myListOnlyCount}`);
    console.log(`   🌐 Solo de API: ${apiOnlyCount}`);
    console.log(`   📊 Total final: ${finalGames.length}\n`);

    // ──────────────────────────────────────────
    // PASO 5: Guardar en JSON
    // ──────────────────────────────────────────
    const cacheData = {
        fetchedAt: new Date().toISOString(),
        totalGames: finalGames.length,
        myListCount: myListResults.length,
        apiOnlyCount,
        bothCount,
        games: finalGames,
    };

    const cachePath = resolve(__dirname, "../src/data/cache/nextGames.json");
    const cacheDir = dirname(cachePath);

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (Buffer.byteLength(JSON.stringify(cacheData)) / 1024).toFixed(1);

    console.log("═══════════════════════════════════════");
    console.log(`✅ Next games cache guardado en src/data/cache/nextGames.json`);
    console.log(`   🎮 ${finalGames.length} juegos totales`);
    console.log(`   📋 ${myListResults.length} de mi lista (${bothCount} también en API)`);
    console.log(`   🌐 ${apiOnlyCount} solo de API`);
    console.log(`   📡 ${igdbRequestCount} requests IGDB`);
    console.log(`   📁 ${fileSize} KB`);
    console.log(`   ⏱️  ${elapsed}s`);
    console.log("═══════════════════════════════════════");
}

main().catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
});
