/**
 * Trakt API Service
 *
 * Documentación: https://trakt.docs.apiary.io/
 * Base URL: https://api.trakt.tv
 *
 * Headers requeridos:
 * - Content-Type: application/json
 * - trakt-api-version: 2
 * - trakt-api-key: [Trakt_CLIENT_ID]
 *
 * Rate Limit: 1000 GET calls cada 5 minutos
 * Headers de rate limit: X-Ratelimit (JSON con remaining, limit, period)
 */

import { createRateLimiter } from './rateLimiter';

const BASE_URL = "https://api.trakt.tv";
const Trakt_CLIENT_ID = import.meta.env.Trakt_CLIENT_ID;

/**
 * Headers comunes para todas las peticiones a Trakt API
 */
const getHeaders = () => ({
    "Content-Type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": Trakt_CLIENT_ID,
});

/**
 * Rate limiter configurado para Trakt API
 * - Max 3 requests simultáneas
 * - 100ms entre requests (preventivo)
 * - Pausa cuando quedan menos de 50 calls
 * - Retry automático en 429
 */
const traktLimiter = createRateLimiter({
    maxConcurrent: 3,
    maxRetries: 3,
    delayBetweenRequests: 100,
    name: "Trakt",
    rateLimitThreshold: 50,
    rateLimitPauseMs: 10000,
    parseRateLimit: (response) => {
        const header = response.headers.get("X-Ratelimit");
        if (!header) return null;
        try {
            const info = JSON.parse(header);
            return { remaining: parseInt(info.remaining, 10) };
        } catch {
            return null;
        }
    },
});

/**
 * Función base para hacer peticiones a la API
 * Usa el rate limiter compartido para concurrencia, retry y tracking
 * @param {string} endpoint - Endpoint de la API (sin la base URL)
 * @returns {Promise<any>} - Respuesta de la API en JSON
 */
const fetchTrakt = async (endpoint) => {
    const url = `${BASE_URL}${endpoint}`;

    const response = await traktLimiter.execute(() =>
        fetch(url, { method: "GET", headers: getHeaders() })
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`Trakt API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
};

// ============================================
// SHOWS - Series
// ============================================

/**
 * Obtiene información de una serie
 * @param {string} id - Trakt slug, Trakt ID o IMDB ID (ej: "game-of-thrones")
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Información completa de la serie
 *
 * @example
 * const show = await getShow("loki-2021");
 * // Retorna: { title, year, ids, overview, first_aired, runtime, network, genres, images... }
 */
export const getShow = async (id, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/shows/${id}?extended=${extended}`);
};

/**
 * Obtiene información básica de una serie (sin imágenes)
 * @param {string} id - Trakt slug, Trakt ID o IMDB ID
 * @returns {Promise<Object>} - Información básica de la serie
 */
export const getShowBasic = async (id) => {
    return await fetchTrakt(`/shows/${id}`);
};

// ============================================
// SEASONS - Temporadas
// ============================================

/**
 * Obtiene todas las temporadas de una serie
 * @param {string} showId - Trakt slug, Trakt ID o IMDB ID de la serie
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Array>} - Array de temporadas
 *
 * @example
 * const seasons = await getSeasons("loki-2021");
 * // Retorna: [{ number, ids, rating, votes, episode_count, title, overview, images... }]
 */
export const getSeasons = async (showId, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/shows/${showId}/seasons?extended=${extended}`);
};

/**
 * Obtiene los episodios de una temporada específica
 * @param {string} showId - Trakt slug de la serie
 * @param {number} seasonNumber - Número de temporada
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Array>} - Array de episodios de la temporada
 *
 * @example
 * const episodes = await getSeasonEpisodes("loki-2021", 2);
 */
export const getSeasonEpisodes = async (showId, seasonNumber, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/shows/${showId}/seasons/${seasonNumber}?extended=${extended}`);
};

