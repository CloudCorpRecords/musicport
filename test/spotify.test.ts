import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addTracksToPlaylist,
  apiBaseFromEnv,
  createPlaylist,
  getCurrentUserProfile,
  getPlaybackState,
  getPlaylist,
  listPlaylists,
  listSavedTracks,
  nextTrack,
  pause,
  play,
  previousTrack,
  search,
  tokenFromEnv,
} from "../src/spotify.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; rawBody?: string; }

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body, rawBody: init?.body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText !== undefined ? step.rawText : (step.payload === null ? "" : JSON.stringify(step.payload)),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://api.spotify.com/v1";
const TOKEN = "test-token";

describe("musicport core", () => {
  it("names the env var when the token is missing", () => {
    assert.throws(() => tokenFromEnv({}), /SPOTIFY_ACCESS_TOKEN environment variable is required/);
    assert.equal(tokenFromEnv({ SPOTIFY_ACCESS_TOKEN: " x " }), "x");
  });

  it("base override trims trailing slashes and defaults correctly", () => {
    assert.equal(apiBaseFromEnv({}), "https://api.spotify.com/v1");
    assert.equal(apiBaseFromEnv({ SPOTIFY_API_BASE_URL: "https://example.test/v1/" }), "https://example.test/v1");
    assert.equal(apiBaseFromEnv({ SPOTIFY_API_BASE_URL: " https://example.test/v1/// " }), "https://example.test/v1");
  });

  it("search encodes query, defaults type=track, and sends Bearer + Accept", async () => {
    const { fn, calls } = fakeFetch([{ match: "/search", payload: { tracks: { items: [] } } }]);
    await search(fn, TOKEN, BASE, { query: "hello world & more" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/search?q=hello%20world%20%26%20more&type=track");
    assert.equal(calls[0].headers.Authorization, "Bearer test-token");
    assert.equal(calls[0].headers.Accept, "application/json");
    await search(fn, TOKEN, BASE, { query: "x", type: "album", limit: 5 });
    assert.equal(calls[1].url, "https://api.spotify.com/v1/search?q=x&type=album&limit=5");
  });

  it("get_current_user_profile gets /me", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me", payload: { id: "u1" } }]);
    const out = (await getCurrentUserProfile(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me");
    assert.equal(out.id, "u1");
  });

  it("get_playback_state gets /me/player and maps 204 empty body to {status}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/player", payload: null, status: 204, rawText: "" }]);
    const out = (await getPlaybackState(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/player");
    assert.deepEqual(out, { status: 204 });
  });

  it("play puts with uris body and device_id query when provided", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/player/play", payload: null, status: 204, rawText: "" }]);
    const out = (await play(fn, TOKEN, BASE, { device_id: "dev1", uris: ["spotify:track:1", "spotify:track:2"] })) as Record<string, unknown>;
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/player/play?device_id=dev1");
    assert.deepEqual(calls[0].body, { uris: ["spotify:track:1", "spotify:track:2"] });
    assert.equal(calls[0].headers["Content-Type"], "application/json");
    assert.deepEqual(out, { status: 204 });
  });

  it("play without uris or device sends no body fields and no query", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/player/play", payload: null, status: 204, rawText: "" }]);
    await play(fn, TOKEN, BASE, {});
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/player/play");
    assert.deepEqual(calls[0].body, {});
  });

  it("pause puts /me/player/pause", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/player/pause", payload: null, status: 204, rawText: "" }]);
    const out = (await pause(fn, TOKEN, BASE)) as Record<string, unknown>;
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/player/pause");
    assert.deepEqual(out, { status: 204 });
  });

  it("next_track posts /me/player/next", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/player/next", payload: null, status: 204, rawText: "" }]);
    await nextTrack(fn, TOKEN, BASE);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/player/next");
  });

  it("previous_track posts /me/player/previous", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/player/previous", payload: null, status: 204, rawText: "" }]);
    await previousTrack(fn, TOKEN, BASE);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/player/previous");
  });

  it("list_playlists gets /me/playlists with optional limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/playlists", payload: { items: [] } }]);
    await listPlaylists(fn, TOKEN, BASE, {});
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/playlists");
    await listPlaylists(fn, TOKEN, BASE, { limit: 10 });
    assert.equal(calls[1].url, "https://api.spotify.com/v1/me/playlists?limit=10");
  });

  it("get_playlist gets /playlists/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/playlists/pl1", payload: { id: "pl1" } }]);
    await getPlaylist(fn, TOKEN, BASE, { playlist_id: "pl1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/playlists/pl1");
  });

  it("create_playlist does GET /me first, then POST /users/{id}/playlists with provided fields", async () => {
    const calls: Recorded[] = [];
    const fn: FetchFn = async (url, init) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
      const isMe = url === "https://api.spotify.com/v1/me";
      const payload = isMe ? { id: "user42" } : { id: "newpl" };
      const res: HttpResponse = {
        ok: true, status: isMe ? 200 : 201, headers: { get: () => null },
        text: async () => JSON.stringify(payload),
      };
      return res;
    };
    const out = (await createPlaylist(fn, TOKEN, BASE, { name: "Mix", description: "Desc", public: false })) as Record<string, unknown>;
    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me");
    assert.equal(calls[1].method, "POST");
    assert.equal(calls[1].url, "https://api.spotify.com/v1/users/user42/playlists");
    assert.deepEqual(calls[1].body, { name: "Mix", description: "Desc", public: false });
    assert.equal(calls[1].headers["Content-Type"], "application/json");
    assert.equal(out.id, "newpl");
    // Provided-fields-only: only name
    calls.length = 0;
    const fn2: FetchFn = fn;
    await createPlaylist(fn2, TOKEN, BASE, { name: "Only" });
    assert.deepEqual(calls[1].body, { name: "Only" });
  });

  it("add_tracks_to_playlist posts {uris} to /playlists/{id}/tracks", async () => {
    const { fn, calls } = fakeFetch([{ match: "/tracks", payload: { snapshot_id: "snap1" } }]);
    await addTracksToPlaylist(fn, TOKEN, BASE, { playlist_id: "pl1", uris: ["spotify:track:9"] });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.spotify.com/v1/playlists/pl1/tracks");
    assert.deepEqual(calls[0].body, { uris: ["spotify:track:9"] });
  });

  it("list_saved_tracks gets /me/tracks with optional limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/me/tracks", payload: { items: [] } }]);
    await listSavedTracks(fn, TOKEN, BASE, {});
    assert.equal(calls[0].url, "https://api.spotify.com/v1/me/tracks");
    await listSavedTracks(fn, TOKEN, BASE, { limit: 20 });
    assert.equal(calls[1].url, "https://api.spotify.com/v1/me/tracks?limit=20");
  });

  it("surfaces upstream error status and Spotify error message", async () => {
    const { fn } = fakeFetch([{ match: "/search", payload: { error: { status: 401, message: "The access token expired" } }, status: 401 }]);
    await assert.rejects(() => search(fn, TOKEN, BASE, { query: "x" }), /Spotify API error 401: The access token expired/);
  });
});
