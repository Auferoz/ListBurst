/**
 * Script para generar caché local de perfil y estadísticas del usuario
 * Llama a Trakt API:
 *   - /users/auferoz?extended=full (perfil completo con avatar)
 *   - /users/auferoz/stats (estadísticas)
 * Guarda todo en src/data/cache/userProfileStats.json
 *
 * Uso: npm run fetch:stats
 * Requiere: .env con Trakt_CLIENT_ID
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

async function fetchJSON(endpoint) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "GET",
        headers: traktHeaders,
    });

    if (!response.ok) {
        throw new Error(`❌ Error ${response.status} en ${endpoint}: ${response.statusText}`);
    }

    return response.json();
}

async function main() {
    console.log("📊 Fetching user profile & stats from Trakt...");

    const [profile, stats] = await Promise.all([
        fetchJSON("/users/auferoz?extended=full"),
        fetchJSON("/users/auferoz/stats"),
    ]);

    const data = { profile, stats };

    const cacheDir = resolve(__dirname, "../src/data/cache");
    if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
    }

    const outputPath = resolve(cacheDir, "userProfileStats.json");
    writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");

    console.log(`✅ User profile & stats guardados en ${outputPath}`);
    console.log(`   User: ${profile.username} (${profile.name || 'N/A'})`);
    console.log(`   Avatar: ${profile.images?.avatar?.full || 'N/A'}`);
    console.log(`   Movies: ${stats.movies?.watched || 0} watched, ${stats.movies?.minutes || 0} min`);
    console.log(`   Shows: ${stats.shows?.watched || 0} watched`);
    console.log(`   Episodes: ${stats.episodes?.watched || 0} watched, ${stats.episodes?.minutes || 0} min`);
}

main().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
