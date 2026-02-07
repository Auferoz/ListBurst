/**
 * Helper para procesar URLs de imágenes de Trakt
 * Extraído de apiTrakt.js para uso independiente sin depender de servicios API
 */

/**
 * Asegura que la URL tenga protocolo https://
 * @param {string|null|undefined} imageUrl - URL de imagen (puede venir sin protocolo desde Trakt)
 * @returns {string|null} URL completa o null
 */
export const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `https://${imageUrl}`;
};