/**
 * Obtiene información detallada de una temporada específica (con imágenes)
 * Usa el endpoint /info que retorna poster, thumb, etc.
 * @param {string} showId - Trakt slug de la serie
 * @param {number} seasonNumber - Número de temporada
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Info de la temporada con imágenes
 *
 * @example
 * const seasonInfo = await getSeasonInfo("loki-2021", 1);
 * // Retorna: { number, ids, title, overview, images: { poster, thumb }, ... }
 */
export const getSeasonInfo = async (showId, seasonNumber, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/shows/${showId}/seasons/${seasonNumber}/info?extended=${extended}`);
};

// ============================================
// PEOPLE - Personas (Cast & Crew)
// ============================================

/**
 * Obtiene el cast y crew de una serie completa
 * @param {string} showId - Trakt slug, Trakt ID o IMDB ID de la serie
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Objeto con cast y crew
 *
 * @example
 * const people = await getShowPeople("game-of-thrones");
 * // Retorna: { cast: [...], crew: { production: [...], directing: [...], ... } }
 */
export const getShowPeople = async (showId, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/shows/${showId}/people?extended=${extended}`);
};

/**
 * Obtiene el cast y crew de una temporada específica
 * @param {string} showId - Trakt slug de la serie
 * @param {number} seasonNumber - Número de temporada
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Objeto con cast y crew de la temporada
 *
 * @example
 * const people = await getSeasonPeople("game-of-thrones", 1);
 */
export const getSeasonPeople = async (showId, seasonNumber, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/shows/${showId}/seasons/${seasonNumber}/people?extended=${extended}`);
};

/**
 * Obtiene información de una persona
 * @param {string} personId - Trakt slug, Trakt ID o IMDB ID de la persona
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Información de la persona
 *
 * @example
 * const person = await getPerson("bryan-cranston");
 * // Retorna: { name, ids, biography, birthday, birthplace, homepage, images... }
 */
export const getPerson = async (personId, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/people/${personId}?extended=${extended}`);
};

/**
 * Obtiene todas las series en las que ha participado una persona
 * @param {string} personId - Trakt slug de la persona
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Series donde aparece como cast o crew
 *
 * @example
 * const shows = await getPersonShows("bryan-cranston");
 */
export const getPersonShows = async (personId, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/people/${personId}/shows?extended=${extended}`);
};

// ============================================
// MOVIES - Películas
// ============================================

/**
 * Obtiene información de una película
 * @param {string} id - Trakt slug, Trakt ID o IMDB ID
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Información completa de la película
 *
 * @example
 * const movie = await getMovie("the-dark-knight-2008");
 */
export const getMovie = async (id, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/movies/${id}?extended=${extended}`);
};

/**
 * Obtiene el cast y crew de una película
 * @param {string} movieId - Trakt slug, Trakt ID o IMDB ID de la película
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Objeto con cast y crew
 *
 * @example
 * const people = await getMoviePeople("the-dark-knight-2008");
 * // Retorna: { cast: [...], crew: { production: [...], directing: [...], ... } }
 */
export const getMoviePeople = async (movieId, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/movies/${movieId}/people?extended=${extended}`);
};

// ============================================
// USER LISTS - Listas de Usuario
// ============================================

/**
 * Obtiene información de una lista de usuario
 * @param {string} username - Nombre de usuario de Trakt
 * @param {string} listSlug - Slug de la lista (ej: "movies-2024")
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Object>} - Información de la lista
 *
 * @example
 * const list = await getUserList("auferoz", "movies-2024");
 */
export const getUserList = async (username, listSlug, withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/users/${username}/lists/${listSlug}?extended=${extended}`);
};

/**
 * Obtiene los items de una lista de usuario (películas)
 * @param {string} username - Nombre de usuario de Trakt
 * @param {string} listSlug - Slug de la lista
 * @param {string} sort - Ordenamiento: "rank", "added", "title", "released", etc. (default: "rank")
 * @param {string} sortOrder - Dirección: "asc" o "desc" (default: "asc")
 * @param {boolean} withImages - Incluir imágenes (default: true)
 * @returns {Promise<Array>} - Array de items de la lista con info de películas
 *
 * @example
 * const movies = await getUserListMovies("auferoz", "movies-2024");
 */
