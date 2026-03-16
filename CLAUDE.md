# CLAUDE.md - ListBurst Project Guide

# Instrucciones

- Responde siempre en español
- Usa terminología técnica en español cuando sea posible

## Project Overview

ListBurst is a personal multimedia tracking dashboard for movies, TV series, and video games. It includes a Steam library browser and an upcoming game releases section with countdown timers. Built with Astro 6.x, deployed to Cloudflare Workers at the edge. The UI is written in **Spanish**; code uses a mix of Spanish and English variable names.

## Tech Stack

| Technology | Version | Purpose |
| --- | --- | --- |
| `astro` | ^6.0.4 | Core framework (SSR + prerendering, file-based routing) |
| `@astrojs/cloudflare` | ^13.1.1 | Cloudflare Workers adapter for edge deployment |
| `tailwindcss` | ^4.2.1 | Utility-first CSS (v4, integrated as Vite plugin) |
| `@tailwindcss/vite` | ^4.2.1 | Tailwind v4 Vite plugin (NOT PostCSS) |
| `@fontsource-variable/nunito-sans` | ^5.2.7 | Self-hosted variable font |
| `@astrojs/check` | ^0.9.7 | Astro TypeScript checking (dev) |
| `dotenv` | ^17.3.1 | Env vars for fetch scripts (dev) |
| `typescript` | ^5.9.3 | TypeScript compiler (dev) |

## Commands

```bash
npm run dev              # Dev server at localhost:4321
npm run build            # Production build to ./dist/
npm run preview          # Preview production build locally
npm run fetch:movies     # Fetch & cache movies from Trakt + OMDB APIs
npm run fetch:series     # Fetch & cache series from Trakt API
npm run fetch:games      # Fetch & cache upcoming games from IGDB API
npm run fetch:steam      # Fetch & cache Steam library (store details + achievements + IGDB covers/ratings)
npm run fetch:steam:hltb # Patch HowLongToBeat times into existing steam.json cache
npm run fetch:all        # Run all fetch scripts sequentially
```

## Project Structure

```
src/
├── assets/                  # SVGs and images (Astro-optimized)
├── components/
│   ├── Globals/             # Reusable UI components
│   │   ├── CardDashboard    # Stat card (slot icon + 8 color themes)
│   │   ├── CardGamesList    # Game card for list view
│   │   ├── CardMoviesList   # Movie card for list view
│   │   ├── CardSeriesList   # Series card for list view
│   │   ├── CardSteamList    # Steam game card (poster, playtime, HLTB, achievements, metacritic)
│   │   ├── CardNextGame     # Upcoming game card with countdown
│   │   ├── FilterBar        # Multi-filter bar (CustomEvent-based)
│   │   ├── FilterSelect     # Individual select (legacy/backup)
│   │   ├── StatsBar         # Inline stat badges bar
│   │   └── MenuHeader       # Fixed bottom navigation bar
│   └── Icons/               # 25+ SVG icon components (Tabler + custom brand: Steam, Metacritic, etc.)
├── data/
│   ├── cache/               # Pre-fetched JSON (committed to repo)
│   │   ├── movies.json      # Movies: Trakt metadata + OMDB ratings + cast
│   │   ├── series.json      # Series: Trakt show + seasons + episodes + cast
│   │   ├── nextGames.json   # Upcoming games: IGDB metadata + personal list
│   │   └── steam.json       # Steam library: 262 games, playtime, IGDB covers, HLTB, achievements
│   ├── gamesDB.js           # Local game database (~50 games, play history, achievements)
│   ├── MoviesDB.js          # Trakt list slug definitions by year (2018-2026)
│   ├── SeriesDB.js          # Series/season definitions (~51 entries, Trakt IDs)
│   └── nextGamesDB.js       # Personal upcoming games watchlist (~49 entries)
├── layouts/
│   └── Layout.astro         # Base HTML layout (head, font, ClientRouter, MenuHeader)
├── pages/
│   ├── index.astro          # Dashboard (/) - 8 global stat cards
│   ├── nextGames.astro      # Upcoming releases (/nextGames) - month groups + countdown
│   ├── steam.astro          # Steam library (/steam) - filterable grid with HLTB sorting
│   ├── Movies/
│   │   ├── index.astro      # Movie list (/Movies) - filterable grid
│   │   └── [slug].astro     # Movie detail (/Movies/:slug) - hero, ratings, cast, trailer
│   ├── Series/
│   │   ├── index.astro      # Series list (/Series) - filterable grid
│   │   └── [slug].astro     # Series detail (/Series/:slug) - hero, episodes, cast, trailer
│   └── Games/
│       ├── index.astro      # Games list (/Games) - filterable grid + Steam Library link
│       └── [slug].astro     # Game detail (/Games/:slug) - hero, history, achievements, trailer
├── services/
│   ├── apiTrakt.js          # Trakt API client (20+ exported functions)
│   ├── apiOMDB.js           # OMDB API client (ratings enrichment)
│   ├── apiSteam.js          # Steam API helpers
│   └── rateLimiter.js       # Generic rate limiter factory (concurrency, queue, retry)
├── styles/
│   └── global.css           # Single line: @import "tailwindcss"
└── utils/
    └── images.js            # Trakt image URL helper (https:// prefix)
scripts/
├── fetch-movies.js          # Cache builder: Trakt + OMDB -> movies.json
├── fetch-series.js          # Cache builder: Trakt -> series.json
├── fetch-next-games.js      # Cache builder: IGDB/Twitch -> nextGames.json
├── fetch-steam.js           # Cache builder: Steam API + IGDB -> steam.json (store + achievements in parallel)
└── fetch-steam-hltb.js      # HLTB patcher: patches HowLongToBeat times into existing steam.json
public/
├── favicon.ico
└── favicon.svg
```

