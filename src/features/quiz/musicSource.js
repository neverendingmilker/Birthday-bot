// Track fetching from three sources:
// - Spotify (Client Credentials Flow) for playlists / single tracks / metadata.
//   NOTE: due to a recent Spotify policy change, the account that owns the app
//   needs an active Premium subscription to read data via the API; without
//   Premium, requests fail with a 403.
// - Deezer (public API, no authentication required) for Deezer playlists and
//   single tracks, for the audio fallback when Spotify has no preview, and
//   for "random" mode (Deezer chart, optionally filtered by genre/category).
// - iTunes/Apple (public Lookup API, no authentication required) for single
//   iTunes/Apple Music tracks.

const config = require('../../config/config');

// "Special" categories that don't map to a direct Deezer genre: resolved by
// searching for a relevant public Deezer playlist via the playlist search API
// (no fragile hardcoded IDs).
const SPECIAL_CATEGORIES = {
  decade_70s: { label: '70s', query: '70s hits' },
  decade_80s: { label: '80s', query: '80s hits' },
  decade_90s: { label: '90s', query: '90s hits' },
  decade_00s: { label: '2000s', query: '2000s hits' },
  decade_10s: { label: '2010s', query: '2010s hits' },
  decade_20s: { label: '2020s', query: '2020s hits' },
  recent_hits: { label: 'Recent Hits', query: 'Hot Hits' },
  trending_now: { label: 'Trending Now', query: 'Trending Now' },
  jpop: { label: 'J-Pop', query: 'J-Pop' },
  jrock: { label: 'J-Rock', query: 'J-Rock' },
  kpop: { label: 'K-Pop', query: 'K-Pop' },
  anime: { label: 'Anime', query: 'Anime' },
};

// --- Spotify (Client Credentials Flow, implemented directly via fetch: no SDK dependency) ---

let cachedSpotifyToken = null; // { token, expiresAt }

async function getSpotifyToken() {
  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET missing from the .env file');
  }

  if (cachedSpotifyToken && cachedSpotifyToken.expiresAt > Date.now()) {
    return cachedSpotifyToken.token;
  }

  const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Spotify auth error (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  cachedSpotifyToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedSpotifyToken.token;
}

