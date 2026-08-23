# MicioDev OBS Overlay

A browser-source overlay for OBS Studio, split into one small page per piece (background, navbar, footer, chat, alerts, quiz, and a reusable placement frame) so each is added as its own OBS Browser Source and positioned with OBS's own transform. A persistent live-chat panel, serialized alerts, synthesized alert sounds, and an optional local WebSocket relay for YouTube Live events are included.

## Prerequisites

- Node.js 24 or newer
- pnpm 11 or newer
- OBS Studio for use as a Browser Source
- A YouTube Data API v3 key only for YouTube Live mode

From the repository root, install dependencies once:

```bash
pnpm install
```

## Choose a mode

The browser app and relay are deliberately separate. `DEMO MODE` means the **browser** is generating its own synthetic events; `LIVE` means it has an open WebSocket connection to the relay. `LIVE` does not, by itself, mean that YouTube is live.

| Mode | Browser source | Relay source | Intended use |
| --- | --- | --- | --- |
| Browser Demo | Browser-generated synthetic events | Not required | Preview the visual overlay quickly |
| Mock Integration | Relay-generated synthetic events | Explicit mock source | Test the browser-to-relay WebSocket path |
| YouTube Live | Real YouTube Live Chat events | YouTube source | Use during an actual stream |

### Browser Demo

No relay is required. Run this from the repository root:

```bash
VITE_DEMO_MODE=true pnpm dev
```

Open `http://localhost:5173/` for an index of every page. Open `http://localhost:5173/navbar` directly to see the connection status — it reads `DEMO MODE` — and `http://localhost:5173/chat` and `http://localhost:5173/alerts` to watch chat messages plus Super Chat, Super Sticker, membership, gift, poll, and chat-mode alerts generated in the browser.

For a one-command local demo that starts both processes and cleans them up on `Ctrl+C`, run:

```bash
./start-demo.sh
```

The launcher starts the relay with `EVENT_SOURCE=none`, so it never emits mock events; the browser remains deliberately in `VITE_DEMO_MODE=true` and generates all demo events itself. It can be launched from any directory and requires dependencies to have been installed with `pnpm install`.

### Mock Integration Test

Use this mode to verify the real WebSocket connection without YouTube credentials. The relay will emit synthetic events only because both flags are explicitly set.

**Terminal 1 — relay**

```bash
EVENT_SOURCE=mock MOCK_SOURCE_ENABLED=true pnpm dev:relay
```

**Terminal 2 — overlay**

```bash
VITE_DEMO_MODE=false VITE_RELAY_URL=ws://localhost:8787/events pnpm dev
```

Open `http://localhost:5173/navbar`. The status should read `LIVE`; the events are synthetic relay events, not YouTube events.

### YouTube Live

Use this mode for real YouTube Live Chat events. The relay resolves `@miciodev`, discovers the currently active broadcast, obtains its active chat ID, and then polls that chat. You do **not** need to change a chat ID for each new broadcast.

#### 1. Create a YouTube API key

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Enable **YouTube Data API v3** in **APIs & Services → Library**.
3. In **APIs & Services → Credentials**, create an API key.
4. Restrict the key to **YouTube Data API v3** and apply an application restriction appropriate for the machine that runs the relay.

