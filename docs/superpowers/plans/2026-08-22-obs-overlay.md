# Implementation plan — OBS overlay

## Scope
- Build a pnpm workspace with Vue/Vite browser overlay, a ws relay, and a shared event contract.
- Keep the zero-credential demo route working: relay defaults to MockSource; browser has VITE_DEMO_MODE.

## Vertical slices
1. **Contract + mock relay:** write event shape and MockSource behavior test; add TypeScript package and WebSocket broadcast server.
2. **Overlay connection:** render incoming normalized events through reconnecting WebSocket and provide deterministic demo event generation.
3. **Visible streaming UX:** implement central theme, layout composition, alert queue/sting/sound, and persistent live chat feed.
4. **Delivery:** document choices and OBS setup, add CI/license/env templates, then run lint/typecheck/test/build.

## Commit checkpoints
- `chore: bootstrap pnpm overlay workspace`
- `feat(relay): broadcast normalized mock stream events`
- `feat(overlay): add themed OBS layouts and live event UI`
- `docs: document OBS setup and autonomous decisions`

## Verification
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root.
- Inspect the final git diff and validate relay-to-client protocol types.
