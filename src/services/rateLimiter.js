/**
 * Rate Limiter compartido para APIs
 *
 * Provee control de concurrencia, retry automático en 429,
 * delay entre requests, y tracking proactivo de rate limits.
 *
 * @example
 * const limiter = createRateLimiter({ maxConcurrent: 3, name: "Trakt" });
 * const response = await limiter.execute(() => fetch(url));
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Factory function para crear un rate limiter configurado
 * @param {Object} options
 * @param {number} [options.maxConcurrent=3] - Máximo de requests simultáneas
 * @param {number} [options.maxRetries=3] - Reintentos en rate limit
 * @param {number} [options.delayBetweenRequests=0] - Ms mínimo entre requests
 * @param {string} [options.name="API"] - Nombre para logging
 * @param {function} [options.parseRateLimit] - Función para extraer info de rate limit de headers
 * @param {number} [options.rateLimitThreshold=50] - Remaining bajo el cual pausar preventivamente
 * @param {number} [options.rateLimitPauseMs=10000] - Ms de pausa preventiva
 * @returns {{ execute: function }}
 */
export function createRateLimiter(options = {}) {
    const {
        maxConcurrent = 3,
        maxRetries = 3,
        delayBetweenRequests = 0,
        name = "API",
        parseRateLimit = null,
        rateLimitThreshold = 50,
        rateLimitPauseMs = 10000,
    } = options;

    let activeRequests = 0;
    const requestQueue = [];
    let lastRequestTime = 0;
    let rateLimitRemaining = Infinity;

    const waitForSlot = () => {
        if (activeRequests < maxConcurrent) {
            activeRequests++;
            return Promise.resolve();
        }
        return new Promise((resolve) => requestQueue.push(resolve));
    };

    const releaseSlot = () => {
        activeRequests--;
        if (requestQueue.length > 0) {
            activeRequests++;
            requestQueue.shift()();
        }
    };

    /**
     * Ejecuta un fetch con control de concurrencia, retry y rate limit tracking.
     * Cada path de salida llama releaseSlot() exactamente una vez (sin finally).
     *
     * @param {function} fetchFn - Función que retorna una Promise<Response>
     * @param {number} [retries] - Reintentos restantes
     * @returns {Promise<Response>}
     */
    const execute = async (fetchFn, retries = maxRetries) => {
        await waitForSlot();

        // Delay entre requests
        if (delayBetweenRequests > 0) {
            const now = Date.now();
            const elapsed = now - lastRequestTime;
            if (elapsed < delayBetweenRequests) {
                await delay(delayBetweenRequests - elapsed);
            }
        }
        lastRequestTime = Date.now();

        try {
            const response = await fetchFn();

            // Parsear headers de rate limit si está configurado
            if (parseRateLimit) {
                const rateInfo = parseRateLimit(response);
                if (rateInfo?.remaining !== undefined) {
                    rateLimitRemaining = rateInfo.remaining;
                    if (rateLimitRemaining < rateLimitThreshold && rateLimitRemaining > 0) {
                        console.warn(`⚠️ [${name}] Rate limit bajo: ${rateLimitRemaining} restantes. Pausando ${rateLimitPauseMs}ms...`);
                        await delay(rateLimitPauseMs);
                    }
                }
            }

            // Handle 429 - release slot, esperar, re-ejecutar (re-adquiere slot)
            if (response.status === 429 && retries > 0) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "2", 10);
                console.warn(`⏳ [${name}] Rate limited, reintentando en ${retryAfter}s... (${retries} reintentos restantes)`);
                releaseSlot();
                await delay(retryAfter * 1000);
                return execute(fetchFn, retries - 1);
            }

            // Éxito o error no-retriable
            releaseSlot();
            return response;
        } catch (error) {
            releaseSlot();
            throw error;
        }
    };

    return { execute };
}