The relay only reads public channel, live-video, and live-chat data, so it uses an API key rather than OAuth. Google documents the API setup and key restrictions in its [YouTube Data API overview](https://developers.google.com/youtube/v3/getting-started) and [credential guide](https://developers.google.com/youtube/registering_an_application).

#### 2. Start the relay and overlay

Replace the placeholder with your real key. Do not add spaces around the value.

**Terminal 1 — relay**

```bash
EVENT_SOURCE=youtube \
MOCK_SOURCE_ENABLED=false \
YOUTUBE_API_KEY='YOUR_YOUTUBE_DATA_API_KEY' \
YOUTUBE_CHANNEL_HANDLE='miciodev' \
pnpm dev:relay
```

**Terminal 2 — overlay**

```bash
VITE_DEMO_MODE=false \
VITE_RELAY_URL=ws://localhost:8787/events \
pnpm dev
```

When the channel is currently live, the `/navbar` page's connection status changes to `LIVE` as soon as its WebSocket connects. The `/footer` page shows the relay-owned lifecycle, duration, concurrent/peak viewers, session chat activity, paid support totals, and memberships only when each metric is available.

#### What YouTube events are shown?

- Text messages are added to the live-chat panel, with the author's YouTube display name, avatar, and owner/moderator/member role.
- Super Chats and Super Stickers become distinct serialized alerts. The official API supplies a Super Sticker alt label and ID, not artwork.
- New YouTube channel memberships (kept as the legacy `subscriber` event) become `NEW MEMBER` alerts.
- Membership milestones, membership gifts, gift recipients (batched), and members-only chat changes are normalized by the relay.
- Polls appear in a compact HUD above the status bar with per-option percentages taken from `pollDetails.metadata.options[].tally`, and the result stays on screen briefly after the poll closes.
- Moderation never creates a large alert. A `tombstone` removes the message it replaces, and a `userBannedEvent` retracts that author's remaining backlog from the panel.

Provider channel IDs never reach the browser: the relay swaps them for an opaque per-process participant ID, while the public display name and avatar — already visible in YouTube's own live chat — are passed through so alerts can credit the supporter.

Ordinary channel subscriptions are not emitted by this integration; the YouTube Live Chat API event used here reports new memberships, not every new subscriber. Broadcast `statistics.totalChatCount`, owner stream health, and the `testing` lifecycle state require OAuth/owner resources, so this API-key-only relay intentionally leaves them unavailable rather than inventing data. `giftEvent` is a documented message type with no documented payload, so it is deliberately ignored.

#### YouTube API quota

`liveChatMessages.list` costs 5 quota units per call, so polling every 10 seconds spends about 43,200 units a day against a default project allowance of 10,000. The relay therefore:

- never polls faster than `POLL_INTERVAL_MS`, even when the API suggests a shorter interval;
- charges every call against `YOUTUBE_DAILY_QUOTA_UNITS` (default `10000`, `0` disables the guard);
- slows chat polling to 60s and metric refreshes to 5 minutes once 80% of the allowance is spent;
- pauses polling until the next UTC midnight when the allowance is gone, holding the last known state instead of failing.

For a multi-hour stream, request a quota increase for your Google Cloud project and raise `YOUTUBE_DAILY_QUOTA_UNITS` to match.

#### No active live broadcast

The relay remains healthy and emits no events while the channel is offline. To avoid exhausting YouTube API quota, active-live discovery retries after 5, 10, 20, 40, and then every 60 minutes. It also returns to discovery when the current live chat ends.

`YOUTUBE_LIVE_CHAT_ID` is supported as an optional one-broadcast override, but is normally unnecessary when `YOUTUBE_CHANNEL_HANDLE` is set:

```bash
EVENT_SOURCE=youtube \
YOUTUBE_API_KEY='YOUR_YOUTUBE_DATA_API_KEY' \
YOUTUBE_LIVE_CHAT_ID='ACTIVE_LIVE_CHAT_ID' \
pnpm dev:relay
```

## Optional local configuration files

Inline variables above are the clearest way to switch modes and do not create files. For repeated local use, copy the templates instead:

```bash
cp apps/overlay/.env.example apps/overlay/.env.local
cp packages/event-relay/.env.example packages/event-relay/.env
```

Set the overlay values in `apps/overlay/.env.local`:

```dotenv
VITE_DEMO_MODE=false
VITE_RELAY_URL=ws://localhost:8787/events
# Optional; normally derived from VITE_RELAY_URL.
VITE_QUIZ_API_URL=http://localhost:8787/quiz/state
```

Set the relay values in `packages/event-relay/.env`:

```dotenv
EVENT_SOURCE=youtube
MOCK_SOURCE_ENABLED=false
QUIZ_DATABASE_PATH=./data/quiz.sqlite
YOUTUBE_API_KEY=YOUR_YOUTUBE_DATA_API_KEY
YOUTUBE_CHANNEL_HANDLE=miciodev
POLL_INTERVAL_MS=10000
YOUTUBE_DAILY_QUOTA_UNITS=10000
```

Restart the relevant process after changing configuration. Vite reads `VITE_*` variables when it starts, so a running `pnpm dev` server must be stopped and started again.

`EVENT_SOURCE=none` is the relay default. It is a healthy, no-event source. `EVENT_SOURCE=mock` additionally requires `MOCK_SOURCE_ENABLED=true`; otherwise startup fails rather than sending fabricated events.

## OBS Browser Source

Every overlay piece is its own page, so it is its own **Browser Source**. There is no `?layout=` switch to flip anymore — you build the layout once in OBS by adding, sizing, and stacking sources, and it stays that way across streams. Start the selected overlay mode, then add one Browser Source per row you need:

| Page | URL | What it is |
| --- | --- | --- |
| Background | `http://localhost:5173/background` | Full-bleed grid background. Bottom of the stack — opaque on purpose. |
| Navbar | `http://localhost:5173/navbar` | Brand copy and the live connection badge, top corners. |
| Footer | `http://localhost:5173/footer` | Viewer/revenue/member stats bar, bottom. |
| Chat | `http://localhost:5173/chat` | Live chat panel — fills its Browser Source edge-to-edge, so size and position it to wherever and however big you want the panel. |
| Alerts | `http://localhost:5173/alerts` | Alert queue, floating emoji reactions, and the poll HUD. |
| Quiz | `http://localhost:5173/quiz` | Python quiz board (replaces a screen-capture Browser Source when running the game). |
| Placement | `http://localhost:5173/placement?label=Screen&radius=md` | Generic reusable frame — add once per capture source (see below). |

### One-click setup

Open the app root (`http://localhost:5173/` or your deployed URL) and click **Download OBS scene collection**. It downloads a `.json` file, ready for OBS's **Scene Collection → Import**, that adds every page above as its own Browser Source, already stacked in the right order and sized on a 1920×1080 canvas — three of them are `/placement` frames for the logo, screen, and webcam. It contains only Browser Sources, so the same file works unchanged on Windows, macOS, and Linux (capture-device sources are OS-specific, so there's no cross-platform packaging problem to solve — this sidesteps it rather than generating a package per OS). After importing, add your own Display Capture and webcam sources and drag the placement frames onto them.

