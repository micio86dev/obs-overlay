# GOAL: Build a complete OBS streaming overlay — public monorepo, autonomous run

## Context

You are building a public GitHub monorepo containing a browser-source overlay
system for OBS Studio, used by an Italian dev YouTuber ("MicioDev") for live
streams and tutorials. Work fully autonomously overnight. Do not stop to ask
questions — make the most sensible decision, document it in the README and in
commit messages, and keep going. Only stop if something is truly blocking
(e.g. missing credentials that cannot be mocked).

## Objective

A single Vue 3 + Vite application, served as one or more OBS Browser Sources,
that renders animated on-screen alerts (chat messages, new subscribers, super
chats) over a background, in three interchangeable layouts, plus a small
backend that ingests events and relays them to the frontend over WebSocket.

## Repository structure

```
obs-overlay/
├── apps/
│   └── overlay/              # Vue 3 + Vite app
├── packages/
│   └── event-relay/          # Node backend: event source(s) -> WebSocket
├── assets/
│   ├── stings/                # short animated visual stings for alerts
│   ├── sounds/                # short sound effects
│   └── background/            # background art
├── docs/
│   └── ASSUMPTIONS.md         # every autonomous decision you made, and why
├── .github/workflows/         # CI: lint, typecheck, build
├── README.md
└── LICENSE
```

## Branding / theming

- Brand: "MicioDev" — dark/black background, green accent color. Define ALL
  theme values (background, accent green + a couple of shades of it, text
  color, font family, border-radius, spacing scale, animation timings) as
  CSS custom properties in one root stylesheet (e.g.
  `apps/overlay/src/styles/theme.css`), never hardcoded elsewhere. Goal:
  changing the whole look later means editing that one file only.
- Pick a clean, modern monospace or geometric sans font fitting a dev/coding
  channel; document the choice in `docs/ASSUMPTIONS.md`.
- Starting font: `"Courier New", monospace`, bold weight — set as a CSS
  custom property (`--font-family`, `--font-weight`) so it's a one-line
  swap later, not hardcoded per component.
- Overall aesthetic: cyberpunk / neon. Lean into it with things like: neon
  text-shadow/glow on the green accent (e.g. layered `text-shadow` /
  `box-shadow` glow), subtle scanline or grid texture in the background,
  sharp/glitchy micro-transitions on alerts (short glitch effect on
  entry/exit is welcome), high contrast black background. Keep it readable
  and not overdone — glow and contrast, not clutter.

## Frontend requirements (apps/overlay)

- Vue 3 + `<script setup>`, TypeScript, Vite. Keep dependencies minimal.
- Single app, three layouts selected via URL query param, e.g.:
  `?layout=screen-webcam`, `?layout=screen-only`, `?layout=webcam-only`.
  All three share one design system (same colors, type, alert component,
  background) — only the composition of "screen slot" / "webcam slot" /
  event-feed placement changes. Screen and webcam slots are just styled
  transparent/chroma placeholder regions (OBS composites the real capture
  sources on top or behind — do not try to capture real video yourself).
- One `AlertQueue` component that plays full alert animations one at a time
  (queue, not overlap) for: new subscriber, super chat (show amount and
  message).
- One `LiveChatFeed` component: a persistent scrolling panel (not a
  transient alert) showing incoming YouTube live chat messages in real
  time — this is a required feature, it will be used live on YouTube
  streams. Needs a max visible-messages count, auto-scroll, fade-out for
  old messages, and graceful handling of long messages/emotes-as-text.
- Connects to the backend over WebSocket, reconnects automatically with
  backoff, and has a `DEMO_MODE` (env flag) that fires fake random events on
  an interval — this is required so the overlay is fully testable and
  demoable without any live stream or credentials running.
- Background image behind everything, alert animations and sounds trigger
  together per event.

## Backend requirements (packages/event-relay)

- Node + TypeScript, minimal HTTP + WebSocket server (e.g. `ws` or
  `socket.io` — your choice, document it).
- Pluggable event source architecture: start with a `MockSource` that emits
  synthetic events (this must work out of the box with zero config) and a
  `YouTubeSource` stub that polls the YouTube Live Chat API
  (`liveChatMessages.list`) for chat messages, member/subscription events,
  and super chats, reading credentials from `.env` (`.env.example` provided,
  never commit real secrets). Since YouTube's API is polling-based, poll on
  an interval respecting quota, and de-duplicate by message ID.
- Normalizes all events into one shared TypeScript event type used by both
  packages (put it in a small shared `packages/shared-types` or similar if
  that's cleaner — your call).

## Assets — images and sounds

You will not have image/audio generation tools available, so produce assets
programmatically rather than leaving placeholders:
- Visual alert "stings": build as SVG + CSS/JS animations (e.g. confetti,
  particle bursts, animated badge) — no external raster GIFs needed. If you
  do have web access and find suitable CC0 / CC-BY assets (e.g. via
  OpenGameArt, Kenney.nl, Freesound), you may use them instead, but you MUST
  record the source and license in `docs/ASSUMPTIONS.md` and a `CREDITS.md`.
- Sound effects: synthesize short, pleasant, non-annoying sounds
  programmatically using the Web Audio API (oscillators/envelopes) rather
  than sourcing audio files, unless you have and use properly licensed CC0
  audio (same attribution rule as above).
- Background: a clean, simple generated/CSS-based background (gradient,
  geometric pattern, subtle animation) fitting a dev/coding stream aesthetic
  — dark theme, one accent color. Do not attempt to source or fabricate a
  photographic background.

## Non-interactivity rules

- Never block waiting for input. If a decision point comes up (library
  choice, exact color, animation style, WS protocol details), pick a
  reasonable option and log it to `docs/ASSUMPTIONS.md` with a one-line
  rationale.
- If a task turns out to need a real external credential (YouTube API key)
  to *run*, still write and test the code against the `MockSource`, leave
  the `YouTubeSource` implemented but untested live, and note this clearly.
- Commit incrementally with clear messages as you go — do not wait until the
  very end for a single giant commit.

## Definition of done

- [ ] `apps/overlay` runs with `pnpm dev`, shows all three layouts via query
      param, and demoably fires alerts with animation + sound in DEMO_MODE
      with zero configuration.
- [ ] `packages/event-relay` runs with `pnpm dev`, serves MockSource events
      over WebSocket by default.
- [ ] Root README explains: what this is, how to run it, how to add it as
      an OBS Browser Source (URL + recommended width/height per layout),
      how to switch from mock to real YouTube events.
- [ ] `docs/ASSUMPTIONS.md` lists every autonomous decision made.
- [ ] CI workflow runs lint + typecheck + build on push.
- [ ] MIT (or your best judgment) LICENSE file, since the repo is public.
- [ ] No secrets committed; `.env.example` present.

Build the whole thing end to end tonight. Prioritize a fully working,
demoable overlay in DEMO_MODE over a fully wired YouTube integration — the
demo path must never require credentials.
