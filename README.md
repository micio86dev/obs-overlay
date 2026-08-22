# MicioDev OBS Overlay

A dark cyberpunk browser-source overlay for OBS Studio. It combines three composable layouts, serialized subscriber and Super Chat alerts, a persistent live chat panel, and a small WebSocket relay. The repository runs in a zero-credential demo mode by default.

## Quick start

Requirements: Node 24+ and pnpm 11+.

```bash
pnpm install
pnpm dev:relay
# second terminal
pnpm dev
```

The overlay starts with synthetic UI events unless `VITE_DEMO_MODE=false`; the relay separately defaults to `MockSource`, so both paths work without any service credentials.

## OBS Browser Source

Start the overlay with `pnpm dev`, then add a Browser Source in OBS using one of these URLs:

| Composition | URL | Recommended canvas |
| --- | --- | --- |
| Screen + webcam | `http://localhost:5173/?layout=screen-webcam` | 1920×1080 |
| Screen only | `http://localhost:5173/?layout=screen-only` | 1920×1080 |
| Webcam only | `http://localhost:5173/?layout=webcam-only` | 1280×720 |

Enable “Refresh browser when scene becomes active”. The **SCREEN CAPTURE** and **WEBCAM** regions are transparent/chroma-friendly placement guides: OBS owns the actual display and camera capture sources.

## Event relay

```bash
pnpm dev:relay
```

The relay listens on `ws://localhost:8787/events` and provides `GET /health`. `MockSource` emits normalized chat, subscriber, and super-chat events by default. To route the browser to it instead of local demo events, create `apps/overlay/.env.local`:

```dotenv
VITE_DEMO_MODE=false
VITE_RELAY_URL=ws://localhost:8787/events
```

### YouTube Live Chat

Copy `packages/event-relay/.env.example` to `.env` (or export the variables), set `EVENT_SOURCE=youtube`, then add `YOUTUBE_API_KEY` and `YOUTUBE_LIVE_CHAT_ID`. `YouTubeSource` polls `liveChatMessages.list`, follows the API polling interval while never polling faster than the configured quota-safe interval, and de-duplicates message IDs. A live YouTube credential is intentionally not required for development or CI.

## Architecture

- `apps/overlay` — Vue 3 + Vite Browser Source with `<script setup>` and no UI library.
- `packages/shared-types` — normalized event discriminated union shared by the browser and relay.
- `packages/event-relay` — Node HTTP health server plus `ws` WebSocket relay and pluggable source adapters.
- `assets` — original procedural SVG sting/background assets; Web Audio oscillators synthesize sounds at alert time, so no audio files or third-party licenses are needed.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Theme

Every brand design token lives in `apps/overlay/src/styles/theme.css`; change that file to retheme the entire overlay. The default is high-contrast black with layered neon-green glow, scanline/grid texture, and short glitch transitions.

## License

MIT — see [LICENSE](LICENSE).