Click **Preview the full layout** on the same page to see that exact composition — every page embedded at its real OBS position and size on a scaled 1920×1080 canvas, in a normal browser tab, no OBS required. It forces demo mode on every embedded page via a `?demo=true` query param regardless of how the current deploy is configured, so the preview always shows fake chat, alerts, and stats even against a live production build.

### Building a scene by hand

Skip this if the one-click import above already did it; read on to understand what it built, or to lay it out yourself.

1. Add `/background` first, sized to the full canvas, and put it at the **bottom** of the source list.
2. Add your display capture and camera as native OBS sources (Display Capture, Video Capture Device) above the background.
3. Add `/placement` once per capture source, sized and positioned in OBS to exactly cover it, **above** that capture source. It draws only a dashed border — the fully transparent interior lets the real capture show through, and OBS's own transform (not this app) now owns its size, position, and aspect ratio. Use the `label` query param for a readable source name in Demo Mode (e.g. `?label=Webcam`) and `radius=sm|md|none` to match the border's corner radius to what you're framing.
4. Add `/navbar`, `/footer`, and `/alerts` above everything, each full-canvas — their content self-positions to a corner or edge, so the source itself can stay full-size.
5. Add `/chat` sized and positioned to wherever you want the panel: unlike navbar/footer/alerts, it fills its Browser Source edge-to-edge rather than anchoring to a corner, so a bigger source shows more messages instead of leaving empty space.
6. For the quiz game, swap your screen-capture source and its `/placement` frame for `/quiz`, sized to the same region.

Every page besides `/background` has a fully transparent document background, so stacking order — not layout math — is what keeps lower sources visible. In Demo Mode, `/placement`'s label is exposed to assistive tech as a visible placement hint; it is `aria-hidden` in live mode. The header CTA, `ISCRIVITI CAGNACCIO!`, is intentional permanent brand copy, not a Demo Mode placeholder.

Recommended Browser Source settings, for every source above:

