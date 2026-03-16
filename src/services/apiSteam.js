/**
 * Steam API Service
 *
 * Documentacion: https://developer.valvesoftware.com/wiki/Steam_Web_API
 * Base URL: https://api.steampowered.com
 *
 * Endpoints utilizados:
 * - IPlayerService/GetOwnedGames/v1 - Juegos de la biblioteca
 * - ISteamUserStats/GetPlayerAchievements/v1 - Logros por juego
 * - store.steampowered.com/api/appdetails - Detalles de la tienda
 *
 * Steam ID: 76561198071323076
 */

const BASE_URL = "https://api.steampowered.com";
const STORE_URL = "https://store.steampowered.com/api";
const STEAM_CDN = "https://cdn.akamai.steamstatic.com/steam/apps";

const Steam_KEY = import.meta.env.Steam_KEY;
const STEAM_ID = "76561198071323076";

// ============================================
// PLAYER - Biblioteca de juegos
// ============================================

/**
 * Obtiene todos los juegos de la biblioteca del usuario
 * @returns {Promise<Object>} - { game_count, games: [...] }
 *
 * Cada juego incluye:
 * - appid, name, playtime_forever (minutos), img_icon_url
 * - rtime_last_played (unix timestamp)
 * - playtime_2weeks, playtime_windows_forever, playtime_mac_forever
 * - playtime_linux_forever, playtime_deck_forever
 */
export const getOwnedGames = async () => {
    const url = `${BASE_URL}/IPlayerService/GetOwnedGames/v1/?key=${Steam_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Steam API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
};

/**
 * Obtiene los juegos jugados recientemente (ultimas 2 semanas)
 * @returns {Promise<Object>} - { total_count, games: [...] }
 */
export const getRecentlyPlayed = async () => {
    const url = `${BASE_URL}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${Steam_KEY}&steamid=${STEAM_ID}&format=json`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Steam API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
};

// ============================================
// STORE - Detalles de la tienda
// ============================================

/**
 * Obtiene detalles de un juego desde la tienda de Steam
 * @param {number} appid - ID de la aplicacion en Steam
 * @returns {Promise<Object|null>} - Detalles del juego o null si falla
 *
 * Incluye: genres, short_description, developers, publishers,
 * release_date, categories, screenshots, header_image, etc.
 */
export const getAppDetails = async (appid) => {
    const url = `${STORE_URL}/appdetails?appids=${appid}&l=spanish`;

    try {
        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();
        const appData = data[String(appid)];

        if (!appData?.success) return null;

        return appData.data;
    } catch {
        return null;
    }
};

// ============================================
// IMAGENES - URLs del CDN de Steam
// ============================================

/**
 * Genera la URL del header image de un juego
 * @param {number} appid
 * @returns {string}
 */
export const getHeaderImage = (appid) =>
    `${STEAM_CDN}/${appid}/header.jpg`;

/**
 * Genera la URL de la capsule vertical (600x900) de un juego
 * @param {number} appid
 * @returns {string}
 */
export const getCapsuleImage = (appid) =>
    `${STEAM_CDN}/${appid}/library_600x900.jpg`;

/**
 * Genera la URL del hero image de la biblioteca
 * @param {number} appid
 * @returns {string}
 */
export const getLibraryHero = (appid) =>
    `${STEAM_CDN}/${appid}/library_hero.jpg`;

/**
 * Genera la URL del logo del juego
 * @param {number} appid
 * @returns {string}
 */
export const getLogoImage = (appid) =>
    `${STEAM_CDN}/${appid}/logo.png`;

/**
 * Genera la URL del icono del juego
 * @param {number} appid
 * @param {string} iconHash - Hash del icono (img_icon_url)
 * @returns {string}
 */
export const getIconImage = (appid, iconHash) =>
    `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${iconHash}.jpg`;

/**
 * Genera la URL de la pagina del juego en Steam Store
 * @param {number} appid
 * @returns {string}
 */
export const getStoreUrl = (appid) =>
    `https://store.steampowered.com/app/${appid}`;

// ============================================
// HELPERS
// ============================================

/**
 * Convierte minutos de playtime a formato legible
 * @param {number} minutes - Minutos totales
 * @returns {string} - Ej: "124.5h" o "45min"
 */
export const formatPlaytime = (minutes) => {
    if (!minutes || minutes === 0) return "0h";
    if (minutes < 60) return `${minutes}min`;
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
};

/**
 * Convierte unix timestamp a fecha legible
 * @param {number} timestamp - Unix timestamp en segundos
 * @returns {string} - Ej: "15 Mar 2024"
 */
export const formatLastPlayed = (timestamp) => {
    if (!timestamp || timestamp === 0) return "Nunca";
    const date = new Date(timestamp * 1000);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export default {
    getOwnedGames,
    getRecentlyPlayed,
    getAppDetails,
    getHeaderImage,
    getCapsuleImage,
    getLibraryHero,
    getLogoImage,
    getIconImage,
    getStoreUrl,
    formatPlaytime,
    formatLastPlayed,
};
