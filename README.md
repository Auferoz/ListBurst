# ListBurst

Dashboard personal para el seguimiento de contenido multimedia: peliculas, series y videojuegos. Incluye una seccion de proximos lanzamientos de juegos con contadores regresivos. Construido con Astro y desplegado en Cloudflare Workers.

---

## Stack Tecnologico

| Tecnologia | Version | Uso |
| :--- | :--- | :--- |
| Astro | 5.17+ | Framework principal (SSR + prerender) |
| Tailwind CSS | 4.x | Estilos utilitarios (plugin Vite) |
| TypeScript | Strict | Tipado en frontmatter y scripts |
| Cloudflare Workers | - | Hosting y deploy (edge) |
| Nunito Sans Variable | - | Tipografia principal |
| View Transitions | - | Navegacion SPA con `ClientRouter` |

---

## Estructura del Proyecto

```
src/
├── assets/                  # Imagenes y SVGs (optimizados por Astro)
├── components/
│   ├── Globals/             # Componentes reutilizables
│   │   ├── CardDashboard    # Card de estadisticas (slot para icono + color)
│   │   ├── CardGamesList    # Card de juego en listado
│   │   ├── CardMoviesList   # Card de pelicula en listado
│   │   ├── CardSeriesList   # Card de serie en listado
│   │   ├── CardNextGame     # Card de juego proximo (countdown + proximidad)
│   │   ├── FilterBar        # Barra de filtros (selects nativos + eventos)
│   │   ├── FilterSelect     # Select individual (backup)
│   │   └── MenuHeader       # Navegacion inferior fija (bottom nav)
│   └── Icons/               # 22+ iconos SVG como componentes Astro
├── data/
│   ├── cache/
│   │   ├── movies.json      # Cache local de peliculas (Trakt + OMDB)
│   │   ├── series.json      # Cache local de series (Trakt)
│   │   └── nextGames.json   # Cache local de proximos juegos (IGDB)
│   ├── gamesDB.js           # Base de datos local de juegos (~50 entries)
│   ├── MoviesDB.js          # Definiciones de listas de peliculas por anio (Trakt)
│   ├── SeriesDB.js          # Definiciones de series/temporadas (~51 entries)
│   └── nextGamesDB.js       # Lista personal de proximos juegos (~49 entries)
├── layouts/
│   └── Layout.astro         # Layout base (head, font, View Transitions, MenuHeader)
├── pages/
│   ├── index.astro          # Dashboard principal (/)
│   ├── nextGames.astro      # Proximos lanzamientos (/nextGames)
│   ├── Games/
│   │   ├── index.astro      # Listado de juegos (/Games)
│   │   └── [slug].astro     # Detalle de juego (/Games/:slug)
│   ├── Movies/
│   │   ├── index.astro      # Listado de peliculas (/Movies)
│   │   └── [slug].astro     # Detalle de pelicula (/Movies/:slug)
│   └── Series/
│       ├── index.astro      # Listado de series (/Series)
│       └── [slug].astro     # Detalle de serie (/Series/:slug)
├── services/
│   ├── apiOMDB.js           # Cliente API de OMDB (ratings)
│   ├── apiTrakt.js          # Cliente API de Trakt (metadata, imagenes, cast)
│   └── rateLimiter.js       # Rate limiter generico (cola, concurrencia, retry 429)
├── styles/
│   └── global.css           # Punto de entrada Tailwind (@import "tailwindcss")
└── utils/
    └── images.js            # Helper para URLs de imagenes de Trakt
scripts/
├── fetch-movies.js          # Script para obtener y cachear peliculas
├── fetch-series.js          # Script para obtener y cachear series
└── fetch-next-games.js      # Script para obtener y cachear proximos juegos
public/
├── favicon.ico
└── favicon.svg
```

---

## Rutas

| Ruta | Pagina | Descripcion |
| :--- | :--- | :--- |
| `/` | `index.astro` | Dashboard con estadisticas globales (8 cards) |
| `/Movies` | `Movies/index.astro` | Listado de peliculas con filtros (anio, genero, orden) |
| `/Movies/:slug` | `Movies/[slug].astro` | Detalle: hero, ratings, cast, trailer |
| `/Series` | `Series/index.astro` | Listado de series con filtros (anio, genero, estado) |
| `/Series/:slug` | `Series/[slug].astro` | Detalle: hero, episodios, cast, trailer |
| `/Games` | `Games/index.astro` | Listado de juegos con filtros (anio, estado, plataforma) |
| `/Games/:slug` | `Games/[slug].astro` | Detalle: hero, historial, logros, trailer |
| `/nextGames` | `nextGames.astro` | Proximos lanzamientos con countdown por mes |

---

## Fuentes de Datos

### Peliculas

Datos obtenidos de **Trakt API** (metadata, imagenes, cast) y **OMDB API** (ratings de IMDB, Rotten Tomatoes, Metacritic). Se almacenan en `src/data/cache/movies.json`. Las listas de peliculas por anio se definen en `MoviesDB.js` como slugs de listas del usuario en Trakt.

### Series

Datos obtenidos de **Trakt API** (show, temporada, episodios, cast). Se almacenan en `src/data/cache/series.json`. Las definiciones de series/temporadas (ID Trakt, temporada, plataforma, estado) se gestionan en `SeriesDB.js`.

### Juegos

Los juegos se gestionan como base de datos local en `gamesDB.js`. Cada entrada incluye: titulo, genero, estado (Jugando/Pausado/Completado/Abandonado), horas jugadas, logros, plataforma, ID de trailer YouTube, y fechas de juego por anio.

