-- ════════════════════════════════════════════
-- METADATA / CONFIGURACIÓN
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════
-- USER PROFILE
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    username TEXT NOT NULL,
    slug TEXT,
    joined_at TEXT,
    location TEXT,
    about TEXT,
    gender TEXT,
    age INTEGER,
    avatar_url TEXT,
    movies_plays INTEGER DEFAULT 0,
    movies_watched INTEGER DEFAULT 0,
    movies_minutes INTEGER DEFAULT 0,
    movies_ratings INTEGER DEFAULT 0,
    shows_watched INTEGER DEFAULT 0,
    shows_ratings INTEGER DEFAULT 0,
    episodes_plays INTEGER DEFAULT 0,
    episodes_watched INTEGER DEFAULT 0,
    episodes_minutes INTEGER DEFAULT 0,
    ratings_total INTEGER DEFAULT 0,
    ratings_distribution TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════
-- PERSONAS (compartidas entre movies y series)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trakt_id INTEGER UNIQUE,
    slug TEXT,
    imdb_id TEXT,
    tmdb_id INTEGER,
    name TEXT NOT NULL,
    birthday TEXT,
    death TEXT,
    birthplace TEXT,
    gender TEXT,
    biography TEXT,
    headshot_url TEXT,
    homepage TEXT,
    known_for TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_people_trakt_id ON people(trakt_id);
CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);

-- ════════════════════════════════════════════
-- PELÍCULAS
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    trakt_id INTEGER,
    imdb_id TEXT,
    tmdb_id INTEGER,
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    runtime INTEGER,
    rating REAL,
    votes INTEGER,
    status TEXT,
    country TEXT,
    language TEXT,
    tagline TEXT,
    overview TEXT,
    certification TEXT,
    released TEXT,
    trailer TEXT,
    homepage TEXT,
    poster_url TEXT,
    fanart_url TEXT,
    logo_url TEXT,
    banner_url TEXT,
    thumb_url TEXT,
    clearart_url TEXT,
    color_primary TEXT,
    color_secondary TEXT,
    year_viewed INTEGER,
    rank INTEGER,
    listed_at TEXT,
    rating_imdb TEXT,
    rating_imdb_votes TEXT,
    rating_rotten_tomatoes TEXT,
    rating_metascore TEXT,
    rating_popcornmeter TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug);
CREATE INDEX IF NOT EXISTS idx_movies_year_viewed ON movies(year_viewed);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);

CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    PRIMARY KEY (movie_id, genre)
);
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre ON movie_genres(genre);

CREATE TABLE IF NOT EXISTS movie_subgenres (
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    subgenre TEXT NOT NULL,
    PRIMARY KEY (movie_id, subgenre)
);

CREATE TABLE IF NOT EXISTS movie_cast (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    character_name TEXT,
    sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_movie_cast_movie ON movie_cast(movie_id);

CREATE TABLE IF NOT EXISTS movie_crew (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    department TEXT,
    job TEXT
);
CREATE INDEX IF NOT EXISTS idx_movie_crew_movie ON movie_crew(movie_id);

CREATE TABLE IF NOT EXISTS movie_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    title TEXT,
    url TEXT,
    site TEXT DEFAULT 'youtube',
    type TEXT,
    size INTEGER,
    official INTEGER DEFAULT 1,
    published_at TEXT,
    country TEXT,
    language TEXT
);
CREATE INDEX IF NOT EXISTS idx_movie_videos_movie ON movie_videos(movie_id);

-- ════════════════════════════════════════════
-- SERIES
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    trakt_id INTEGER,
    imdb_id TEXT,
    tmdb_id INTEGER,
    tvdb_id INTEGER,
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    runtime INTEGER,
    rating REAL,
    votes INTEGER,
    status TEXT,
    country TEXT,
    language TEXT,
    network TEXT,
    tagline TEXT,
    overview TEXT,
    certification TEXT,
    first_aired TEXT,
    trailer TEXT,
    homepage TEXT,
    aired_episodes INTEGER,
    poster_url TEXT,
    fanart_url TEXT,
    logo_url TEXT,
    banner_url TEXT,
    color_primary TEXT,
    color_secondary TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shows_trakt_id ON shows(trakt_id);

