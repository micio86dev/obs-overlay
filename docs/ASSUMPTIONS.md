# Autonomous implementation assumptions

This file records decisions made without pausing for input, as requested.

1. **Package manager: pnpm workspaces.** It keeps the Vue app, Node relay, and shared event contract independently runnable with low setup cost.
2. **WebSocket implementation: `ws`.** The native WebSocket protocol avoids the added transport and client dependency of Socket.IO, which is appropriate for one-way overlay events.
3. **Event contract: discriminated TypeScript union.** `chat`, `subscriber`, and `superchat` share identifiers and timestamps while preserving their distinct payload fields.
4. **Mock by default.** Both `MockSource` and browser demo mode need no secrets; this protects the primary demo path from YouTube API availability.
5. **YouTube source uses polling.** `liveChatMessages.list` is a polling API, so messages are de-duplicated by ID and the server honors returned polling intervals without going below the configured minimum.
6. **Membership is the closest API-level subscription signal.** YouTube live chat exposes `newSponsorEvent`; it is normalized as `subscriber` and documented as such.
7. **Theme font: bold `"Courier New", monospace`.** It meets the specified starting family while fitting the developer/cyberpunk aesthetic and avoids a network-loaded font in an OBS browser source.
8. **Assets are original procedural assets.** The visual sting and grid are authored SVG/CSS, and Web Audio API oscillators synthesize short notification tones; no third-party asset credits are required.
9. **No captured video.** Screen and webcam areas are visual placement slots only, because OBS composes real capture sources more reliably.
10. **No dotenv dependency.** The relay uses a tiny built-in `.env` parser before selecting its source, which keeps the runtime dependency surface minimal while honoring local credentials.
11. **Minimal toolchain.** Vue/Vite, TypeScript, `ws`, ESLint, and `tsx` are the only build/runtime tools; no state, UI, or animation framework is needed.
12. **Audio policy degrades gracefully.** Alert visuals still run when an OBS browser instance blocks Web Audio until its own autoplay policy allows it.
13. **No CREDITS.md.** This project uses no external assets; a credits file would imply third-party attributions where none exist.
14. **Demo and relay are exclusive.** Demo mode deliberately does not open a relay socket, preventing duplicated or colliding stream events.
15. **Loopback relay default.** The relay binds to `127.0.0.1` unless `HOST` is explicitly changed; a stream overlay should not expose its event endpoint on a network by accident.
16. **Defensive runtime contract.** All incoming browser and source events are checked against type-specific payload requirements, while source start/stop calls are safe to repeat.
17. **Finite relay configuration.** `PORT` and `MOCK_INTERVAL_MS` accept only bounded integers and fail at startup when explicitly malformed, avoiding invalid binds or runaway timers; YouTube polling keeps its existing clamping behavior because the upstream API can provide an advisory interval.
18. **Bounded shutdown and polling.** Relay shutdown gives WebSocket clients a brief close grace before termination, and each YouTube polling run owns an abort signal plus a generation token so restarts cannot revive an obsolete request.
19. **Frontend stream regression tests use Vitest.** A small client class isolates browser WebSocket lifecycle behavior from Vue, making invalid relay URLs, reconnection disposal, payload validation, and chat filtering directly testable in CI.
20. **YouTube cursor and timeout safety.** The relay sends each API `nextPageToken` on the next successful poll, clears an absent token, rejects malformed super chats, and aborts a stalled request after a bounded 15-second timeout before retrying.
