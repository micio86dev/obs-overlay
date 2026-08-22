# Code Review Rules

## TypeScript
- Use const/let, never var
- Prefer interfaces over types for object shapes
- No `any` types — use `unknown` and narrow, or proper generics
- Explicit return types on exported functions

## Vue 3
- `<script setup>` with Composition API only, no Options API
- Props/emits typed via `defineProps<T>()` / `defineEmits<T>()`
- No inline styles — use the CSS custom properties from theme.css
- Keep components focused: one clear responsibility per file

## Backend (Node/event-relay)
- No `any` in event payloads — use the shared event types
- Async/await, no raw `.then()` chains
- Never log or commit real credentials — `.env` only, `.env.example` for placeholders

## General
- No commented-out code left in commits
- No TODO without a linked reason/plan
- Prefer small, focused files over large multi-responsibility ones