CREATE TABLE IF NOT EXISTS show_genres (
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    PRIMARY KEY (show_id, genre)
);

CREATE TABLE IF NOT EXISTS series_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    season_trakt_id INTEGER,
    season_tmdb_id INTEGER,
    season_rating REAL,
    season_votes INTEGER,
    season_episode_count INTEGER,
    season_aired_episodes INTEGER,
    season_title TEXT,
    season_overview TEXT,
    season_first_aired TEXT,
    season_poster_url TEXT,
    season_thumb_url TEXT,
    year_viewed INTEGER NOT NULL,
    platform_viewed TEXT,
    status_viewed TEXT,
    local_slug TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(show_id, season_number)
);
CREATE INDEX IF NOT EXISTS idx_series_entries_year ON series_entries(year_viewed);
CREATE INDEX IF NOT EXISTS idx_series_entries_status ON series_entries(status_viewed);
CREATE INDEX IF NOT EXISTS idx_series_entries_local_slug ON series_entries(local_slug);

CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_entry_id INTEGER NOT NULL REFERENCES series_entries(id) ON DELETE CASCADE,
    trakt_id INTEGER,
    tmdb_id INTEGER,
    imdb_id TEXT,
    number INTEGER NOT NULL,
    title TEXT,
    original_title TEXT,
    overview TEXT,
    runtime INTEGER,
    rating REAL,
    votes INTEGER,
    first_aired TEXT,
    episode_type TEXT,
    screenshot_url TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_episodes_entry ON episodes(series_entry_id);

CREATE TABLE IF NOT EXISTS series_cast (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_entry_id INTEGER NOT NULL REFERENCES series_entries(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    character_name TEXT,
    episode_count INTEGER,
    sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_series_cast_entry ON series_cast(series_entry_id);

CREATE TABLE IF NOT EXISTS series_crew (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_entry_id INTEGER NOT NULL REFERENCES series_entries(id) ON DELETE CASCADE,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    department TEXT,
    job TEXT
);
CREATE INDEX IF NOT EXISTS idx_series_crew_entry ON series_crew(series_entry_id);

CREATE TABLE IF NOT EXISTS series_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_entry_id INTEGER NOT NULL REFERENCES series_entries(id) ON DELETE CASCADE,
    title TEXT,
    url TEXT,
    site TEXT DEFAULT 'youtube',
    type TEXT,
    size INTEGER,
    official INTEGER DEFAULT 1,
    published_at TEXT,
    country TEXT,
    language TEXT
);
CREATE INDEX IF NOT EXISTS idx_series_videos_entry ON series_videos(series_entry_id);

-- ════════════════════════════════════════════
-- JUEGOS (gamesDB.js → D1)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    released TEXT,
    companie TEXT,
    poster TEXT,
    trailer TEXT,
    artworks TEXT,
    genre TEXT,
    estado TEXT,
    horas_total INTEGER DEFAULT 0,
    logros_obt INTEGER DEFAULT 0,
    logros_total INTEGER DEFAULT 0,
    console_pc TEXT,
    igdb_id INTEGER,
    first_year_played INTEGER,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    fecha_inicio TEXT,
    fecha_final TEXT,
    horas TEXT,
    played INTEGER DEFAULT 0,
    UNIQUE(game_id, year)
);
CREATE INDEX IF NOT EXISTS idx_game_play_year ON game_play_history(year);

