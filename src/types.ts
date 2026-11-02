/**
 * musicport types.
 *
 * A core subset of the Spotify MCP surface: search, profile, playback
 * control, playlists and saved tracks against the Spotify Web API.
 * HTTP access is described by a minimal response surface so tests can
 * inject a fake fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface SearchOptions { query: string; type?: string; limit?: number; }
export interface GetCurrentUserProfileOptions {}
export interface GetPlaybackStateOptions {}
export interface PlayOptions { device_id?: string; uris?: string[]; }
export interface PauseOptions {}
export interface NextTrackOptions {}
export interface PreviousTrackOptions {}
export interface ListPlaylistsOptions { limit?: number; }
export interface GetPlaylistOptions { playlist_id: string; }
export interface CreatePlaylistOptions { name: string; description?: string; public?: boolean; }
export interface AddTracksToPlaylistOptions { playlist_id: string; uris: string[]; }
export interface ListSavedTracksOptions { limit?: number; }
