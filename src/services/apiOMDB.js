/**
 * OMDB API Service
 *
 * Documentación: https://www.omdbapi.com/
 * Base URL: https://www.omdbapi.com/
 *
 * Proporciona ratings de:
 * - IMDB (imdbRating, imdbVotes)
 * - Rotten Tomatoes (Tomatometer)
 * - Metacritic (Metascore)
 *
 * Rate Limit: 1000 calls diarias (free tier)
 */

import { createRateLimiter } from './rateLimiter';

const BASE_URL = "https://www.omdbapi.com/";
const API_KEY = import.meta.env.OMDB_API_KEY;

// Cache para evitar llamadas duplicadas
const ratingsCache = new Map();

/**
 * Rate limiter configurado para OMDB API
 * - Max 5 requests simultáneas
 * - 50ms entre requests (preventivo)
 * - Retry automático en 429
 */
const omdbLimiter = createRateLimiter({
    maxConcurrent: 5,
    maxRetries: 2,
    delayBetweenRequests: 50,
    name: "OMDB",
});

/**
 * Obtiene ratings de una película por IMDB ID
 * @param {string} imdbId - ID de IMDB (ej: "tt0111161")
 * @returns {Promise<Object|null>} - Objeto con ratings o null si hay error
 *
 * @example
 * const ratings = await getMovieRatings("tt0111161");
 * // Retorna: { imdb: "9.3", imdbVotes: "2,500,000", rottenTomatoes: "91%", metascore: "80" }
 */
export const getMovieRatings = async (imdbId) => {
    if (!imdbId) return null;

    // Verificar cache
    if (ratingsCache.has(imdbId)) {
        return ratingsCache.get(imdbId);
    }

    try {
        const url = `${BASE_URL}?i=${imdbId}&apikey=${API_KEY}`;
        const response = await omdbLimiter.execute(() => fetch(url));

        if (!response.ok) {
            console.error(`OMDB API Error: ${response.status}`);
            return null;
        }

        const data = await response.json();

        if (data.Response === "False") {
            if (data.Error === "Request limit reached!") {
                console.warn(`⏳ [OMDB] Límite diario alcanzado para ${imdbId}`);
            } else {
                console.error(`OMDB Error: ${data.Error}`);
            }
            return null;
        }

        // Extraer ratings
        const ratings = {
            imdb: data.imdbRating !== "N/A" ? data.imdbRating : null,
            imdbVotes: data.imdbVotes !== "N/A" ? data.imdbVotes : null,
            metascore: data.Metascore !== "N/A" ? data.Metascore : null,
            rottenTomatoes: null, // Tomatometer (críticos)
            popcornmeter: null,   // Audience Score (audiencia)
        };

        // Buscar Rotten Tomatoes en el array de Ratings
        if (data.Ratings && Array.isArray(data.Ratings)) {
            const rtRating = data.Ratings.find(r => r.Source === "Rotten Tomatoes");
            if (rtRating) {
                ratings.rottenTomatoes = rtRating.Value; // ej: "91%"
            }
        }

        // OMDB no proporciona el Audience Score directamente
        // Usamos el porcentaje de votos positivos de IMDB como aproximación
        // Convertimos el rating de IMDB (1-10) a porcentaje para el popcornmeter
        if (data.imdbRating && data.imdbRating !== "N/A") {
            const imdbScore = parseFloat(data.imdbRating);
            // Convertir escala 1-10 a porcentaje aproximado
            const audiencePercent = Math.round(imdbScore * 10);
            ratings.popcornmeter = `${audiencePercent}%`;
        }

        // Guardar en cache
        ratingsCache.set(imdbId, ratings);

        return ratings;
    } catch (error) {
        console.error(`Error fetching OMDB ratings for ${imdbId}:`, error);
        return null;
    }
};

/**
 * Obtiene ratings para múltiples películas en paralelo
 * @param {Array<string>} imdbIds - Array de IMDB IDs
 * @returns {Promise<Map<string, Object>>} - Map con imdbId => ratings
 *
 * @example
 * const ratingsMap = await getMultipleMovieRatings(["tt0111161", "tt0068646"]);
 * const shawshankRatings = ratingsMap.get("tt0111161");
 */
export const getMultipleMovieRatings = async (imdbIds) => {
    const uniqueIds = [...new Set(imdbIds.filter(Boolean))];

    const results = await Promise.all(
        uniqueIds.map(async (imdbId) => {
            const ratings = await getMovieRatings(imdbId);
            return [imdbId, ratings];
        })
    );

    return new Map(results);
};

/**
 * Enriquece un array de películas con ratings de OMDB
 * @param {Array} movies - Array de películas con movie.ids.imdb
 * @returns {Promise<Array>} - Películas con propiedad externalRatings añadida
 *
 * @example
 * const moviesWithRatings = await enrichMoviesWithRatings(allMovies);
 */
export const enrichMoviesWithRatings = async (movies) => {
    // Extraer todos los IMDB IDs
    const imdbIds = movies.map(m => m.movie?.ids?.imdb).filter(Boolean);

    // Obtener todos los ratings en paralelo
    const ratingsMap = await getMultipleMovieRatings(imdbIds);

    // Añadir ratings a cada película
    return movies.map(movieData => {
        const imdbId = movieData.movie?.ids?.imdb;
        const externalRatings = imdbId ? ratingsMap.get(imdbId) : null;

        return {
            ...movieData,
            externalRatings,
        };
    });
};

export default {
    getMovieRatings,
    getMultipleMovieRatings,
    enrichMoviesWithRatings,
};
