/**
 * Script para generar caché local de series
 * Llama a Trakt API y guarda todo en src/data/cache/series.json
 *
 * Uso: npm run fetch:series
 * Requiere: .env con Trakt_CLIENT_ID
 */

import 'dotenv/config';
import { ListSeriesSeasons } from '../src/data/SeriesDB.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuración
// ============================================

const TRAKT_CLIENT_ID = process.env.Trakt_CLIENT_ID;
const BASE_URL = "https://api.trakt.tv";

if (!TRAKT_CLIENT_ID) {
    console.error("❌ Falta Trakt_CLIENT_ID en .env");
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

// ============================================
// Lógica principal
// ============================================

async function main() {
    const startTime = Date.now();
    console.log("📺 Fetching series...\n");
    console.log(`📋 Procesando ${ListSeriesSeasons.length} entradas de series/temporadas...\n`);

    // Caché de shows para no repetir la misma serie
    const showsCache = new Map();
    const results = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < ListSeriesSeasons.length; i += BATCH_SIZE) {
        const batch = ListSeriesSeasons.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(ListSeriesSeasons.length / BATCH_SIZE);

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

                    return {
                        show,
                        season,
                        people,
                        episodes,
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

    // Guardar en JSON
    const cacheData = {
        fetchedAt: new Date().toISOString(),
        totalEntries: results.length,
        uniqueShows: showsCache.size,
        series: results,
    };

    const cachePath = resolve(__dirname, "../src/data/cache/series.json");
    const cacheDir = dirname(cachePath);

    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (Buffer.byteLength(JSON.stringify(cacheData)) / 1024 / 1024).toFixed(2);

    console.log("\n═══════════════════════════════════════");
    console.log(`✅ Series cache guardado en src/data/cache/series.json`);
    console.log(`   📊 ${results.length} entradas (${showsCache.size} series únicas)`);
    console.log(`   📡 ${requestCount} requests Trakt`);
    console.log(`   📁 ${fileSize} MB`);
    console.log(`   ⏱️  ${elapsed}s`);
    console.log("═══════════════════════════════════════");
}

main().catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
});
