/**
 * Script para parchear datos de HowLongToBeat en el cache de Steam
 *
 * Lee el cache existente de steam.json, busca tiempos en HLTB para cada juego,
 * y actualiza el campo hltb de cada juego sin tocar el resto de los datos.
 *
 * Uso: npm run fetch:steam:hltb
 * Requiere: src/data/cache/steam.json (ejecutar fetch:steam primero)
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================
// Configuracion
// ============================================

const HLTB_REQUEST_DELAY = 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================
// HowLongToBeat API
// ============================================

let hltbToken = null;

async function initHLTBToken() {
    try {
        const resp = await fetch(`https://howlongtobeat.com/api/finder/init?t=${Date.now()}`, {
            headers: { 'User-Agent': UA, 'Referer': 'https://howlongtobeat.com' }
        });
        if (resp.ok) {
            const data = await resp.json();
            hltbToken = data.token;
            return true;
        }
    } catch (error) {
        console.warn(`   Error obteniendo token HLTB: ${error.message}`);
    }
    return false;
}

async function searchHLTB(gameName, retries = 2) {
    if (!hltbToken) return null;

    const searchTerms = gameName
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 0);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const resp = await fetch('https://howlongtobeat.com/api/finder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': UA,
                    'Referer': 'https://howlongtobeat.com',
                    'Origin': 'https://howlongtobeat.com',
                    'x-auth-token': hltbToken,
                },
                body: JSON.stringify({
                    searchType: 'games',
                    searchTerms,
                    searchPage: 1,
                    size: 5,
                    searchOptions: {
                        games: { userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main', rangeTime: { min: null, max: null }, gameplay: { perspective: '', flow: '', genre: '', subGenre: '', difficulty: '' }, rangeYear: { min: '', max: '' }, modifier: '' },
                        users: { sortCategory: 'postcount' },
                        lists: { sortCategory: 'follows' },
                        filter: '', sort: 0, randomizer: 0,
                    },
                    useCache: true,
                })
            });

            if (resp.status === 403) {
                console.warn(`   Token HLTB expirado, renovando...`);
                const renewed = await initHLTBToken();
                if (!renewed || attempt === retries) return null;
                continue;
            }

            if (!resp.ok) return null;

            const data = await resp.json();
            if (!data.data || data.data.length === 0) return null;

            // Buscar coincidencia exacta o la primera
            const nameNorm = gameName.toLowerCase().replace(/[^\w\s]/g, '');
            const match = data.data.find(g =>
                g.game_name.toLowerCase().replace(/[^\w\s]/g, '') === nameNorm
            ) || data.data[0];

            // comp_main, comp_plus, comp_100 estan en segundos
            return {
                id: match.game_id,
                name: match.game_name,
                main: match.comp_main ? Math.round(match.comp_main / 3600) : null,
                mainExtra: match.comp_plus ? Math.round(match.comp_plus / 3600) : null,
                completionist: match.comp_100 ? Math.round(match.comp_100 / 3600) : null,
                mainSeconds: match.comp_main || 0,
                mainExtraSeconds: match.comp_plus || 0,
                completionistSeconds: match.comp_100 || 0,
            };
        } catch (error) {
            if (attempt === retries) {
                console.warn(`   Error HLTB para "${gameName}": ${error.message}`);
                return null;
            }
            await delay(2000);
        }
    }
    return null;
}

// ============================================
// Logica principal
// ============================================

async function main() {
    const startTime = Date.now();
    const cachePath = resolve(__dirname, "../src/data/cache/steam.json");

    if (!existsSync(cachePath)) {
        console.error("No se encontro steam.json. Ejecuta fetch:steam primero.");
        process.exit(1);
    }

    const cacheData = JSON.parse(readFileSync(cachePath, 'utf-8'));
    const games = cacheData.games || [];

    console.log(`Parcheando HLTB para ${games.length} juegos...\n`);

    const tokenOk = await initHLTBToken();
    if (!tokenOk) {
        console.error("No se pudo obtener token HLTB.");
        process.exit(1);
    }

    let found = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < games.length; i++) {
        const game = games[i];
        const progress = `[${i + 1}/${games.length}]`;

        // Si ya tiene HLTB, saltar (usar --force para refrescar todos)
        if (game.hltb && !process.argv.includes('--force')) {
            skipped++;
            continue;
        }

        const hltbData = await searchHLTB(game.name);

        if (hltbData && hltbData.main) {
            found++;
            if (!game.hltb) updated++;
            game.hltb = hltbData;
            console.log(`   ${progress} ${game.name} -> ${hltbData.name} (${hltbData.main}h / ${hltbData.mainExtra || '-'}h / ${hltbData.completionist || '-'}h)`);
        } else {
            console.log(`   ${progress} ${game.name} - sin datos HLTB`);
        }

        if (i < games.length - 1) {
            await delay(HLTB_REQUEST_DELAY);
        }
    }

    // Actualizar stats
    cacheData.gamesWithHLTB = games.filter(g => g.hltb?.main).length;

    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n===================================");
    console.log(`HLTB parcheado en steam.json`);
    console.log(`   ${found} encontrados en esta ejecucion`);
    console.log(`   ${updated} nuevos (no tenian HLTB)`);
    console.log(`   ${skipped} saltados (ya tenian HLTB)`);
    console.log(`   ${cacheData.gamesWithHLTB}/${games.length} total con HLTB`);
    console.log(`   ${elapsed}s`);
    console.log("===================================");
}

main().catch((error) => {
    console.error("Error fatal:", error);
    process.exit(1);
});