- Set the width and height to match the region it covers (the full canvas for background/navbar/footer/alerts, wherever and however big you want the chat panel, the exact capture region for a placement frame).
- Enable **Refresh browser when scene becomes active**.
- Enable **Control audio via OBS** on the `/alerts` source if alert sounds should be mixed and monitored by OBS.
- Do not enable a custom CSS override unless you understand its effect on the overlay.

## Sound and connection troubleshooting

### The page says `DEMO MODE`

The browser was started without `VITE_DEMO_MODE=false`. Stop Vite and restart it with the exact overlay command for Mock Integration or YouTube Live. Relay variables such as `EVENT_SOURCE` do not affect Vite.

### The page says `RECONNECTING`

The browser cannot reach the relay. Start `pnpm dev:relay` in a separate terminal, then check the relay health endpoint:

```bash
curl http://localhost:8787/health
```

Expected response:

```json
{"status":"ok","source":"youtube"}
```

The `source` value may also be `none` or `mock`. Check that `VITE_RELAY_URL` matches the relay address and that port `8787` is available.

### The page says `LIVE`, but there are no events

The WebSocket is connected. In YouTube mode, confirm that the channel has an active public live broadcast and that someone has sent a supported chat, membership, or Super Chat event. While the channel is offline, the relay intentionally remains quiet and retries discovery with backoff.

### Alerts are visible but silent

The sounds use the browser Web Audio API. Browsers may block audio until a user gesture occurs. Click the browser page once before testing alerts. In OBS, also enable **Control audio via OBS** for the Browser Source and verify that the source is not muted in the OBS Audio Mixer. Visual alerts continue even when the browser blocks audio.

## Relay behavior and security

The relay listens on `127.0.0.1:8787` by default and exposes:

- WebSocket: `ws://localhost:8787/events`
- Health check: `http://localhost:8787/health`
- Read-only public quiz state: `http://localhost:8787/quiz/state`

Set `HOST=0.0.0.0` only when a trusted network boundary is in place. `PORT` accepts integers from 1 to 65535; `MOCK_INTERVAL_MS` accepts 1000 to 60000 milliseconds. Invalid explicit values fail at startup.

`/events` has no application authentication: it is an intentionally public, read-only Browser Source endpoint. Do not expose it directly to the internet unless a trusted reverse proxy or network boundary restricts access. Inbound WebSocket frames up to 16 KiB are accepted by the transport and ignored by the relay; oversized frames are rejected by the transport. The relay admits at most 100 simultaneous connections and rejects the 101st with close code `1013`. It terminates a client before the current queued outbound bytes plus the next UTF-8 payload would exceed 256 KiB, rather than retaining an unbounded backlog. Outbound relay messages larger than 16 KiB are skipped. None of these limits are authorization controls.

Never commit API keys. `.env` and `.env.local` are ignored by Git; commit only the provided `.env.example` templates with placeholder values. If a key is exposed, revoke it in Google Cloud and create a replacement immediately.

### Railway SQLite volume (required for production quiz data)

The relay seeds exactly 100 versioned Python questions into SQLite at startup and exposes them read-only to the static overlay. Attach **one Railway Volume** to the relay service at `/app/data`, then set `QUIZ_DATABASE_PATH=/app/data/quiz.sqlite` (the tracked `railway.toml` start command already supplies this value). Railway mounts volumes only at runtime, so do not run database initialization as a build or pre-deploy command.

The relay owns the shared 10-question round, timing, scoring, and answer reveal. The Vercel overlay derives `https://…/quiz/state` from `VITE_RELAY_URL` by default; set `VITE_QUIZ_API_URL` only when the HTTP API uses a different public origin. The CORS-enabled API never reveals the correct answer during a question. Viewer scores are retained only for the active relay process; only the question bank is stored in SQLite.

## Verification

Run the full local quality suite from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Project structure

- `apps/overlay` — Vue 3 and Vite Browser Source.
- `packages/event-relay` — Node HTTP/WebSocket relay with idle, mock, and YouTube sources.
- `packages/shared-types` — Shared normalized overlay-event types.
- `assets` — Overlay visual assets.

## License

MIT — see [LICENSE](LICENSE).
