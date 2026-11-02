/**
 * musicport MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 *
 * TOKEN-ENV ONLY: SPOTIFY_ACCESS_TOKEN is used directly; the OAuth
 * flow (client id/secret + consent + refresh) is NOT reproduced.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, callTool, tokenFromEnv, VERSION } from "./spotify.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  search: z.object({ query: z.string(), type: z.string().optional(), limit: z.number().optional() }),
  get_current_user_profile: z.object({}),
  get_playback_state: z.object({}),
  play: z.object({ device_id: z.string().optional(), uris: z.array(z.string()).optional() }),
  pause: z.object({}),
  next_track: z.object({}),
  previous_track: z.object({}),
  list_playlists: z.object({ limit: z.number().optional() }),
  get_playlist: z.object({ playlist_id: z.string() }),
  create_playlist: z.object({ name: z.string(), description: z.string().optional(), public: z.boolean().optional() }),
  add_tracks_to_playlist: z.object({ playlist_id: z.string(), uris: z.array(z.string()) }),
  list_saved_tracks: z.object({ limit: z.number().optional() }),
};

export const TOOLS = [
  {
    name: "search",
    description: "Search Spotify catalog.",
    inputSchema: { type: "object" as const, properties: { query: { type: "string", description: "The search text to query the Spotify catalog with, sent as the q parameter." }, type: { type: "string", description: "Optional type of item to search for (defaults to 'track' when omitted)." }, limit: { type: "number", description: "Optional maximum number of search results to return." } }, required: ["query"] },
  },
  {
    name: "get_current_user_profile",
    description: "Get the current Spotify user's profile.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "get_playback_state",
    description: "Get the current Spotify playback state.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "play",
    description: "Start or resume Spotify playback.",
    inputSchema: { type: "object" as const, properties: { device_id: { type: "string", description: "Optional identifier of the device to start playback on." }, uris: { type: "array", items: { type: "string" }, description: "Optional list of Spotify URIs to play; omitted from the request when not provided." } }, required: [] as string[] },
  },
  {
    name: "pause",
    description: "Pause Spotify playback.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "next_track",
    description: "Skip to the next Spotify track.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "previous_track",
    description: "Skip to the previous Spotify track.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "list_playlists",
    description: "List the current user's Spotify playlists.",
    inputSchema: { type: "object" as const, properties: { limit: { type: "number", description: "Optional maximum number of playlists to return." } }, required: [] as string[] },
  },
  {
    name: "get_playlist",
    description: "Retrieve a Spotify playlist by ID.",
    inputSchema: { type: "object" as const, properties: { playlist_id: { type: "string", description: "The unique identifier of the Spotify playlist to retrieve." } }, required: ["playlist_id"] },
  },
  {
    name: "create_playlist",
    description: "Create a Spotify playlist for the current user.",
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "The name to give the new playlist." }, description: { type: "string", description: "Optional description for the new playlist." }, public: { type: "boolean", description: "Optional flag indicating whether the new playlist is public." } }, required: ["name"] },
  },
  {
    name: "add_tracks_to_playlist",
    description: "Add tracks to a Spotify playlist.",
    inputSchema: { type: "object" as const, properties: { playlist_id: { type: "string", description: "The unique identifier of the Spotify playlist to add tracks to." }, uris: { type: "array", items: { type: "string" }, description: "The list of Spotify track URIs to add to the playlist." } }, required: ["playlist_id", "uris"] },
  },
  {
    name: "list_saved_tracks",
    description: "List the current user's saved Spotify tracks.",
    inputSchema: { type: "object" as const, properties: { limit: { type: "number", description: "Optional maximum number of saved tracks to return." } }, required: [] as string[] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "musicport", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const token = tokenFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, token, apiBaseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
