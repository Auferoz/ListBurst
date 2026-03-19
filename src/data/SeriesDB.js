/**
 * Base de datos local de temporadas de series vistas
 *
 * Campos por entrada:
 * - idTrakt: Slug de la serie en Trakt
 * - numberSeason: Número de temporada
 * - platformViewed: Plataforma donde se vio
 * - statusViewed: "ongoing" (en progreso) o "completed" (completada)
 *
 * Agrupadas por año en ListSeriesByYear.
 * ListSeriesSeasons es un array plano derivado (compatibilidad con consumidores existentes).
 */

export const ListSeriesByYear = [
    {
        year: 2024,
        series: [
            { idTrakt: "the-prince-of-tennis-ii-u-17-world-cup", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
        ]
    },
    {
        year: 2025,
        series: [
            { idTrakt: "blue-lock", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
            { idTrakt: "castlevania-nocturne", numberSeason: 1, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "castlevania-nocturne", numberSeason: 2, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "my-love-story", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
            { idTrakt: "white-collar", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "white-collar", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "white-collar", numberSeason: 3, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "white-collar", numberSeason: 4, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "white-collar", numberSeason: 5, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "white-collar", numberSeason: 6, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "dragon-ball-daima", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
            { idTrakt: "formula-1-drive-to-survive", numberSeason: 7, platformViewed: "netflix", statusViewed: "completed" },
            { idTrakt: "solo-leveling", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
            { idTrakt: "you", numberSeason: 4, platformViewed: "netflix", statusViewed: "completed" },
            { idTrakt: "you", numberSeason: 5, platformViewed: "netflix", statusViewed: "completed" },
            { idTrakt: "black-mirror", numberSeason: 7, platformViewed: "netflix", statusViewed: "completed" },
            { idTrakt: "ghosts-2021", numberSeason: 1, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "ghosts-2021", numberSeason: 2, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "chrono-crusade", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
            { idTrakt: "the-beginning-after-the-end", numberSeason: 1, platformViewed: "crunchyroll", statusViewed: "completed" },
            { idTrakt: "squid-game", numberSeason: 3, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "the-day-of-the-jackal", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "my-hero-academia-vigilantes", numberSeason: 1, platformViewed: "Crunchyroll", statusViewed: "completed" },
            { idTrakt: "chespirito-not-really-on-purpose", numberSeason: 1, platformViewed: "HBO Max", statusViewed: "completed" },
            { idTrakt: "the-playlist-2022", numberSeason: 1, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "kaiju-no-8", numberSeason: 1, platformViewed: "Crunchyroll", statusViewed: "completed" },
            { idTrakt: "anne-shirley", numberSeason: 1, platformViewed: "Crunchyroll", statusViewed: "completed" },
            { idTrakt: "it-welcome-to-derry", numberSeason: 1, platformViewed: "HBO Max", statusViewed: "completed" },
            { idTrakt: "ghosts-2021", numberSeason: 3, platformViewed: "Netflix", statusViewed: "completed" },
        ]
    },
    {
        year: 2026,
        series: [
            { idTrakt: "east-new-york", numberSeason: 1, platformViewed: "HBO Max", statusViewed: "completed" },
            { idTrakt: "wandavision", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "the-falcon-and-the-winter-soldier", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "loki-2021", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "spy-x-family", numberSeason: 3, platformViewed: "Crunchyroll", statusViewed: "ongoing" },
            { idTrakt: "what-if-2021", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "hawkeye-2021", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "moon-knight", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "ms-marvel", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "i-am-groot", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "she-hulk-attorney-at-law", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "secret-invasion", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "i-am-groot", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "loki-2021", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "what-if-2021", numberSeason: 2, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "echo", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "agatha-all-along", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "x-men-97", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "what-if-2021", numberSeason: 3, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "your-friendly-neighborhood-spider-man", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "daredevil-born-again", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "ironheart", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "eyes-of-wakanda", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "marvel-zombies", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "wonder-man", numberSeason: 1, platformViewed: "Disney+", statusViewed: "completed" },
            { idTrakt: "love-death-robots", numberSeason: 4, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "rick-and-morty", numberSeason: 8, platformViewed: "HBO Max", statusViewed: "completed" },
            { idTrakt: "formula-1-drive-to-survive", numberSeason: 8, platformViewed: "Netflix", statusViewed: "completed" },
            { idTrakt: "how-to-sell-drugs-online-fast", numberSeason: 4, platformViewed: "Netflix", statusViewed: "completed" },
        ]
    },
];

// Compatibilidad: array plano con yearViewed inyectado
export const ListSeriesSeasons = ListSeriesByYear.flatMap(group =>
    group.series.map(s => ({ ...s, yearViewed: group.year }))
);

// Helper para obtener todos los años únicos
export const getAvailableYears = () => {
    const years = ListSeriesByYear.map(g => g.year);
    return years.sort((a, b) => a - b);
};
