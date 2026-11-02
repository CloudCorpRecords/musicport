#!/usr/bin/env node
/**
 * musicport CLI.
 *   musicport <tool-name> '<json args>'
 *   musicport mcp
 * Requires SPOTIFY_ACCESS_TOKEN (TOKEN-ENV ONLY; no OAuth flow).
 * Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./spotify.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "search", "get_current_user_profile", "get_playback_state", "play", "pause",
  "next_track", "previous_track", "list_playlists", "get_playlist",
  "create_playlist", "add_tracks_to_playlist", "list_saved_tracks",
];

function usage(): never {
  console.error(`Usage:
  musicport <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  musicport mcp
  musicport --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, tokenFromEnv(), apiBaseFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
