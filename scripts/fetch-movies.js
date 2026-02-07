/**
 * Script para generar caché local de películas
 * Llama a Trakt API + OMDB API y guarda todo en src/data/cache/movies.json
 *
 * Uso: npm run fetch:movies
 * Requiere: .env con Trakt_CLIENT_ID y OMDB_API_KEY
 */

import 'dotenv/config';
import { ListMovies } from '../src/data/MoviesDB.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuración
// ============================================

const TRAKT_CLIENT_ID = process.env.Trakt_CLIENT_ID;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TRAKT_USERNAME = "auferoz";
const BASE_URL = "https://api.trakt.tv";
const OMDB_BASE_URL = "https://www.omdbapi.com/";

if (!TRAKT_CLIENT_ID) {
    console.error("❌ Falta Trakt_CLIENT_ID en .env");
    process.exit(1);
}
if (!OMDB_API_KEY) {
    console.error("❌ Falta OMDB_API_KEY en .env");
    process.exit(1);
}

const traktHeaders = {
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": TRAKT_CLIENT_ID,
};

// ============================================
// Helpers
// ============================================

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let traktRequestCount = 0;
let omdbRequestCount = 0;

/**
 * Fetch a Trakt API con retry en 429
 */
async function fetchTrakt(endpoint, retries = 3) {
    const url = `${BASE_URL}${endpoint}`;
    traktRequestCount++;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, { method: "GET", headers: traktHeaders });

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "10", 10);
                console.warn(`  ⏳ Rate limited (429). Esperando ${retryAfter}s... (intento ${attempt}/${retries})`);
                await delay(retryAfter * 1000);
                continue;
            }

            if (!response.ok) {
                throw new Error(`Trakt ${response.status}: ${response.statusText} → ${endpoint}`);
            }

            // Pausa preventiva entre requests
            await delay(150);
            return await response.json();
        } catch (error) {
            if (attempt === retries) throw error;
            console.warn(`  ⚠️ Error en intento ${attempt}/${retries}: ${error.message}. Reintentando...`);
            await delay(2000);
        }
    }
}

/**
 * Fetch a OMDB API con retry
 */
