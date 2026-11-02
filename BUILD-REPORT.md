# musicport — BUILD REPORT

Original: spotify (community Spotify MCP servers) → Rebuild: musicport
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the Spotify Web API (https://api.spotify.com/v1,
base overridable via SPOTIFY_API_BASE_URL), Authorization: Bearer
SPOTIFY_ACCESS_TOKEN with `Accept: application/json` on every
request and `Content-Type: application/json` on body requests, all
HTTP behind an injectable FetchFn:
search (GET /search?q=&type=track default&limit), get_current_user_profile
(GET /me), get_playback_state (GET /me/player, 204 empty → {status}),
play (PUT /me/player/play, device_id query, {uris} body only when
uris provided — otherwise an empty body object with no fields),
pause (PUT /me/player/pause), next_track (POST /me/player/next),
previous_track (POST /me/player/previous), list_playlists
(GET /me/playlists?limit), get_playlist (GET /playlists/{id}),
create_playlist (two calls: GET /me for the user id, then
POST /users/{id}/playlists with provided fields only, `public`
mapped to the JSON key "public"), add_tracks_to_playlist
(POST /playlists/{id}/tracks, body {uris}), list_saved_tracks
(GET /me/tracks?limit). Write endpoints returning 204/empty →
{status}.

Omitted groups (fixture `_source` lists them): OAuth
authorization/refresh flow, track/album/artist detail reads beyond
search, audio features/analysis, recommendations,
shows/episodes/audiobooks, follow/unfollow artists and users,
playlist cover images, playlist item removal/reorder depth,
library albums/shows, devices listing and transfer playback, queue
management, recently played, top items.

Ground truth: schemas are docs-derived from the public Spotify Web
API documentation (developer.spotify.com/documentation/web-api).
Fixture: harness/fixtures/spotify-tools-original.json (labelled
core-subset). TOKEN-ENV ONLY: the originals' OAuth flow
(SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET + browser consent +
refresh) is NOT reproduced — tools take SPOTIFY_ACCESS_TOKEN
directly. Parity proves the labelled subset only, never a full
Spotify surface.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 16/16 pass (fake FetchFn; missing-token naming
  SPOTIFY_ACCESS_TOKEN, base override/trim, search URL encoding +
  default type=track, playback 204 {status}, play body/query
  shaping with uris present/absent and device_id, pause/next/
  previous methods, playlists/saved-tracks limits, create_playlist
  two-call sequence asserting GET /me first then
  POST /users/{id}/playlists with provided-fields body including
  public:false, add_tracks body, upstream error surfacing with the
  Spotify error message).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env checks: CLI `search '{"query":"x"}'` with
  SPOTIFY_ACCESS_TOKEN unset → "error: SPOTIFY_ACCESS_TOKEN
  environment variable is required", exit 1; stdio tools/call
  search with the token unset returned isError
  "SPOTIFY_ACCESS_TOKEN environment variable is required".
- server.json description 52 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/musicport; full 19-file factory set
  present (plus this report).

## Honest gaps
- No live Spotify call was made — request/response behaviour is
  fake-fetch proven only.
- TOKEN-ENV ONLY: no OAuth authorization or token-refresh flow;
  the caller must supply a valid, unexpired SPOTIFY_ACCESS_TOKEN.
- play sends an empty JSON body object when no uris are given (no
  context_uri / offset / position support in this subset).
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
