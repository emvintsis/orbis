# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ORBIS is a geopolitical simulation game — a single-page web app with no build system, no framework, no bundler. It uses vanilla JS, D3.js v7, TopoJSON, and the Gemini API for AI-driven gameplay. All content is in French.

## Development

**To run:** Open `index.html` in a browser. No server or build step required.

**Syntax check:** `node --check game.js` (useful since game.js is ~4000 lines)

**No tests, no linter, no CI.** The project is a single-page app with 4 source files loaded via `<script>` tags in `index.html`.

## Architecture

### File roles and load order

Files are loaded in this order in `index.html` — later files depend on earlier ones via globals:

1. **`data.js`** — Static data: `NAMES` (ISO numeric → French country name), `FLAGS`, `INIT_REL` (initial diplomatic relations per nation), `INIT_RESOURCES`, `INIT_WARS`, `PLAYABLE_NATIONS`, and the Gemini response JSON schema builder (`buildActionSchema`).
2. **`api.js`** — Gemini API layer: `geminiActionCall()` (main turn resolution), `geminiCallFull()` (diplomatic chat), `parseActionJson()` (5-strategy cascade parser), `displayDebugError()`. Defines `GeminiError` with typed errors (HTTP/SAFETY/JSON/EMPTY/RECITATION/OTHER).
3. **`game.js`** — Everything else (~4000 lines): game state (`G` global object), D3 map rendering, navigation between 5 screens, turn resolution, diplomacy system, save/load, UI event handlers, province ownership system.

### Key globals

- **`G`** — Single mutable game state object containing all runtime data (relations, conversations, resources, war progress, province ownership, etc.). Saved/loaded from `localStorage`.
- **`d3svg`, `d3g`, `d3zoom`, `d3path`, `d3proj`** — D3 map primitives.
- **`d3provinces`**, **`countryToProvinces`** — Province-level GeoJSON features and country→province index.

### Map system

The map uses two data sources loaded in parallel:
- `countries-10m.json` (world-atlas) for country-level borders via `topojson.mesh`
- `admin1.topojson` (local file) for province-level features rendered as the main map layer

Provinces are colored based on `G.provinceOwnership` (who controls each province), not just country-level relations. Country borders are drawn as a separate mesh overlay.

### Game loop

1. Player writes a "decree" (free text) → submitted to Gemini with compressed context (current relations, last turn summary, world state)
2. Gemini returns structured JSON (enforced via `responseSchema`): events, relation changes, resource impacts, diplomatic contacts, world evolution
3. `parseActionJson()` parses the response (5 fallback strategies)
4. Game state updates: relations, resources, war progress, province ownership, opinion
5. News feed cards are generated, map colors update, diplomatic contacts create conversations

### Diplomacy

Conversations (bilateral or group) are stored in `G.conversations[]`. Each message is sent to Gemini with the leader's persona, current relation context, and last 6 exchanges. Contact notifications appear as toasts.

### Save system

Multi-slot saves in `localStorage` key `orbis_saves`. Auto-saves after each turn and diplomatic message. Full game state including `fullHistory` (for news feed reconstruction).

## Conventions

- All user-facing text is in **French**
- Country codes are **ISO 3166-1 numeric** (e.g., 840 = USA, 250 = France). Codes 9000+ are fictional (unrecognized states)
- Relations use string statuses: `'allied'`, `'friendly'`, `'neutral'`, `'tensions'`, `'hostile'`, `'war'`
- The `escHtml()` utility is used for HTML escaping in dynamically generated content
- CSS class prefix `ne-` for news feed elements, `conv-` for conversation elements