async function spotifyFetch(path) {
  const token = await getSpotifyToken();
  const resp = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Spotify API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

function extractSpotifyPlaylistId(urlOrId) {
  if (urlOrId.includes('playlist/')) {
    return urlOrId.split('playlist/')[1].split('?')[0];
  }
  return urlOrId.trim();
}

function extractSpotifyTrackId(urlOrId) {
  if (urlOrId.includes('track/')) {
    return urlOrId.split('track/')[1].split('?')[0];
  }
  return urlOrId.trim();
}

async function fetchSpotifyPlaylistTracks(playlistUrlOrId, limit = 300) {
  const playlistId = extractSpotifyPlaylistId(playlistUrlOrId);
  const tracks = [];
  let nextPath = `/playlists/${playlistId}/tracks?limit=100`;

  while (nextPath && tracks.length < limit) {
    const data = await spotifyFetch(nextPath.replace('https://api.spotify.com/v1', ''));
    for (const item of data.items || []) {
      const t = item.track;
      if (!t || t.is_local) continue;
      const name = t.name;
      const artists = (t.artists || []).map((a) => a.name).filter(Boolean);
      const previewUrl = t.preview_url;
      if (name && artists.length) {
        tracks.push({ name, artists, previewUrl });
      }
      if (tracks.length >= limit) break;
    }
    nextPath = tracks.length >= limit ? null : data.next;
  }

  return tracks;
}

async function fetchSpotifySingleTrack(trackUrlOrId) {
  const trackId = extractSpotifyTrackId(trackUrlOrId);
  const t = await spotifyFetch(`/tracks/${trackId}`);
  const name = t.name;
  const artists = (t.artists || []).map((a) => a.name).filter(Boolean);
  const previewUrl = t.preview_url;
  if (!name || !artists.length) {
    throw new Error('Invalid or not-found Spotify track.');
  }
  return { name, artists, previewUrl };
}

function isSpotifySource(source) {
  return source.toLowerCase().includes('spotify.com');
}

// --- iTunes / Apple Music (public Lookup + Search API, no auth required) ---

function isItunesSource(source) {
  const s = source.toLowerCase();
  return s.includes('music.apple.com') || s.includes('itunes.apple.com');
}

function extractItunesTrackId(source) {
  let match = source.match(/[?&]i=(\d+)/);
  if (match) return match[1];
  match = source.match(/\/(\d+)(?:\?|$)/);
  if (match) return match[1];
  return source.trim();
}

async function fetchItunesSingleTrack(trackUrlOrId) {
  const trackId = extractItunesTrackId(trackUrlOrId);
  const resp = await fetch(
    `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&entity=song`
  );
  if (!resp.ok) throw new Error(`iTunes API error (${resp.status})`);
  const payload = await resp.json();

  const results = payload.results || [];
  if (!results.length) throw new Error('iTunes track not found.');

  const item = results[0];
  const name = item.trackName;
  const artistName = item.artistName;
  const previewUrl = item.previewUrl;
  if (!name || !artistName) throw new Error('Invalid iTunes track.');
  return { name, artists: [artistName], previewUrl };
}

// Searches iTunes with a free-text term (e.g. a genre name: 'Pop', 'Rock',
// etc.). NOTE: this is not a true genre filter like Deezer's — the iTunes
// Search API doesn't reliably support that — but it's a useful approximation
// to add variety when a music category is selected.
async function fetchItunesTracksByTerm(term, limit = 25, country = 'US') {
  const params = new URLSearchParams({
    term,
    entity: 'song',
    limit: String(Math.min(limit, 200)),
    country,
  });
  const resp = await fetch(`https://itunes.apple.com/search?${params}`);
  if (!resp.ok) throw new Error(`iTunes API error (${resp.status})`);
  const payload = await resp.json();

  const tracks = [];
  for (const item of payload.results || []) {
    const name = item.trackName;
    const artistName = item.artistName;
    const previewUrl = item.previewUrl;
    if (name && artistName) {
      tracks.push({ name, artists: [artistName], previewUrl });
    }
  }
  return tracks;
}

// --- Deezer (public API, no auth required) ---

function isDeezerSource(source) {
  return source.toLowerCase().includes('deezer.com');
}

function isTrackUrl(source) {
  return source.toLowerCase().includes('track/');
}

function extractDeezerPlaylistId(source) {
  const match = source.match(/playlist\/(\d+)/);
  return match ? match[1] : source.trim();
}

function extractDeezerTrackId(source) {
  const match = source.match(/track\/(\d+)/);
  return match ? match[1] : source.trim();
}

async function fetchDeezerSingleTrack(trackUrlOrId) {
  const trackId = extractDeezerTrackId(trackUrlOrId);
  const resp = await fetch(`https://api.deezer.com/track/${trackId}`);
  if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
  const payload = await resp.json();

  if (payload.error) throw new Error(payload.error.message || 'Deezer API error');

  const name = payload.title;
  const artistName = payload.artist && payload.artist.name;
  const previewUrl = payload.preview;
  if (!name || !artistName) throw new Error('Invalid or not-found Deezer track.');
  return { name, artists: [artistName], previewUrl };
}

async function fetchDeezerPlaylistTracks(playlistUrlOrId, limit = 300) {
  const playlistId = extractDeezerPlaylistId(playlistUrlOrId);
  const tracks = [];
  let url = `https://api.deezer.com/playlist/${playlistId}/tracks`;

  while (url && tracks.length < limit) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
    const payload = await resp.json();

    if (payload.error) throw new Error(payload.error.message || 'Deezer API error');

    for (const item of payload.data || []) {
      const name = item.title;
      const artistName = item.artist && item.artist.name;
      const previewUrl = item.preview;
      if (name && artistName) {
        tracks.push({ name, artists: [artistName], previewUrl });
      }
      if (tracks.length >= limit) break;
    }
    url = payload.next || null;
  }

  return tracks;
}

let genreCache = { data: null, fetchedAt: 0 };
const GENRE_CACHE_TTL_MS = 3600 * 1000; // 1 hour, genres rarely change