CREATE TABLE IF NOT EXISTS game_ratings (
    game_slug TEXT PRIMARY KEY,
    metacritic INTEGER,
    metacritic_url TEXT,
    rawg_rating REAL,
    rawg_url TEXT,
    opencritic_score INTEGER,
    opencritic_recommended TEXT,
    opencritic_tier TEXT,
    opencritic_url TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ════════════════════════════════════════════
-- NEXT GAMES (próximos lanzamientos)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS next_games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_title TEXT NOT NULL,
    local_poster TEXT,
    local_date_release TEXT,
    in_my_list INTEGER DEFAULT 0,
    source TEXT,
    igdb_id INTEGER,
    igdb_name TEXT,
    igdb_slug TEXT,
    igdb_url TEXT,
    summary TEXT,
    first_release_date INTEGER,
    cover TEXT,
    hypes INTEGER DEFAULT 0,
    steam_url TEXT,
    youtube_trailer TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS next_game_genres (
    game_id INTEGER NOT NULL REFERENCES next_games(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    PRIMARY KEY (game_id, genre)
);

CREATE TABLE IF NOT EXISTS next_game_platforms (
    game_id INTEGER NOT NULL REFERENCES next_games(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    PRIMARY KEY (game_id, platform)
);

CREATE TABLE IF NOT EXISTS next_game_screenshots (
    game_id INTEGER NOT NULL REFERENCES next_games(id) ON DELETE CASCADE,
    image_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS next_game_artworks (
    game_id INTEGER NOT NULL REFERENCES next_games(id) ON DELETE CASCADE,
    image_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS next_game_release_dates (
    game_id INTEGER NOT NULL REFERENCES next_games(id) ON DELETE CASCADE,
    human TEXT,
    date INTEGER,
    platform TEXT
);

CREATE TABLE IF NOT EXISTS next_game_companies (
    game_id INTEGER NOT NULL REFERENCES next_games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);

-- ════════════════════════════════════════════
-- STEAM LIBRARY
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS steam_games (
    appid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    playtime_forever INTEGER DEFAULT 0,
    playtime_2weeks INTEGER DEFAULT 0,
    playtime_windows INTEGER DEFAULT 0,
    playtime_mac INTEGER DEFAULT 0,
    playtime_linux INTEGER DEFAULT 0,
    playtime_deck INTEGER DEFAULT 0,
    rtime_last_played INTEGER DEFAULT 0,
    header_image TEXT,
    capsule_image TEXT,
    igdb_cover TEXT,
    icon_url TEXT,
    short_description TEXT,
    release_date TEXT,
    metacritic INTEGER,
    store_url TEXT,
    hltb_id INTEGER,
    hltb_name TEXT,
    hltb_main INTEGER,
    hltb_main_extra INTEGER,
    hltb_completionist INTEGER,
    hltb_main_seconds INTEGER,
    hltb_main_extra_seconds INTEGER,
    hltb_completionist_seconds INTEGER,
    achievements_obtained INTEGER,
    achievements_total INTEGER,
    igdb_rating REAL,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS steam_game_genres (
    appid INTEGER NOT NULL REFERENCES steam_games(appid) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    PRIMARY KEY (appid, genre)
);
CREATE INDEX IF NOT EXISTS idx_steam_genres ON steam_game_genres(genre);

CREATE TABLE IF NOT EXISTS steam_game_categories (
    appid INTEGER NOT NULL REFERENCES steam_games(appid) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (appid, category)
);

CREATE TABLE IF NOT EXISTS steam_game_developers (
    appid INTEGER NOT NULL REFERENCES steam_games(appid) ON DELETE CASCADE,
    name TEXT NOT NULL,
    PRIMARY KEY (appid, name)
);

CREATE TABLE IF NOT EXISTS steam_game_publishers (
    appid INTEGER NOT NULL REFERENCES steam_games(appid) ON DELETE CASCADE,
    name TEXT NOT NULL,
    PRIMARY KEY (appid, name)
);

-- ════════════════════════════════════════════
-- MOVIE LISTS (MoviesDB.js)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS movie_lists (
    id_trakt_list TEXT PRIMARY KEY,
    description TEXT
);

-- ════════════════════════════════════════════
-- NEXT GAMES WATCHLIST (nextGamesDB.js)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS next_games_watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    igdb_id INTEGER
);