### Proximos Lanzamientos

Datos obtenidos de **IGDB API** (via Twitch OAuth2) con juegos trending, combinados con la lista personal de `nextGamesDB.js`. Se almacenan en `src/data/cache/nextGames.json`. Incluye metadata, imagenes, fechas de lanzamiento y links a Steam.

---

## APIs Externas

| API | Autenticacion | Rate Limit | Uso |
| :--- | :--- | :--- | :--- |
| Trakt | Header `trakt-api-key` | 1000 GET / 5 min | Metadata de peliculas, series, imagenes, cast, episodios |
| OMDB | Query param `apikey` | 1000 / dia | Ratings (IMDB, RT, Metacritic) |
| IGDB | Twitch OAuth2 (client credentials) | - | Metadata de juegos, imagenes, plataformas, links Steam |

Los scripts de fetch usan un **rate limiter generico** (`rateLimiter.js`) que gestiona concurrencia (3 requests simultaneos), delay entre requests, retry automatico en 429, y pausa proactiva cuando quedan pocas llamadas.

---

## Componentes Clave

### CardDashboard

Card reutilizable para estadisticas. Acepta un icono via `<slot />` y un color configurable.

```astro
<CardDashboard text="Jugando" number={5} color="green">
    <IconGamepad width={24} height={24} />
</CardDashboard>
```

**Colores disponibles:** `violet` (default), `sky`, `green`, `red`, `amber`, `zinc`, `teal`, `indigo`

### FilterBar

Barra de filtros que usa `<select>` nativos estilizados con Tailwind. Emite eventos `CustomEvent` (`filter-change`, `filter-reset`) en `document`. Compatible con View Transitions gracias a `AbortController` para cleanup. Pasa configuracion a scripts del cliente via atributos `data-*`.

```astro
<FilterBar
    filters={[
        { id: "filter-year", label: "Anio", options: yearOptions, defaultValue: "2025" },
        { id: "filter-genre", label: "Genero", options: genreOptions, capitalize: true },
        { id: "filter-order", label: "Orden", options: orderOptions, includeAll: false },
    ]}
/>
```

### CardNextGame

Card para juegos proximos con sistema de colores basado en proximidad a la fecha de lanzamiento:
- **Lanzado**: verde (released)
- **< 30 dias**: ambar
- **< 90 dias**: sky
- **> 90 dias / TBA**: zinc

Incluye countdown en dias, barra de progreso, link a Steam e indicador de "Mi lista".

### Cards de Listado (Movie, Series, Game)

Todas las cards de listado comparten un patron visual consistente:
- Artwork de fondo con mascara CSS (degradado de derecha a izquierda)
- Poster a la izquierda con `transition:name` para View Transitions
- Titulo, metadata y estado a la derecha
- Borde lateral con color segun estado/tipo
- Atributos `data-*` para filtrado client-side

---

## Comandos

| Comando | Accion |
| :--- | :--- |
| `npm install` | Instalar dependencias |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Build de produccion en `./dist/` |
| `npm run preview` | Preview del build local |
| `npm run fetch:movies` | Obtener y cachear peliculas desde Trakt/OMDB |
| `npm run fetch:series` | Obtener y cachear series desde Trakt |
| `npm run fetch:games` | Obtener y cachear proximos juegos desde IGDB |
| `npm run fetch:all` | Ejecutar los tres scripts de fetch en secuencia |

---

## Variables de Entorno

El archivo `.env` (no commiteado) requiere las siguientes claves para los scripts de fetch:

```
Trakt_CLIENT_ID=       # API key de Trakt
OMDB_API_KEY=          # API key de OMDB
Twitch_Client_ID=      # Client ID de Twitch (para IGDB)
Twitch_Client_Secret=  # Client Secret de Twitch (para IGDB)
```

---

## Deploy

El proyecto se despliega en **Cloudflare Workers** usando el adaptador `@astrojs/cloudflare`.

- Configuracion en `wrangler.jsonc`
- Worker name: `listburst`
- Worker entry: `dist/_worker.js/index.js`
- Assets estaticos servidos desde `./dist`
- Flags habilitados: `nodejs_compat`, `global_fetch_strictly_public`
- Observabilidad activa
- Fecha de compatibilidad: `2026-02-04`

---

## Diseno

- **Tema oscuro** con `color-scheme: dark`
- **Paleta base:** zinc (fondos zinc-900, cards zinc-800, bordes zinc-700, texto zinc-400/500)
- **Color de acento:** violeta (`rgb(136, 58, 234)`)
- **Colores por seccion:**
  - Series: sky / blue
  - Peliculas: indigo
  - Juegos: teal / green
  - Proximos juegos: emerald
- **Colores de estado:** green (jugando/ongoing), teal/violet (completado), red (abandonado), amber (pausado)
- **Tipografia:** Nunito Sans Variable (self-hosted)
- **CSS:** Tailwind v4 integrado como plugin de Vite, estilos scoped por defecto en componentes `.astro`
- **Navegacion:** View Transitions (SPA) via `ClientRouter` de Astro, con `transition:name` en posters para cross-fade entre listado y detalle
- **Layout:** Mobile-first con bottom nav fija, contenedor `max-w-7xl`, grids responsivos (1 -> 2 -> 3 -> 4 columnas)
- **Animaciones:** Stagger en cards (`cardFadeIn`), hover con scale en cast, fade en valores del dashboard
