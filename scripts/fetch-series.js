/**
 * Script para generar caché local de series
 * Llama a Trakt API y guarda todo en src/data/cache/series.json
 *
 * Uso:
 *   npm run fetch:series          # Fetch completo (todas las series)
 *   npm run fetch:series:current   # Solo series del año actual (rápido)
 *
 * Requiere: .env con Trakt_CLIENT_ID
 */

import 'dotenv/config';
import { ListSeriesSeasons, ListSeriesByYear } from '../src/data/SeriesDB.js';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuración
// ============================================

const TRAKT_CLIENT_ID = process.env.Trakt_CLIENT_ID;
const BASE_URL = "https://api.trakt.tv";

const CURRENT_YEAR = new Date().getFullYear();
const isCurrentOnly = process.argv.includes("--current");

if (!TRAKT_CLIENT_ID) {
    console.error("❌ Falta Trakt_CLIENT_ID en .env");
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

let requestCount = 0;

/**
 * Fetch a Trakt API con retry en 429
 */
async function fetchTrakt(endpoint, retries = 3) {
    const url = `${BASE_URL}${endpoint}`;
    requestCount++;

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
    const cachePath = resolve(__dirname, "../src/data/cache/series.json");
    const cacheDir = dirname(cachePath);

    if (isCurrentOnly) {
        console.log(`📺 Fetching series (solo año actual: ${CURRENT_YEAR})...\n`);
    } else {
        console.log("📺 Fetching series (todas las entradas)...\n");
    }

    // Cargar caché existente para modo --current
    const existingCache = isCurrentOnly ? loadExistingCache(cachePath) : null;

    if (isCurrentOnly && !existingCache) {
        console.error("❌ No existe caché previo. Ejecuta primero un fetch completo: npm run fetch:series");
        process.exit(1);
    }

    // Determinar qué entradas fetchear
    let entriesToFetch;
    if (isCurrentOnly) {
        const currentYearGroup = ListSeriesByYear.find(g => g.year === CURRENT_YEAR);
        entriesToFetch = currentYearGroup
            ? currentYearGroup.series.map(s => ({ ...s, yearViewed: CURRENT_YEAR }))
            : [];
    } else {
        entriesToFetch = ListSeriesSeasons;
    }

    console.log(`📋 Procesando ${entriesToFetch.length} entradas de series/temporadas...\n`);

    // En modo --current, construir caché de shows desde el caché existente
    // para no re-fetchear metadata de series que ya existen
    const showsCache = new Map();

    if (isCurrentOnly && existingCache) {
        for (const entry of existingCache.series) {
            if (entry.show) {
                const slug = entry.show.ids?.slug;
                if (slug && !showsCache.has(slug)) {
                    showsCache.set(slug, entry.show);
                }
                // También cachear videos si existen
                if (entry.videos && !showsCache.has(`${slug}_videos`)) {
                    showsCache.set(`${slug}_videos`, entry.videos);
                }
            }
        }
        console.log(`  ♻️  ${showsCache.size} entradas de shows/videos cargadas del caché\n`);
    }

    const results = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < entriesToFetch.length; i += BATCH_SIZE) {
        const batch = entriesToFetch.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(entriesToFetch.length / BATCH_SIZE);

        console.log(`  📺 Batch ${batchNum}/${totalBatches}...`);

        const batchResults = await Promise.all(
            batch.map(async (localData) => {
                const { idTrakt, numberSeason } = localData;

                try {
                    // Obtener show (con caché para no repetir)
                    let show;
                    if (showsCache.has(idTrakt)) {
                        show = showsCache.get(idTrakt);
                    } else {
                        console.log(`     📥 Show: ${idTrakt}`);
                        show = await fetchTrakt(`/shows/${idTrakt}?extended=full,images`);
                        showsCache.set(idTrakt, show);
                    }

                    // Obtener info de la temporada
                    console.log(`     📥 Season: ${idTrakt} S${numberSeason}`);
                    const season = await fetchTrakt(
                        `/shows/${idTrakt}/seasons/${numberSeason}/info?extended=full,images`
                    );

                    // Obtener people de la temporada
                    let people = null;
                    try {
                        people = await fetchTrakt(
                            `/shows/${idTrakt}/seasons/${numberSeason}/people?extended=full,images`
                        );
                    } catch (error) {
                        console.warn(`     ⚠️ Sin people para ${idTrakt} S${numberSeason}`);
                    }

                    // Obtener episodios de la temporada
                    let episodes = [];
                    try {
                        console.log(`     📥 Episodes: ${idTrakt} S${numberSeason}`);
                        episodes = await fetchTrakt(
                            `/shows/${idTrakt}/seasons/${numberSeason}?extended=full,images`
                        );
                    } catch (error) {
                        console.warn(`     ⚠️ Sin episodes para ${idTrakt} S${numberSeason}`);
                    }

                    // Obtener videos de la serie (con caché para no repetir)
                    let videos = [];
                    if (!showsCache.has(`${idTrakt}_videos`)) {
                        try {
                            console.log(`     📥 Videos: ${idTrakt}`);
                            videos = await fetchTrakt(`/shows/${idTrakt}/videos`);
                            showsCache.set(`${idTrakt}_videos`, videos);
                        } catch (error) {
                            console.warn(`     ⚠️ Sin videos para ${idTrakt}`);
                            showsCache.set(`${idTrakt}_videos`, []);
                        }
                    } else {
                        videos = showsCache.get(`${idTrakt}_videos`);
                    }

                    return {
                        show,
                        season,
                        people,
                        episodes,
                        videos,
                        localData,
                    };
                } catch (error) {
                    console.error(`     ❌ Error en ${idTrakt} S${numberSeason}: ${error.message}`);
                    return {
                        show: showsCache.get(idTrakt) || null,
                        season: null,
                        people: null,
                        localData,
                    };
                }
            })
        );

        results.push(...batchResults);
    }

    // Combinar: en modo --current, mantener entradas de otros años del caché
    let allResults;
    if (isCurrentOnly) {
        const cachedOtherYears = existingCache.series.filter(
            (entry) => entry.localData?.yearViewed !== CURRENT_YEAR
        );
        allResults = [...cachedOtherYears, ...results];
        console.log(`\n📊 Series: ${results.length} actualizadas (${CURRENT_YEAR}) + ${cachedOtherYears.length} del caché = ${allResults.length} total\n`);
    } else {
        allResults = results;
        console.log(`\n📊 Total entradas: ${allResults.length}\n`);
    }

    // Contar shows únicos
    const uniqueShowSlugs = new Set();
    for (const entry of allResults) {
        const slug = entry.show?.ids?.slug || entry.localData?.idTrakt;
        if (slug) uniqueShowSlugs.add(slug);
    }

    // Guardar en JSON
    const cacheData = {
        fetchedAt: new Date().toISOString(),
        totalEntries: allResults.length,
        uniqueShows: uniqueShowSlugs.size,
        series: allResults,
    };

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (Buffer.byteLength(JSON.stringify(cacheData)) / 1024 / 1024).toFixed(2);

    console.log("═══════════════════════════════════════");
    console.log(`✅ Series cache guardado ${isCurrentOnly ? `(modo rápido: ${CURRENT_YEAR})` : "(completo)"}`);
    console.log(`   📊 ${allResults.length} entradas (${uniqueShowSlugs.size} series únicas)`);
    console.log(`   📡 ${requestCount} requests Trakt`);
    console.log(`   📁 ${fileSize} MB`);
    console.log(`   ⏱️  ${elapsed}s`);
    console.log("═══════════════════════════════════════");
}

main().catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
});
