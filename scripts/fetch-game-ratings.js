/**
 * Script para obtener ratings de juegos desde RAWG y OpenCritic (via RapidAPI)
 * Guarda resultados en src/data/cache/gameRatings.json
 *
 * Uso:
 *   npm run fetch:games:ratings
 *
 * Requiere: .env con Rawg_API_KEY y RAPIDAPI_KEY
 */

import 'dotenv/config';
import { ListGames, getGameSlug } from '../src/data/gamesDB.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuración
// ============================================

const RAWG_API_KEY = process.env.Rawg_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAWG_BASE_URL = 'https://api.rawg.io/api';
const OPENCRITIC_BASE_URL = 'https://opencritic-api.p.rapidapi.com';

if (!RAWG_API_KEY) {
    console.error('❌ Falta Rawg_API_KEY en .env');
    process.exit(1);
}

if (!RAPIDAPI_KEY) {
    console.warn('⚠️ Falta RAPIDAPI_KEY en .env — OpenCritic no estará disponible\n');
}

// ============================================
// Helpers
// ============================================

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let requestCount = 0;

async function fetchWithRetry(url, options = {}, retries = 3) {
    requestCount++;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
                console.warn(`  ⏳ Rate limited, esperando ${retryAfter}s...`);
                await delay(retryAfter * 1000);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            console.warn(`  ⚠️ Intento ${attempt} fallido: ${error.message}. Reintentando...`);
            await delay(1000 * attempt);
        }
    }
}

// ============================================
// RAWG API
// ============================================

async function searchRAWG(title) {
    try {
        const params = new URLSearchParams({
            key: RAWG_API_KEY,
            search: title,
            search_precise: 'true',
            page_size: '1',
        });

        const data = await fetchWithRetry(`${RAWG_BASE_URL}/games?${params}`);

        if (data.results && data.results.length > 0) {
            const game = data.results[0];
            return {
                metacritic: game.metacritic || null,
                metacriticUrl: game.metacritic_url || null,
                rawgRating: game.rating ? parseFloat(game.rating.toFixed(1)) : null,
                rawgSlug: game.slug || null,
            };
        }

        return null;
    } catch (error) {
        console.warn(`  ⚠️ RAWG falló para "${title}": ${error.message}`);
        return null;
    }
}

// ============================================
// OpenCritic API (via RapidAPI)
// ============================================

const rapidApiHeaders = {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': 'opencritic-api.p.rapidapi.com',
};

async function searchOpenCritic(title) {
    try {
        const params = new URLSearchParams({ criteria: title });
        const searchData = await fetchWithRetry(
            `${OPENCRITIC_BASE_URL}/game/search?${params}`,
            { headers: rapidApiHeaders }
        );

        if (!searchData || searchData.length === 0) {
            return null;
        }

        const gameResult = searchData[0];
        const gameId = gameResult.id;
        const gameData = await fetchWithRetry(
            `${OPENCRITIC_BASE_URL}/game/${gameId}`,
            { headers: rapidApiHeaders }
        );

        if (!gameData) return null;

        return {
            openCriticId: gameId,
            openCriticSlug: gameResult.dist !== undefined ? gameResult.name : null,
            openCriticScore: gameData.topCriticScore ? Math.round(gameData.topCriticScore) : null,
            openCriticRecommended: gameData.percentRecommended
                ? `${Math.round(gameData.percentRecommended)}%`
                : null,
            openCriticTier: gameData.tier || null,
        };
    } catch (error) {
        console.warn(`  ⚠️ OpenCritic falló para "${title}": ${error.message}`);
        return null;
    }
}

// ============================================
// Main
// ============================================

async function main() {
    console.log('🎮 Obteniendo ratings de juegos...');
    console.log(`📋 Total de juegos: ${ListGames.length}\n`);

    const ratings = {};
    const BATCH_SIZE = 3;
    const DELAY_MS = 200;

    let openCriticAvailable = !!RAPIDAPI_KEY;

    // Probar si OpenCritic via RapidAPI está disponible
    if (openCriticAvailable) {
        try {
            const testResponse = await fetch(`${OPENCRITIC_BASE_URL}/game/search?criteria=test`, {
                headers: rapidApiHeaders,
            });
            if (!testResponse.ok) {
                console.warn(`⚠️ OpenCritic (RapidAPI) respondió ${testResponse.status}, continuando solo con RAWG\n`);
                openCriticAvailable = false;
            } else {
                console.log('✅ OpenCritic (RapidAPI) disponible\n');
            }
        } catch {
            console.warn('⚠️ OpenCritic (RapidAPI) no disponible, continuando solo con RAWG\n');
            openCriticAvailable = false;
        }
    }

    for (let i = 0; i < ListGames.length; i += BATCH_SIZE) {
        const batch = ListGames.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
            batch.map(async (game) => {
                const slug = getGameSlug(game.title);
                console.log(`  🔍 [${i + batch.indexOf(game) + 1}/${ListGames.length}] ${game.title}`);

                const rawgData = await searchRAWG(game.title);
                await delay(DELAY_MS);

                let openCriticData = null;
                if (openCriticAvailable) {
                    openCriticData = await searchOpenCritic(game.title);
                    await delay(DELAY_MS);
                }

                const gameRatings = {};
                if (rawgData) {
                    if (rawgData.metacritic) gameRatings.metacritic = rawgData.metacritic;
                    if (rawgData.metacriticUrl) {
                        gameRatings.metacriticUrl = rawgData.metacriticUrl;
                    } else if (rawgData.rawgSlug) {
                        gameRatings.metacriticUrl = `https://www.metacritic.com/game/${rawgData.rawgSlug}/`;
                    }
                    if (rawgData.rawgRating) gameRatings.rawgRating = rawgData.rawgRating;
                    if (rawgData.rawgSlug) gameRatings.rawgUrl = `https://rawg.io/games/${rawgData.rawgSlug}`;
                }
                if (openCriticData) {
                    if (openCriticData.openCriticScore) gameRatings.openCriticScore = openCriticData.openCriticScore;
                    if (openCriticData.openCriticRecommended) gameRatings.openCriticRecommended = openCriticData.openCriticRecommended;
                    if (openCriticData.openCriticTier) gameRatings.openCriticTier = openCriticData.openCriticTier;
                    if (openCriticData.openCriticId) gameRatings.openCriticUrl = `https://opencritic.com/game/${openCriticData.openCriticId}`;
                }

                return { slug, ratings: Object.keys(gameRatings).length > 0 ? gameRatings : null };
            })
        );

        for (const result of results) {
            if (result.ratings) {
                ratings[result.slug] = result.ratings;
            }
        }

        if (i + BATCH_SIZE < ListGames.length) {
            await delay(DELAY_MS);
        }
    }

    // Guardar resultado
    const output = {
        fetchedAt: new Date().toISOString(),
        ratings,
    };

    const cachePath = resolve(__dirname, '../src/data/cache/gameRatings.json');
    const cacheDir = dirname(cachePath);

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(output, null, 2), 'utf-8');

    const totalWithRatings = Object.keys(ratings).length;
    console.log(`\n✅ Ratings guardados en src/data/cache/gameRatings.json`);
    console.log(`📊 ${totalWithRatings}/${ListGames.length} juegos con ratings encontrados`);
    console.log(`🌐 Total de requests: ${requestCount}`);
}

main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
