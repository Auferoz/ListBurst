# ListBurst

Dashboard personal para el seguimiento de contenido multimedia: peliculas, series y videojuegos. Construido con Astro y desplegado en Cloudflare Workers.

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
│   │   ├── FilterBar        # Barra de filtros (selects nativos + eventos)
│   │   ├── FilterSelect     # Select individual (backup)
│   │   └── MenuHeader       # Navegacion principal del sitio
│   └── Icons/               # 14 iconos SVG como componentes Astro
├── data/
│   ├── cache/
│   │   ├── movies.json      # Cache local de peliculas (Trakt + OMDB)
│   │   └── series.json      # Cache local de series (Trakt + OMDB)
│   ├── gamesDB.js           # Base de datos local de juegos
│   ├── MoviesDB.js          # Configuracion y helpers de peliculas
│   └── SeriesDB.js          # Configuracion y helpers de series
├── layouts/
│   └── Layout.astro         # Layout base (head, font, View Transitions, MenuHeader)
├── pages/
│   ├── index.astro          # Dashboard principal (/)
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
│   ├── apiTrakt.js          # Cliente API de Trakt (metadata)
│   └── rateLimiter.js       # Rate limiter para llamadas API
├── styles/
│   └── global.css           # Punto de entrada Tailwind (@import "tailwindcss")
└── utils/
    └── images.js            # Utilidades para manejo de imagenes
scripts/
├── fetch-movies.js          # Script para obtener y cachear peliculas
└── fetch-series.js          # Script para obtener y cachear series
public/
├── favicon.ico
└── favicon.svg
```

---

## Rutas

| Ruta | Pagina | Descripcion |
| :--- | :--- | :--- |
| `/` | `index.astro` | Dashboard con estadisticas globales |
| `/Movies` | `Movies/index.astro` | Listado de peliculas con filtros |
| `/Movies/:slug` | `Movies/[slug].astro` | Detalle de una pelicula |
| `/Series` | `Series/index.astro` | Listado de series con filtros |
| `/Series/:slug` | `Series/[slug].astro` | Detalle de una serie |
| `/Games` | `Games/index.astro` | Listado de juegos con filtros |
| `/Games/:slug` | `Games/[slug].astro` | Detalle de un juego |

---

## Fuentes de Datos

### Peliculas y Series

Los datos se obtienen de las APIs de **Trakt** y **OMDB**, y se almacenan como cache local en `src/data/cache/`:

- `movies.json` contiene metadata completa: titulo, generos, rating, runtime, imagenes, etc.
- `series.json` contiene metadata de shows + datos locales (temporada, plataforma, estado).

Para actualizar el cache se ejecutan los scripts de fetch (requieren variables de entorno con API keys).

### Juegos

Los juegos se gestionan como base de datos local en `gamesDB.js`. Cada entrada incluye: titulo, genero, estado (Jugando/Pausado/Completado/Abandonado), horas jugadas, logros, plataforma, y fechas de juego por anio.

---

## Componentes Clave

### CardDashboard

Card reutilizable para estadisticas. Acepta un icono via `<slot />` y un color configurable.

```astro
<CardDashboard text="Jugando" number={5} color="green">
    <IconGamepad width={24} height={24} />
</CardDashboard>
```

**Colores disponibles:** `violet` (default), `sky`, `green`, `red`, `amber`, `zinc`

### FilterBar

Barra de filtros que usa `<select>` nativos estilizados con Tailwind. Emite eventos `CustomEvent` (`filter-change`, `filter-reset`) en `document`. Compatible con View Transitions gracias a `AbortController` para cleanup.

```astro
<FilterBar
    filters={[
        { id: "filter-year", label: "Anio", options: yearOptions, defaultValue: "2025" },
        { id: "filter-genre", label: "Genero", options: genreOptions, capitalize: true },
        { id: "filter-order", label: "Orden", options: orderOptions, includeAll: false },
    ]}
/>
```

---

## Comandos

| Comando | Accion |
| :--- | :--- |
| `npm install` | Instalar dependencias |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Build de produccion en `./dist/` |
| `npm run preview` | Preview del build local |
| `npm run fetch:movies` | Obtener y cachear peliculas desde Trakt/OMDB |
| `npm run fetch:series` | Obtener y cachear series desde Trakt/OMDB |
| `npm run fetch:all` | Ejecutar ambos scripts de fetch |

---

## Deploy

El proyecto se despliega en **Cloudflare Workers** usando el adaptador `@astrojs/cloudflare`.

- Configuracion en `wrangler.jsonc`
- Worker entry: `dist/_worker.js/index.js`
- Assets estaticos servidos desde `./dist`
- Flags habilitados: `nodejs_compat`, `global_fetch_strictly_public`
- Observabilidad activa

---

## Diseno

- **Tema oscuro** con `color-scheme: dark`
- **Paleta base:** zinc (fondos, bordes, texto secundario)
- **Color de acento:** violeta (`rgb(136, 58, 234)`)
- **Tipografia:** Nunito Sans Variable
- **CSS:** Tailwind v4 con estilos scoped por defecto en componentes `.astro`
- **Navegacion:** View Transitions (SPA) via `ClientRouter` de Astro