## Architecture & Data Flow

The project uses a **pre-fetched cache pattern**: data is fetched from external APIs at development time via Node scripts, stored as JSON in `src/data/cache/`, and read at Astro build time to generate static HTML. There are no runtime API calls.

```
External APIs (fetched via scripts/)
  ├── Trakt API ──→ show/movie metadata, images, cast, episodes
  ├── OMDB API ──→ IMDB/RT/Metacritic ratings
  ├── IGDB API ──→ game metadata, screenshots, platforms, covers, aggregated_rating
  ├── Steam API ──→ owned games, store details, achievements
  └── HLTB API ──→ completion times (main, extra, 100%)
        │
        ▼
src/data/cache/ (JSON files, committed to repo)
  ├── movies.json
  ├── series.json
  ├── nextGames.json
  └── steam.json
        │
        ▼
Astro pages (read JSON + JS data at build time via getStaticPaths/frontmatter)
        │
        ▼
Static HTML + client-side JS (filtering, sorting, countdowns)
```

### Static Path Generation

- `Movies/[slug].astro` → `getStaticPaths()` reads `movies.json`, deduplicates by slug
- `Series/[slug].astro` → `getStaticPaths()` reads `series.json`, slug format: `{idTrakt}-season-{numberSeason}`
- `Games/[slug].astro` → `getStaticPaths()` reads `gamesDB.js`, uses `getGameSlug()` helper

### Local Database Files

- **gamesDB.js**: ~50 game entries with play history per year, achievements, hours, IGDB IDs, YouTube trailer IDs, descriptions. Exports `ListGames`, `getAvailableYears()`, `getGameSlug()`.
- **MoviesDB.js**: 9 Trakt list definitions (`movies-2018` through `movies-2026`). Exports `ListMovies`.
- **SeriesDB.js**: ~51 series-season entries with Trakt IDs, season numbers, year viewed, platform, status. Exports `ListSeriesSeasons`, `getAvailableYears()`.
- **nextGamesDB.js**: ~49 upcoming game entries with title, poster URL, release date (DD-MM-YYYY, 31-12-YYYY = TBA). Exports `nextGamesList`.

## API Services