// Returns the real list of music categories available on Deezer:
// [{ id: 132, name: 'Pop' }, ...]. Result cached for one hour.
async function fetchDeezerGenres() {
  const now = Date.now();
  if (genreCache.data && now - genreCache.fetchedAt < GENRE_CACHE_TTL_MS) {
    return genreCache.data;
  }

  const resp = await fetch('https://api.deezer.com/genre');
  if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
  const payload = await resp.json();

  const genres = (payload.data || [])
    .filter((g) => g.id && g.name && g.name.toLowerCase() !== 'all')
    .map((g) => ({ id: g.id, name: g.name }));

  genreCache = { data: genres, fetchedAt: now };
  return genres;
}

// Fetches songs from the Deezer chart, used for "random" mode: no
// authentication required, always available. genreId=0 (default) = global
// chart, no category filter.
async function fetchDeezerChartTracks(limit = 50, genreId = 0) {
  const tracks = [];
  let url = `https://api.deezer.com/chart/${genreId}/tracks`;

  while (url && tracks.length < limit) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
    const payload = await resp.json();

    for (const item of payload.data || []) {
      const name = item.title;
      const artistName = item.artist && item.artist.name;
      const previewUrl = item.preview;
      if (name && artistName) {
        tracks.push({ name, artists: [artistName], previewUrl });
      }
      if (tracks.length >= limit) break;
    }
    url = payload.next || null;
  }

  return shuffle(tracks);
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function trackKey(track) {
  return `${track.name.toLowerCase()}::${track.artists[0].toLowerCase()}`;
}

// Combines the Deezer chart filtered by genre (primary, reliable source)
// with an iTunes search for the same category name (secondary, supporting
// source, for extra variety). Deduplicates by title+artist and shuffles the
// final result.
async function fetchRandomTracksByCategory(genreName, genreId, limit = 50) {
  const deezerShare = Math.max(Math.floor(limit * 0.7), 1);
  const itunesShare = Math.max(limit - deezerShare, 1);

  const combined = [];
  const seen = new Set();

  try {
    const deezerTracks = await fetchDeezerChartTracks(deezerShare, genreId);
    for (const t of deezerTracks) {
      const key = trackKey(t);
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(t);
      }
    }
  } catch {
    // ignore, fall through with whatever iTunes returns
  }

  try {
    const itunesTracks = await fetchItunesTracksByTerm(genreName, itunesShare);
    for (const t of itunesTracks) {
      const key = trackKey(t);
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(t);
      }
    }
  } catch {
    // ignore
  }

  return shuffle(combined);
}

// Searches for a relevant public Deezer playlist for the given term and
// reads its tracks. Used for "special" categories (decades, trending,
// J-Pop/J-Rock/K-Pop, anime) that don't map to a direct Deezer genre.
async function fetchDeezerPlaylistBySearch(query, limitTracks = 50) {
  const resp = await fetch(
    `https://api.deezer.com/search/playlist?q=${encodeURIComponent(query)}&limit=5`
  );
  if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
  const payload = await resp.json();

  const results = payload.data || [];
  if (!results.length) throw new Error(`No playlist found for '${query}'.`);

  const best = results[0];
  return fetchDeezerPlaylistTracks(String(best.id), limitTracks);
}

// Resolves a special category (e.g. 'decade_80s', 'kpop', 'anime') into its
// corresponding track list, by searching for a relevant Deezer playlist.
async function fetchSpecialCategoryTracks(key, limit = 50) {
  const info = SPECIAL_CATEGORIES[key];
  if (!info) throw new Error('Unrecognized special category.');
  return fetchDeezerPlaylistBySearch(info.query, limit);
}

