/**
 * musicport core: a 12-tool core subset of the Spotify MCP server
 * surface, implemented clean-room against the public Spotify Web API
 * (https://api.spotify.com/v1, base overridable via
 * SPOTIFY_API_BASE_URL).
 *
 * Auth: TOKEN-ENV ONLY. SPOTIFY_ACCESS_TOKEN, sent as
 * `Authorization: Bearer`, with `Accept: application/json` on every
 * request and `Content-Type: application/json` on body requests. A
 * missing token is an error naming the variable. All HTTP goes
 * through an injected FetchFn so the wire behaviour is fully
 * testable offline.
 *
 * Note: the hosted/community OAuth flow (SPOTIFY_CLIENT_ID /
 * SPOTIFY_CLIENT_SECRET + browser consent + refresh) is NOT
 * reproduced — tools take SPOTIFY_ACCESS_TOKEN directly.
 */
import type {
  AddTracksToPlaylistOptions,
  CreatePlaylistOptions,
  FetchFn,
  GetPlaylistOptions,
  ListPlaylistsOptions,
  ListSavedTracksOptions,
  PlayOptions,
  SearchOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_API_BASE = "https://api.spotify.com/v1";

export function tokenFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.SPOTIFY_ACCESS_TOKEN;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) throw new Error("SPOTIFY_ACCESS_TOKEN environment variable is required");
  return token;
}

export function apiBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.SPOTIFY_API_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

interface RequestSpec { method: string; path: string; body?: unknown; }

async function apiRequest(fetchFn: FetchFn, token: string, base: string, spec: RequestSpec): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (spec.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetchFn(`${base}${spec.path}`, {
    method: spec.method,
    headers,
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      const first = parsed.error?.message;
      if (typeof first === "string") detail = first;
    } catch { /* keep raw */ }
    throw new Error(`Spotify API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out;
}
const enc = encodeURIComponent;

export async function search(fetchFn: FetchFn, token: string, base: string, opts: SearchOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/search${query({ q: opts.query, type: opts.type ?? "track", limit: opts.limit })}` });
}
export async function getCurrentUserProfile(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: "/me" });
}
export async function getPlaybackState(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: "/me/player" });
}
export async function play(fetchFn: FetchFn, token: string, base: string, opts: PlayOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "PUT",
    path: `/me/player/play${query({ device_id: opts.device_id })}`,
    body: clean({ uris: opts.uris }),
  });
}
export async function pause(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "PUT", path: "/me/player/pause" });
}
export async function nextTrack(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "POST", path: "/me/player/next" });
}
export async function previousTrack(fetchFn: FetchFn, token: string, base: string): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "POST", path: "/me/player/previous" });
}
export async function listPlaylists(fetchFn: FetchFn, token: string, base: string, opts: ListPlaylistsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/me/playlists${query({ limit: opts.limit })}` });
}
export async function getPlaylist(fetchFn: FetchFn, token: string, base: string, opts: GetPlaylistOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/playlists/${enc(opts.playlist_id)}` });
}
export async function createPlaylist(fetchFn: FetchFn, token: string, base: string, opts: CreatePlaylistOptions): Promise<unknown> {
  const me = (await apiRequest(fetchFn, token, base, { method: "GET", path: "/me" })) as { id?: string };
  const userId = me?.id;
  if (!userId) throw new Error("Spotify API error: current user profile did not include an id");
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/users/${enc(userId)}/playlists`,
    body: clean({ name: opts.name, description: opts.description, public: opts.public }),
  });
}
export async function addTracksToPlaylist(fetchFn: FetchFn, token: string, base: string, opts: AddTracksToPlaylistOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, {
    method: "POST",
    path: `/playlists/${enc(opts.playlist_id)}/tracks`,
    body: { uris: opts.uris },
  });
}
export async function listSavedTracks(fetchFn: FetchFn, token: string, base: string, opts: ListSavedTracksOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, { method: "GET", path: `/me/tracks${query({ limit: opts.limit })}` });
}

export async function callTool(fetchFn: FetchFn, token: string, base: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search": return search(fetchFn, token, base, args as unknown as SearchOptions);
    case "get_current_user_profile": return getCurrentUserProfile(fetchFn, token, base);
    case "get_playback_state": return getPlaybackState(fetchFn, token, base);
    case "play": return play(fetchFn, token, base, args as unknown as PlayOptions);
    case "pause": return pause(fetchFn, token, base);
    case "next_track": return nextTrack(fetchFn, token, base);
    case "previous_track": return previousTrack(fetchFn, token, base);
    case "list_playlists": return listPlaylists(fetchFn, token, base, args as unknown as ListPlaylistsOptions);
    case "get_playlist": return getPlaylist(fetchFn, token, base, args as unknown as GetPlaylistOptions);
    case "create_playlist": return createPlaylist(fetchFn, token, base, args as unknown as CreatePlaylistOptions);
    case "add_tracks_to_playlist": return addTracksToPlaylist(fetchFn, token, base, args as unknown as AddTracksToPlaylistOptions);
    case "list_saved_tracks": return listSavedTracks(fetchFn, token, base, args as unknown as ListSavedTracksOptions);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