export const getUserListMovies = async (username, listSlug, sort = "rank", sortOrder = "asc", withImages = true) => {
    const extended = withImages ? "full,images" : "full";
    return await fetchTrakt(`/users/${username}/lists/${listSlug}/items/movies/${sort}/${sortOrder}?extended=${extended}`);
};

/**
 * Obtiene películas de múltiples listas de usuario
 * Útil para cargar todas las películas de todas las listas de años
 * @param {string} username - Nombre de usuario de Trakt
 * @param {Array<{idTraktList: string}>} movieLists - Array de listas
 * @returns {Promise<Array>} - Array de objetos { listInfo, movies, yearViewed }
 *
 * @example
 * import { ListMovies } from '../Data/MoviesDB.js';
 * const allMovies = await getMoviesFromLists("auferoz", ListMovies);
 */
export const getMoviesFromLists = async (username, movieLists) => {
    const BATCH_SIZE = 3;
    const results = [];

    for (let i = 0; i < movieLists.length; i += BATCH_SIZE) {
        const batch = movieLists.slice(i, i + BATCH_SIZE);
        console.log(`📋 [Trakt] Listas de películas: batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(movieLists.length / BATCH_SIZE)}...`);

        const batchResults = await Promise.all(
            batch.map(async (listData) => {
                const { idTraktList, description } = listData;
                const yearMatch = idTraktList.match(/movies-(\d{4})/);
                const yearViewed = yearMatch ? parseInt(yearMatch[1]) : null;

                try {
                    const movies = await getUserListMovies(username, idTraktList);
                    return {
                        listSlug: idTraktList,
                        description,
                        yearViewed,
                        movies: movies.map((item, index) => ({
                            movie: item.movie,
                            rank: item.rank || index + 1,
                            listedAt: item.listed_at,
                            yearViewed,
                        })),
                    };
                } catch (error) {
                    console.error(`Error fetching list ${idTraktList}:`, error);
                    return {
                        listSlug: idTraktList,
                        description,
                        yearViewed,
                        movies: [],
                    };
                }
            })
        );

        results.push(...batchResults);
    }

    return results;
};

/**
 * Obtiene todas las películas de un año específico
 * @param {string} username - Nombre de usuario de Trakt
 * @param {number} year - Año de la lista (ej: 2024)
 * @returns {Promise<Array>} - Array de películas con info completa
 *
 * @example
 * const movies2024 = await getMoviesByYear("auferoz", 2024);
 */
export const getMoviesByYear = async (username, year) => {
    const listSlug = `movies-${year}`;
    try {
        const movies = await getUserListMovies(username, listSlug);
        return movies.map((item, index) => ({
            movie: item.movie,
            rank: item.rank || index + 1,
            listedAt: item.listed_at,
            yearViewed: year,
        }));
    } catch (error) {
        console.error(`Error fetching movies for year ${year}:`, error);
        return [];
    }
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtiene la URL completa de una imagen de Trakt
 * Las imágenes de Trakt no incluyen el protocolo https://
 * @param {string} imageUrl - URL parcial de la imagen
 * @returns {string} - URL completa de la imagen
 *
 * @example
 * const fullUrl = getImageUrl("walter-r2.trakt.tv/images/shows/000/146/535/posters/thumb/c0ab89fe80.jpg.webp");
 * // Retorna: "https://walter-r2.trakt.tv/images/shows/000/146/535/posters/thumb/c0ab89fe80.jpg.webp"
 */
export const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `https://${imageUrl}`;
};

/**
 * Extrae las imágenes principales de un objeto de Trakt
 * @param {Object} item - Objeto con propiedad images de Trakt
 * @returns {Object} - Objeto con URLs de poster, fanart y banner
 *
 * @example
 * const { poster, fanart, banner } = extractImages(show);
 */