async function fetchOMDB(imdbId, retries = 2) {
    if (!imdbId) return null;
    omdbRequestCount++;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const url = `${OMDB_BASE_URL}?i=${imdbId}&apikey=${OMDB_API_KEY}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`OMDB ${response.status}`);
            }

            const data = await response.json();

            if (data.Response === "False") {
                if (data.Error === "Request limit reached!") {
                    console.warn(`  ⏳ OMDB límite diario alcanzado`);
                    return null;
                }
                return null;
            }

            // Extraer ratings
            const ratings = {
                imdb: data.imdbRating !== "N/A" ? data.imdbRating : null,
                imdbVotes: data.imdbVotes !== "N/A" ? data.imdbVotes : null,
                metascore: data.Metascore !== "N/A" ? data.Metascore : null,
                rottenTomatoes: null,
                popcornmeter: null,
            };

            // Rotten Tomatoes
            if (data.Ratings && Array.isArray(data.Ratings)) {
                const rtRating = data.Ratings.find((r) => r.Source === "Rotten Tomatoes");
                if (rtRating) ratings.rottenTomatoes = rtRating.Value;
            }

            // Popcornmeter (aproximación desde IMDB)
            if (data.imdbRating && data.imdbRating !== "N/A") {
                const imdbScore = parseFloat(data.imdbRating);
                ratings.popcornmeter = `${Math.round(imdbScore * 10)}%`;
            }

            await delay(80);
            return ratings;
        } catch (error) {
            if (attempt === retries) return null;
            await delay(1000);
        }
    }
    return null;
}

// ============================================
// Lógica principal
// ============================================

async function main() {
    const startTime = Date.now();
    console.log("🎬 Fetching movies...\n");

    // PASO 1: Obtener películas de todas las listas de Trakt
    console.log(`📋 Obteniendo películas de ${ListMovies.length} listas...\n`);

    const allMovies = [];

    for (const listData of ListMovies) {
        const { idTraktList, description } = listData;
        const yearMatch = idTraktList.match(/movies-(\d{4})/);
        const yearViewed = yearMatch ? parseInt(yearMatch[1]) : null;

        try {
            console.log(`  📥 Lista: ${idTraktList}...`);
            const movies = await fetchTrakt(
                `/users/${TRAKT_USERNAME}/lists/${idTraktList}/items/movies/rank/asc?extended=full,images`
            );

            const mapped = movies.map((item, index) => ({
                movie: item.movie,
                rank: item.rank || index + 1,
                listedAt: item.listed_at,
                yearViewed,
            }));

            console.log(`     ✅ ${mapped.length} películas`);
            allMovies.push(...mapped);
        } catch (error) {
            console.error(`     ❌ Error en ${idTraktList}: ${error.message}`);
        }
    }

    console.log(`\n📊 Total películas: ${allMovies.length}\n`);

    // PASO 2: Deduplicar por slug
    const moviesBySlug = new Map();
    for (const movieData of allMovies) {
        const slug = movieData.movie?.ids?.slug;
        if (slug && !moviesBySlug.has(slug)) {
            moviesBySlug.set(slug, movieData);
        }
    }
    const uniqueMovies = Array.from(moviesBySlug.values());
    console.log(`🔄 Películas únicas (por slug): ${uniqueMovies.length}\n`);

    // PASO 3: Enriquecer con ratings de OMDB
    console.log("⭐ Obteniendo ratings de OMDB...\n");

    const OMDB_BATCH_SIZE = 5;
    const ratingsMap = new Map();

    for (let i = 0; i < uniqueMovies.length; i += OMDB_BATCH_SIZE) {
        const batch = uniqueMovies.slice(i, i + OMDB_BATCH_SIZE);
        const batchNum = Math.floor(i / OMDB_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(uniqueMovies.length / OMDB_BATCH_SIZE);

        if (batchNum % 10 === 1 || batchNum === totalBatches) {
            console.log(`  ⭐ OMDB batch ${batchNum}/${totalBatches}...`);
        }

        const results = await Promise.all(
            batch.map(async (m) => {
                const imdbId = m.movie?.ids?.imdb;
                if (!imdbId) return [null, null];
                const ratings = await fetchOMDB(imdbId);
                return [imdbId, ratings];
            })
        );

        for (const [imdbId, ratings] of results) {
            if (imdbId && ratings) ratingsMap.set(imdbId, ratings);
        }
    }

    console.log(`\n  ✅ Ratings obtenidos: ${ratingsMap.size}\n`);

    // Agregar ratings a las películas
    const moviesWithRatings = allMovies.map((movieData) => {
        const imdbId = movieData.movie?.ids?.imdb;
        const externalRatings = imdbId ? ratingsMap.get(imdbId) || null : null;
        return { ...movieData, externalRatings };
    });

    // PASO 4: Obtener people/cast para cada película única
    console.log("👥 Obteniendo cast de películas...\n");

    const peopleMap = {};
    const slugs = Array.from(moviesBySlug.keys());
    const PEOPLE_BATCH_SIZE = 3;

    for (let i = 0; i < slugs.length; i += PEOPLE_BATCH_SIZE) {
        const batch = slugs.slice(i, i + PEOPLE_BATCH_SIZE);
        const batchNum = Math.floor(i / PEOPLE_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(slugs.length / PEOPLE_BATCH_SIZE);

        if (batchNum % 10 === 1 || batchNum === totalBatches) {
            console.log(`  👥 People batch ${batchNum}/${totalBatches}...`);
        }

        const results = await Promise.all(
            batch.map(async (slug) => {
                try {
                    const people = await fetchTrakt(`/movies/${slug}/people?extended=full,images`);
                    return [slug, people];
                } catch (error) {
                    console.warn(`     ⚠️ Sin cast para ${slug}: ${error.message}`);
                    return [slug, null];
                }
            })
        );

        for (const [slug, people] of results) {
            if (people) peopleMap[slug] = people;
        }
    }

    console.log(`\n  ✅ Cast obtenido: ${Object.keys(peopleMap).length} películas\n`);

    // PASO 5: Guardar en JSON
    const cacheData = {
        fetchedAt: new Date().toISOString(),
        totalMovies: moviesWithRatings.length,
        uniqueMovies: uniqueMovies.length,
        movies: moviesWithRatings,
        people: peopleMap,
    };

    const cachePath = resolve(__dirname, "../src/data/cache/movies.json");
    const cacheDir = dirname(cachePath);

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (Buffer.byteLength(JSON.stringify(cacheData)) / 1024 / 1024).toFixed(2);

    console.log("═══════════════════════════════════════");
    console.log(`✅ Movies cache guardado en src/data/cache/movies.json`);
    console.log(`   📊 ${moviesWithRatings.length} películas (${uniqueMovies.length} únicas)`);
    console.log(`   👥 ${Object.keys(peopleMap).length} cast entries`);
    console.log(`   ⭐ ${ratingsMap.size} ratings OMDB`);
    console.log(`   📡 ${traktRequestCount} requests Trakt, ${omdbRequestCount} requests OMDB`);
    console.log(`   📁 ${fileSize} MB`);
    console.log(`   ⏱️  ${elapsed}s`);
    console.log("═══════════════════════════════════════");
}

main().catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
});
