/**
 * Script para generar caché local de películas
 * Llama a Trakt API + OMDB API y guarda todo en src/data/cache/movies.json
 *
 * Uso:
 *   npm run fetch:movies          # Fetch completo (todas las listas)
 *   npm run fetch:movies:current   # Solo lista del año actual (rápido)
 *
 * Requiere: .env con Trakt_CLIENT_ID y OMDB_API_KEY
 */

import 'dotenv/config';
import { ListMovies } from '../src/data/MoviesDB.js';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
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

const CURRENT_YEAR = new Date().getFullYear();
const isCurrentOnly = process.argv.includes("--current");

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
    "Accept": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": TRAKT_CLIENT_ID,
    "User-Agent": "ListBurst/1.0 (+https://list-burst.adesigns7.workers.dev)",
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

/**
 * Carga el caché existente si existe
 */
function loadExistingCache(cachePath) {
    try {
        if (existsSync(cachePath)) {
            const raw = readFileSync(cachePath, "utf-8");
            return JSON.parse(raw);
        }
    } catch (error) {
        console.warn(`⚠️ No se pudo leer caché existente: ${error.message}`);
    }
    return null;
}

// ============================================
// Lógica principal
// ============================================

async function main() {
    const startTime = Date.now();
    const cachePath = resolve(__dirname, "../src/data/cache/movies.json");
    const cacheDir = dirname(cachePath);

    if (isCurrentOnly) {
        console.log(`🎬 Fetching movies (solo año actual: ${CURRENT_YEAR})...\n`);
    } else {
        console.log("🎬 Fetching movies (todas las listas)...\n");
    }

    // Cargar caché existente para modo --current
    const existingCache = isCurrentOnly ? loadExistingCache(cachePath) : null;

    if (isCurrentOnly && !existingCache) {
        console.error("❌ No existe caché previo. Ejecuta primero un fetch completo: npm run fetch:movies");
        process.exit(1);
    }

    // Determinar qué listas fetchear
    const listsToFetch = isCurrentOnly
        ? ListMovies.filter((l) => l.idTraktList === `movies-${CURRENT_YEAR}`)
        : ListMovies;

    // PASO 1: Obtener películas de las listas correspondientes
    console.log(`📋 Obteniendo películas de ${listsToFetch.length} lista(s)...\n`);

    const freshMovies = [];

    for (const listData of listsToFetch) {
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
            freshMovies.push(...mapped);
        } catch (error) {
            console.error(`     ❌ Error en ${idTraktList}: ${error.message}`);
        }
    }

    // Combinar: en modo --current, mantener películas de otros años del caché
    let allMovies;
    if (isCurrentOnly) {
        const cachedOtherYears = existingCache.movies.filter(
            (m) => m.yearViewed !== CURRENT_YEAR
        );
        allMovies = [...cachedOtherYears, ...freshMovies];
        console.log(`\n📊 Películas: ${freshMovies.length} actualizadas (${CURRENT_YEAR}) + ${cachedOtherYears.length} del caché = ${allMovies.length} total\n`);
    } else {
        allMovies = freshMovies;
        console.log(`\n📊 Total películas: ${allMovies.length}\n`);
    }

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

    // Determinar qué slugs son nuevos (solo necesitan fetch de OMDB/people/videos)
    const existingSlugs = new Set();
    if (isCurrentOnly && existingCache) {
        for (const m of existingCache.movies) {
            const s = m.movie?.ids?.slug;
            if (s) existingSlugs.add(s);
        }
    }

    const newSlugs = isCurrentOnly
        ? freshMovies
            .map((m) => m.movie?.ids?.slug)
            .filter((s) => s && !existingSlugs.has(s))
        : Array.from(moviesBySlug.keys());

    const newUniqueMovies = isCurrentOnly
        ? uniqueMovies.filter((m) => newSlugs.includes(m.movie?.ids?.slug))
        : uniqueMovies;

    if (isCurrentOnly && newSlugs.length === 0) {
        console.log("ℹ️  No hay películas nuevas que enriquecer.\n");
    } else if (isCurrentOnly) {
        console.log(`🆕 ${newSlugs.length} película(s) nueva(s) para enriquecer\n`);
    }

    // PASO 3: Enriquecer con ratings de OMDB (solo nuevas en modo --current)
    const ratingsMap = new Map();

    // En modo --current, cargar ratings existentes
    if (isCurrentOnly && existingCache) {
        for (const m of existingCache.movies) {
            const imdbId = m.movie?.ids?.imdb;
            if (imdbId && m.externalRatings) {
                ratingsMap.set(imdbId, m.externalRatings);
            }
        }
        console.log(`  ♻️  ${ratingsMap.size} ratings cargados del caché`);
    }

    if (newUniqueMovies.length > 0) {
        console.log("⭐ Obteniendo ratings de OMDB...\n");

        const OMDB_BATCH_SIZE = 5;

        for (let i = 0; i < newUniqueMovies.length; i += OMDB_BATCH_SIZE) {
            const batch = newUniqueMovies.slice(i, i + OMDB_BATCH_SIZE);
            const batchNum = Math.floor(i / OMDB_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(newUniqueMovies.length / OMDB_BATCH_SIZE);

            if (batchNum % 10 === 1 || batchNum === totalBatches) {
                console.log(`  ⭐ OMDB batch ${batchNum}/${totalBatches}...`);
            }

            const results = await Promise.all(
                batch.map(async (m) => {
                    const imdbId = m.movie?.ids?.imdb;
                    if (!imdbId) return [null, null];
                    // En modo --current, no re-fetchear ratings que ya tenemos
                    if (isCurrentOnly && ratingsMap.has(imdbId)) return [null, null];
                    const ratings = await fetchOMDB(imdbId);
                    return [imdbId, ratings];
                })
            );

            for (const [imdbId, ratings] of results) {
                if (imdbId && ratings) ratingsMap.set(imdbId, ratings);
            }
        }

        console.log(`\n  ✅ Ratings obtenidos: ${ratingsMap.size}\n`);
    }

    // Agregar ratings a las películas
    const moviesWithRatings = allMovies.map((movieData) => {
        const imdbId = movieData.movie?.ids?.imdb;
        const externalRatings = imdbId ? ratingsMap.get(imdbId) || null : null;
        return { ...movieData, externalRatings };
    });

    // Slugs únicos para los siguientes pasos
    const slugs = Array.from(moviesBySlug.keys());

    // PASO 4: Obtener videos (solo nuevos en modo --current)
    const videosMap = {};

    // Cargar videos existentes del caché
    if (isCurrentOnly && existingCache?.videos) {
        Object.assign(videosMap, existingCache.videos);
        console.log(`  ♻️  ${Object.keys(videosMap).length} videos cargados del caché`);
    }

    const slugsForVideos = isCurrentOnly ? newSlugs : slugs;

    if (slugsForVideos.length > 0) {
        console.log("🎬 Obteniendo videos de películas...\n");

        const VIDEO_BATCH_SIZE = 3;

        for (let i = 0; i < slugsForVideos.length; i += VIDEO_BATCH_SIZE) {
            const batch = slugsForVideos.slice(i, i + VIDEO_BATCH_SIZE);
            const batchNum = Math.floor(i / VIDEO_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(slugsForVideos.length / VIDEO_BATCH_SIZE);

            if (batchNum % 10 === 1 || batchNum === totalBatches) {
                console.log(`  🎬 Videos batch ${batchNum}/${totalBatches}...`);
            }

            const results = await Promise.all(
                batch.map(async (slug) => {
                    try {
                        const videos = await fetchTrakt(`/movies/${slug}/videos`);
                        return [slug, videos];
                    } catch (error) {
                        console.warn(`     ⚠️ Sin videos para ${slug}: ${error.message}`);
                        return [slug, []];
                    }
                })
            );

            for (const [slug, videos] of results) {
                if (videos && videos.length > 0) videosMap[slug] = videos;
            }
        }

        console.log(`\n  ✅ Videos obtenidos: ${Object.keys(videosMap).length} películas\n`);
    }

    // PASO 5: Obtener people/cast (solo nuevos en modo --current)
    const peopleMap = {};

    // Cargar people existentes del caché
    if (isCurrentOnly && existingCache?.people) {
        Object.assign(peopleMap, existingCache.people);
        console.log(`  ♻️  ${Object.keys(peopleMap).length} cast cargados del caché`);
    }

    const slugsForPeople = isCurrentOnly ? newSlugs : slugs;

    if (slugsForPeople.length > 0) {
        console.log("👥 Obteniendo cast de películas...\n");

        const PEOPLE_BATCH_SIZE = 3;

        for (let i = 0; i < slugsForPeople.length; i += PEOPLE_BATCH_SIZE) {
            const batch = slugsForPeople.slice(i, i + PEOPLE_BATCH_SIZE);
            const batchNum = Math.floor(i / PEOPLE_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(slugsForPeople.length / PEOPLE_BATCH_SIZE);

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
    }

    // PASO 6: Guardar en JSON
    const cacheData = {
        fetchedAt: new Date().toISOString(),
        totalMovies: moviesWithRatings.length,
        uniqueMovies: uniqueMovies.length,
        movies: moviesWithRatings,
        people: peopleMap,
        videos: videosMap,
    };

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (Buffer.byteLength(JSON.stringify(cacheData)) / 1024 / 1024).toFixed(2);

    console.log("═══════════════════════════════════════");
    console.log(`✅ Movies cache guardado ${isCurrentOnly ? `(modo rápido: ${CURRENT_YEAR})` : "(completo)"}`);
    console.log(`   📊 ${moviesWithRatings.length} películas (${uniqueMovies.length} únicas)`);
    console.log(`   👥 ${Object.keys(peopleMap).length} cast entries`);
    console.log(`   🎬 ${Object.keys(videosMap).length} video entries`);
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