### Trakt (`services/apiTrakt.js`)
- Base URL: `https://api.trakt.tv`
- Auth: `trakt-api-key` header with client ID from `Trakt_CLIENT_ID` env var
- Rate limit: 1000 GET / 5 min, tracked via `X-Ratelimit` response header
- Concurrency: 3 simultaneous requests, 100ms delay, proactive pause at 50 remaining
- Key functions: `getShow`, `getSeasons`, `getSeasonEpisodes`, `getShowPeople`, `getSeasonPeople`, `getMovie`, `getMoviePeople`, `getUserListMovies`, `getMoviesFromLists`, `getImageUrl`, `extractImages`, `getShowWithSeason`, `getMultipleShows`, `getSeriesWithSeasonData`

### OMDB (`services/apiOMDB.js`)
- Base URL: `https://www.omdbapi.com/`
- Auth: API key query parameter from `OMDB_API_KEY` env var
- Rate limit: 1000 calls / day (free tier)
- In-memory `Map` cache for deduplication within a fetch run
- Functions: `getMovieRatings`, `getMultipleMovieRatings`, `enrichMoviesWithRatings`
- Extracts: IMDB rating, IMDB votes, Rotten Tomatoes, Metascore, Popcornmeter (derived from IMDB)

### Steam (`scripts/fetch-steam.js`)
- **Steam Web API**: `GetOwnedGames/v1` (library), `GetPlayerAchievements/v1` (achievements)
- **Steam Store API**: `appdetails` (genres, description, metacritic, release date)
- Auth: API key from `Steam_KEY` env var, Steam ID hardcoded
- Store details + achievements fetched in parallel per game via `Promise.all`
- Store API rate limit: ~200 req/5min, 1.5s delay between requests
- Preserves existing HLTB data from cache when re-fetching

### IGDB (in `scripts/fetch-steam.js` and `scripts/fetch-next-games.js`)
- Auth: Twitch OAuth2 client credentials flow (`Twitch_Client_ID` + `Twitch_Client_Secret`)
- Steam library: maps Steam appids via `external_game_source = 1` in `/external_games`, fetches `cover.image_id` + `aggregated_rating` from `/games`
- Next games: searches personal watchlist titles, fetches monthly releases with `hypes > 2`
- IGDB `aggregated_rating` used as metacritic fallback when Steam Store doesn't provide it

### HowLongToBeat (`scripts/fetch-steam-hltb.js`)
- Separate patcher script that updates existing `steam.json`
- Token obtained from `/api/finder/init`, searches via `/api/finder` POST with `x-auth-token` header
- Times returned in seconds (divided by 3600 for hours): `comp_main`, `comp_plus`, `comp_100`
- Skips games that already have HLTB data (use `--force` to refresh all)
- 1s delay between requests

### Rate Limiter (`services/rateLimiter.js`)
- Factory function `createRateLimiter(options)` returns a `rateLimitedFetch` wrapper
- Features: concurrent request queue, configurable delay, automatic 429 retry with `Retry-After`, proactive pause when remaining calls are low
- Used by both Trakt and OMDB clients

## Component Patterns

### Slot Composition
`CardDashboard` accepts icons via `<slot />` for flexible content injection:
```astro
<CardDashboard text="Jugando" number={5} color="green">
    <IconGamepad width={24} height={24} />
</CardDashboard>
```

### CustomEvent Communication
`FilterBar` dispatches `CustomEvent` on `document`:
- `filter-change` → carries `{ filterId, value }` detail
- `filter-reset` → signals all filters reset to defaults

Page scripts listen for these events and apply filtering logic to DOM elements.

### Data-Attribute Bridge
`FilterBar` passes configuration to client-side scripts via `data-*` attributes on the component wrapper (avoids `define:vars` incompatibility with View Transitions). Page scripts read these attributes on initialization.

### AbortController Cleanup
All page filter scripts use `AbortController` to register event listeners that are automatically cleaned up on View Transition navigation:
```js
document.addEventListener('astro:page-load', () => {
    const controller = new AbortController();
    document.addEventListener('filter-change', handler, { signal: controller.signal });
    document.addEventListener('astro:before-preparation', () => controller.abort(), { once: true });
});
```

