# musicport

Spotify search, playback and playlists as MCP tools, talking to the
Spotify Web API. musicport is a clean-room rebuild of the core
surface of community Spotify MCP servers, under a new name: fresh
code, no copied branding.

**TOKEN-ENV ONLY.** The hosted/community OAuth flow
(SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET + browser consent +
refresh) is NOT reproduced. Tools use `SPOTIFY_ACCESS_TOKEN`
directly as `Authorization: Bearer`.

## Tools (core subset, 12)

`search`, `get_current_user_profile`, `get_playback_state`, `play`,
`pause`, `next_track`, `previous_track`, `list_playlists`,
`get_playlist`, `create_playlist`, `add_tracks_to_playlist`,
`list_saved_tracks`.

Not in this subset: OAuth authorization/refresh flow,
track/album/artist detail reads beyond search, audio
features/analysis, recommendations, shows/episodes/audiobooks,
follow/unfollow artists and users, playlist cover images, playlist
item removal/reorder depth, library albums/shows, devices listing
and transfer playback, queue management, recently played, top
items.

## Setup

Obtain a Spotify access token through your own means and set it:

```bash
export SPOTIFY_ACCESS_TOKEN=BQ...
```

Optionally override the API base with `SPOTIFY_API_BASE_URL`
(default `https://api.spotify.com/v1`). Without the token, every
tool call fails with an error naming the missing variable:
`SPOTIFY_ACCESS_TOKEN environment variable is required`.

## CLI

```bash
npx @reneturcios/musicport search '{"query":"hello"}'
npx @reneturcios/musicport mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "musicport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/musicport", "mcp"],
      "env": { "SPOTIFY_ACCESS_TOKEN": "BQ..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e SPOTIFY_ACCESS_TOKEN ghcr.io/cloudcorprecords/musicport
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