export const extractImages = (item) => {
    const images = item?.images || {};
    return {
        poster: getImageUrl(images.poster?.[0]),
        fanart: getImageUrl(images.fanart?.[0]),
        banner: getImageUrl(images.banner?.[0]),
        logo: getImageUrl(images.logo?.[0]),
        clearart: getImageUrl(images.clearart?.[0]),
        thumb: getImageUrl(images.thumb?.[0]),
    };
};

/**
 * Obtiene información completa de una serie con su temporada específica
 * Útil para mostrar cards con info de serie + temporada
 * @param {string} showId - Trakt slug de la serie
 * @param {number} seasonNumber - Número de temporada
 * @returns {Promise<Object>} - Objeto con show y season
 *
 * @example
 * const { show, season } = await getShowWithSeason("loki-2021", 2);
 */
export const getShowWithSeason = async (showId, seasonNumber) => {
    const [show, seasons] = await Promise.all([
        getShow(showId),
        getSeasons(showId),
    ]);

    const season = seasons.find(s => s.number === seasonNumber) || null;

    return { show, season };
};

/**
 * Obtiene información de múltiples series en paralelo
 * @param {Array<string>} showIds - Array de Trakt slugs
 * @returns {Promise<Array>} - Array de series
 *
 * @example
 * const shows = await getMultipleShows(["loki-2021", "wandavision", "game-of-thrones"]);
 */
export const getMultipleShows = async (showIds) => {
    const promises = showIds.map(id => getShow(id));
    return await Promise.all(promises);
};

/**
 * Obtiene información completa para una lista de series con temporadas
 * Usa el endpoint /info para obtener imágenes completas de cada temporada
 * Ideal para usar con el ListSeriesSeasons de SeriesDB.js
 * @param {Array<{idTrakt: string, numberSeason: number}>} seriesList - Lista de series
 * @returns {Promise<Array>} - Array de objetos { show, season, localData }
 *
 * @example
 * import { ListSeriesSeasons } from '../Data/SeriesDB.js';
 * const seriesWithData = await getSeriesWithSeasonData(ListSeriesSeasons);
 */
export const getSeriesWithSeasonData = async (seriesList) => {
    const showsCache = new Map();
    const BATCH_SIZE = 5;
    const results = [];

    for (let i = 0; i < seriesList.length; i += BATCH_SIZE) {
        const batch = seriesList.slice(i, i + BATCH_SIZE);
        console.log(`📺 [Trakt] Series: batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(seriesList.length / BATCH_SIZE)}...`);

        const batchResults = await Promise.all(
            batch.map(async (localData) => {
                const { idTrakt, numberSeason } = localData;

                try {
                    let show;
                    if (showsCache.has(idTrakt)) {
                        show = showsCache.get(idTrakt);
                    } else {
                        show = await getShow(idTrakt);
                        showsCache.set(idTrakt, show);
                    }

                    const season = await getSeasonInfo(idTrakt, numberSeason);

                    return { show, season, localData };
                } catch (error) {
                    console.error(`Error fetching ${idTrakt} season ${numberSeason}:`, error);
                    return { show: null, season: null, localData };
                }
            })
        );

        results.push(...batchResults);
    }

    return results;
};

// Export default con todas las funciones
export default {
    // Shows
    getShow,
    getShowBasic,

    // Seasons
    getSeasons,
    getSeasonEpisodes,
    getSeasonInfo,

    // Movies
    getMovie,
    getMoviePeople,

    // User Lists
    getUserList,
    getUserListMovies,
    getMoviesFromLists,
    getMoviesByYear,

    // People
    getShowPeople,
    getSeasonPeople,
    getPerson,
    getPersonShows,

    // Helpers
    getImageUrl,
    extractImages,
    getShowWithSeason,
    getMultipleShows,
    getSeriesWithSeasonData,
};