### Color Mapping Objects
TypeScript `Record` objects map color names to sets of Tailwind classes. CardDashboard uses 8 named themes: `violet`, `sky`, `green`, `red`, `amber`, `zinc`, `teal`, `indigo`. Each maps to `iconBg`, `iconText`, `accent`, `hover` class sets.

### List Card Pattern
All list cards (CardMoviesList, CardSeriesList, CardGamesList, CardSteamList, CardNextGame) share:
- Background artwork with CSS mask gradient (right-to-left fade)
- Dark overlay via `bg-linear-to-r from-zinc-900/95 via-zinc-900/80 to-transparent`
- Left: poster image with `transition:name` for View Transitions
- Right: title, metadata, genre, footer with platform/status
- `data-*` attributes on each card for client-side filtering

### Steam Card Poster Logic (CardSteamList)
- Primary: IGDB cover (vertical poster, reliable dimensions)
- Fallback: Steam `library_600x900.jpg` (capsule image)
- Never uses `header.jpg` as poster (landscape aspect ratio breaks card layout)
- If no image available: hides `<img>`, shows `bg-zinc-800` figure background

## Client-Side Patterns

### DOM-Based Filtering
Cards are rendered server-side with `data-year`, `data-genre`, `data-status`, `data-platform` attributes. Client-side JS shows/hides and reorders cards by manipulating DOM visibility and `appendChild` order. No framework needed.

### Steam Page Sorting
Steam page (`/steam`) supports sorting by:
- Playtime (most/least played)
- Recently played
- HLTB times (main, extra, 100% — ascending/descending)
- Name (A-Z, Z-A)

Games without HLTB data are pushed to the end when sorting by HLTB. Uses `data-hltb-main`, `data-hltb-extra`, `data-hltb-complete` attributes.

### astro:page-load Lifecycle
All client scripts initialize via `document.addEventListener('astro:page-load', ...)` to ensure correct behavior with View Transitions (re-initializes on every navigation).

### Progressive Enhancement
Core content (cards, detail pages) is fully visible without JavaScript. JS adds filtering, sorting, countdown timers, and interactive features.

### Countdown System (nextGames)
`CardNextGame` uses a proximity-based color system for release dates:
- Released (past date): green border + "Disponible" badge
- < 30 days: amber border + days countdown
- < 90 days: sky border + days countdown
- > 90 days or TBA: zinc border
Live countdown updates every 60 seconds via `setInterval`.

## Styling & Design System

### Integration
- Tailwind CSS v4 via `@tailwindcss/vite` plugin (NOT PostCSS, NOT Astro integration)
- `global.css` contains only `@import "tailwindcss"` — no custom Tailwind config file
- Component-level scoped CSS via Astro `<style>` blocks for animations and special effects
- Use `bg-linear-to-r` (Tailwind v4 syntax), NOT `bg-gradient-to-r`

### Dark Theme
- `color-scheme: dark` set globally
- Base palette: zinc scale (zinc-900 backgrounds, zinc-800 cards, zinc-700 borders, zinc-400/500 text)
- Accent: violet `rgb(136, 58, 234)` (CSS custom property `--accent`)

### Section Colors
| Section | Primary | Secondary |
| --- | --- | --- |
| Series | sky-400 | blue-700 |
| Movies | indigo-400 | indigo-700 |
| Games | teal-400 | green-700 |
| Steam | teal-400 | green-700 |
| Next Games | emerald-400 | - |

### Status Colors
- Playing / Ongoing: `green-400`
- Completed: `teal-400` / `violet-400`
- Abandoned: `red-400`
- Paused: `amber-400`

### Rating Source Colors
IMDB = yellow, Rotten Tomatoes = red, Popcornmeter = orange, Metacritic = amber (with IconMetacritic logo), Trakt = purple