// Searches artists on Deezer. Returns [{ id, name }, ...].
async function searchDeezerArtists(query, limit = 15) {
  const resp = await fetch(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
  const payload = await resp.json();
  return (payload.data || [])
    .filter((a) => a.id && a.name)
    .map((a) => ({ id: a.id, name: a.name }));
}

// Finds the closest Deezer artist to the typed text, tolerating typos and
// punctuation (e.g. 'Evanescene' -> 'Evanescence'), using Deezer search for
// the candidate pool and a similarity ratio to pick the best match even when
// the text doesn't match exactly.
async function resolveArtistFuzzy(query) {
  const { tokenSortRatio, normalize } = require('./matching');
  const candidates = await searchDeezerArtists(query, 15);
  if (!candidates.length) return null;

  let best = null;
  let bestScore = -1;
  const normQuery = normalize(query);
  for (const candidate of candidates) {
    const score = tokenSortRatio(normQuery, normalize(candidate.name));
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

// Reads an artist's most popular tracks on Deezer.
async function fetchDeezerArtistTopTracks(artistId, limit = 50) {
  const resp = await fetch(`https://api.deezer.com/artist/${artistId}/top?limit=${limit}`);
  if (!resp.ok) throw new Error(`Deezer API error (${resp.status})`);
  const payload = await resp.json();

  const tracks = [];
  for (const item of payload.data || []) {
    const name = item.title;
    const artistName = item.artist && item.artist.name;
    const previewUrl = item.preview;
    if (name && artistName) {
      tracks.push({ name, artists: [artistName], previewUrl });
    }
  }
  return tracks;
}

// Resolves the typed artist name (even with typos) and returns their most
// popular tracks.
async function fetchTracksByArtistName(query, limit = 50) {
  const artist = await resolveArtistFuzzy(query);
  if (!artist) throw new Error(`No artist found for '${query}'.`);
  const tracks = await fetchDeezerArtistTopTracks(artist.id, limit);
  if (!tracks.length) throw new Error(`No tracks found for artist '${artist.name}'.`);
  return tracks;
}

// --- Fallback: find a Deezer preview for a track that has none (e.g. Spotify without preview_url) ---

async function deezerPreviewFor(title, artist) {
  try {
    const resp = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(`track:"${title}" artist:"${artist}"`)}`
    );
    if (resp.ok) {
      const data = (await resp.json()).data || [];
      if (data[0] && data[0].preview) return data[0].preview;
    }
  } catch {
    // ignore, try the looser query below
  }

  try {
    const resp = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`);
    if (resp.ok) {
      const data = (await resp.json()).data || [];
      if (data[0] && data[0].preview) return data[0].preview;
    }
  } catch {
    // ignore
  }

  return null;
}

// Returns a playable mp3 URL for the track, using Spotify if available and
// Deezer as a fallback.
async function resolvePlayableUrl(track) {
  if (track.previewUrl) return track.previewUrl;
  return deezerPreviewFor(track.name, track.artists[0]);
}

// --- Dispatcher: single link (playlist or track), any of the 3 services ---

async function fetchSingleLink(source) {
  if (isDeezerSource(source)) {
    return isTrackUrl(source) ? [await fetchDeezerSingleTrack(source)] : fetchDeezerPlaylistTracks(source);
  }

  if (isItunesSource(source)) {
    // iTunes/Apple Music: currently we only support single tracks (there's no
    // reliable way to read a user playlist via a public, unauthenticated API).
    return [await fetchItunesSingleTrack(source)];
  }

  if (isSpotifySource(source)) {
    return isTrackUrl(source)
      ? [await fetchSpotifySingleTrack(source)]
      : fetchSpotifyPlaylistTracks(source);
  }

  throw new Error("I don't recognize this link: paste a valid Spotify, Deezer, or iTunes/Apple Music link.");
}

// Dispatcher: recognizes whether the link is Deezer, Spotify or iTunes, a
// playlist or a single track, and supports multiple links separated by
// commas (useful for building a custom mini-quiz without creating a
// dedicated playlist).
async function fetchTracksFromSource(source) {
  const links = source
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!links.length) throw new Error('No valid link provided.');

  const allTracks = [];
  const errors = [];
  for (const link of links) {
    try {
      const tracks = await fetchSingleLink(link);
      allTracks.push(...tracks);
    } catch (err) {
      errors.push(`${link}: ${err.message}`);
    }
  }

  if (!allTracks.length) {
    throw new Error(errors.length ? errors.join('; ') : 'No tracks found.');
  }

  return allTracks;
}

module.exports = {
  SPECIAL_CATEGORIES,
  fetchTracksFromSource,
  fetchDeezerChartTracks,
  fetchDeezerGenres,
  fetchRandomTracksByCategory,
  fetchSpecialCategoryTracks,
  fetchTracksByArtistName,
  searchDeezerArtists,
  resolvePlayableUrl,
};