### Typography
- Font: Nunito Sans Variable (self-hosted via `@fontsource-variable/nunito-sans`)
- Weights: Bold (headers), Semibold (titles), Medium (labels), Regular (body)
- Sizes: text-3xl/4xl (page titles), text-xl (section), text-sm (card info), text-xs (meta), text-[10px] (micro)

### Layout
- Container: `max-w-7xl mx-auto`
- Bottom padding: `pb-24` (accounts for fixed bottom nav ~68px)
- Mobile-first responsive: `sm:`, `md:`, `lg:`, `xl:` breakpoints
- Grid columns: 1 → 2 → 3 → 4

### Animations
- **View Transitions**: Astro `ClientRouter` with `transition:name` on poster images for cross-fade
- **Card stagger**: `@keyframes cardFadeIn` with per-child `animation-delay`
- **Hover effects**: `scale-110` on cast headshots, brightness increase, border color transitions
- **Value animation**: Opacity fade on dashboard number changes

## Coding Conventions

### Files
- Pages: `kebab-case.astro` (e.g., `nextGames.astro`) or `PascalCase` directories (e.g., `Movies/`)
- Components: `PascalCase.astro` (e.g., `CardDashboard.astro`)
- Layouts: `PascalCase.astro` (e.g., `Layout.astro`)
- Data files: `camelCase.js` or `PascalCase.js` depending on content type
- Services: `camelCase.js` (e.g., `apiTrakt.js`)
- Fetch scripts: `fetch-*.js` (e.g., `fetch-steam.js`, `fetch-steam-hltb.js`)

### Code Style
- Use `.astro` files for pages and components
- Frontmatter for server-side logic (imports, data fetching, processing)
- CSS scoped by default in `<style>` blocks; use Tailwind utilities in templates
- Semantic HTML5 elements
- UI text in Spanish; variable names mix Spanish and English
- No linting or formatting tools configured (no ESLint, no Prettier)

### Component Props
- TypeScript interfaces defined in component frontmatter
- Props destructured with `Astro.props`
- Color props use string unions mapped to Tailwind class objects

### Image Handling
- Trakt CDN for show/movie images (posters, fanart, headshots)
- IGDB CDN (`images.igdb.com/igdb/image/upload/`) for game images (covers as poster fallback)
- Steam CDN (`cdn.akamai.steamstatic.com/steam/apps/`) for game headers and capsules
- `utils/images.js` helper ensures `https://` prefix on Trakt URLs
- Astro `<Image>` component for optimized local assets

## Deployment

- **Platform**: Cloudflare Workers
- **Adapter**: `@astrojs/cloudflare` v13 (uses `@cloudflare/vite-plugin`)
- **Config**: `wrangler.jsonc` (no `main` field — adapter handles entry automatically)
- **Worker name**: `listburst`
- **Assets**: `./dist`
- **Compatibility date**: `2026-02-04`
- **Flags**: `nodejs_compat`, `global_fetch_strictly_public`
- **Observability**: enabled

## Environment Variables

Required in `.env` (not committed) for fetch scripts:

```
Trakt_CLIENT_ID=           # Trakt API client ID
OMDB_API_KEY=              # OMDB API key
Twitch_Client_ID=          # Twitch client ID (for IGDB auth)
Twitch_Client_Secret=      # Twitch client secret (for IGDB auth)
Steam_KEY=                 # Steam Web API key
```

## Navigation

Bottom nav bar (`MenuHeader.astro`) with routes:
- `/` (Home), `/nextGames`, `/Games`, `/steam`, `/Series`, `/Movies`

Games page (`/Games`) includes a pill-style link to Steam Library (`/steam`) in the header title.

## Notes

- No testing framework configured
- No linting/formatting tools configured
- Output directory `./dist/` is git-ignored
- `.env` file is git-ignored
- Cache JSON files in `src/data/cache/` ARE committed to the repo
- Trakt username used: `auferoz`
- Steam ID: `76561198071323076`
- Known warning during build: `unstorage` dynamic import warning from `@astrojs/cloudflare` internals — cosmetic only, cannot be fixed from project code (upstream issue)
