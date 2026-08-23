<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { OverlayEvent } from "@miciodev/shared-types";
import { loadQuizState, resolveQuizStateUrl, type PublicQuizState } from "../composables/quiz-state";

type StateLoader = (signal: AbortSignal) => Promise<PublicQuizState>;

const props = defineProps<{ events: readonly OverlayEvent[]; stateLoader?: StateLoader }>();
const state = ref<PublicQuizState>();
const loadError = ref<string>();
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
let disposed = false;

function defaultStateLoader(signal: AbortSignal): Promise<PublicQuizState> {
  const relayUrl = import.meta.env.VITE_RELAY_URL ?? "ws://localhost:8787/events";
  return loadQuizState(resolveQuizStateUrl(relayUrl, import.meta.env.VITE_QUIZ_API_URL), signal);
}

async function refresh(): Promise<void> {
  controller?.abort();
  controller = new AbortController();
  const timeout = setTimeout(() => controller?.abort(), 4_000);
  try {
    const nextState = await (props.stateLoader ?? defaultStateLoader)(controller.signal);
    if (disposed) return;
    state.value = nextState;
    loadError.value = undefined;
    pollTimer = setTimeout(() => void refresh(), 1_000);
  } catch (error: unknown) {
    if (disposed) return;
    loadError.value = error instanceof Error && error.name === "AbortError" ? "Richiesta dello stato del quiz scaduta" : error instanceof Error ? error.message : "Impossibile caricare lo stato del quiz";
    retryTimer = setTimeout(() => void refresh(), 5_000);
  } finally {
    clearTimeout(timeout);
  }
}

onMounted(() => void refresh());
onBeforeUnmount(() => {
  disposed = true;
  controller?.abort();
  if (retryTimer) clearTimeout(retryTimer);
  if (pollTimer) clearTimeout(pollTimer);
});
</script>

<template>
  <section class="quiz-board" :class="state ? `phase-${state.phase}` : 'phase-loading'" aria-label="Python quiz board" aria-live="polite">
    <template v-if="state">
      <header class="quiz-header">
        <div><span class="eyebrow">ARENA PYTHON AUTOMATICA</span><strong>DOMANDA {{ state.questionNumber }} / {{ state.totalQuestions }}</strong></div>
        <span class="difficulty" :class="state.question.difficulty">{{ state.question.difficulty }}</span>
        <div class="timer"><span>⏱</span><strong>{{ state.remainingSeconds }}s</strong></div>
      </header>

      <template v-if="state.phase === 'question'">
        <div class="question-content">
          <p class="question-kicker">SCRIVI 1, 2, 3 O 4 IN CHAT</p>
          <h1>{{ state.question.prompt }}</h1>
          <ol class="answers">
            <li v-for="(option, index) in state.question.options" :key="option"><span>{{ index + 1 }}</span>{{ option }}</li>
          </ol>
        </div>
        <footer class="live-votes">
          <p><span class="signal"></span> RISPOSTE IN DIRETTA · {{ state.responses.reduce((total, response) => total + response.count, 0) }}</p>
          <div class="vote-grid">
            <div v-for="response in state.responses" :key="response.option" class="vote"><strong>{{ response.option }}</strong><span>{{ response.count }} voti</span><b>{{ response.percentage }}%</b></div>
          </div>
        </footer>
      </template>

      <template v-else-if="state.phase === 'results'">
        <div class="result-intro"><span>RISPOSTA SVELATA</span><h1>Risposta corretta: <b>{{ state.result?.correctOption }}</b> — {{ state.question.options[(state.result?.correctOption ?? 1) - 1] }}</h1></div>
        <div class="result-columns">
          <section><h2>RISULTATI DELLA DOMANDA</h2><div class="vote-grid"><div v-for="response in state.responses" :key="response.option" class="vote" :class="{ correct: response.option === state.result?.correctOption }"><strong>{{ response.option }}</strong><span>{{ response.count }} voti</span><b>{{ response.percentage }}%</b></div></div></section>
          <section class="ranking"><h2>CLASSIFICA</h2><p v-if="state.leaderboard.length === 0" class="empty">In attesa delle risposte in chat…</p><ol v-else><li v-for="player in state.leaderboard.slice(0, 6)" :key="player.author"><span>✓</span><strong>{{ player.author }}</strong><b>{{ player.correctAnswers }}/{{ player.answeredQuestions }} · {{ player.percentage }}%</b></li></ol></section>
        </div>
      </template>

      <template v-else>
        <div class="final-intro"><span>QUIZ COMPLETATO</span><h1>Classifica finale — Arena Python</h1><p>Il prossimo quiz parte automaticamente tra {{ state.remainingSeconds }}s</p></div>
        <ol class="final-ranking"><li v-for="(player, index) in state.leaderboard.slice(0, 8)" :key="player.author"><span>#{{ index + 1 }}</span><strong>{{ player.author }}</strong><b>{{ player.correctAnswers }}/{{ state.totalQuestions }}</b><em>{{ player.percentage }}%</em></li></ol>
        <p v-if="state.leaderboard.length === 0" class="empty">Nessuna risposta in questo turno. L'arena riparte automaticamente.</p>
      </template>
    </template>
    <div v-else class="quiz-fallback" role="status">
      <span>{{ loadError ? "DATI QUIZ NON DISPONIBILI" : "CARICAMENTO DATI QUIZ" }}</span>
      <h1>{{ loadError ? "In attesa del banco domande dal relay" : "Preparazione del prossimo turno dell'Arena Python" }}</h1>
      <p v-if="loadError">Nuovo tentativo automatico tra pochi secondi. {{ loadError }}</p>
    </div>
  </section>
</template>

<style scoped>
.quiz-board { position: relative; display: grid; grid-template-rows: auto 1fr auto; min-width: 0; min-height: 0; padding: clamp(1rem, 2.5vw, 2.5rem); overflow: hidden; color: var(--color-text); border: 1px solid var(--color-accent-deep); border-radius: var(--radius-md); background: linear-gradient(135deg, color-mix(in srgb, var(--color-surface) 92%, transparent), var(--color-background)); box-shadow: inset 0 0 4rem color-mix(in srgb, var(--color-accent) 8%, transparent), var(--glow-soft); }
.quiz-board::before { position: absolute; inset: 0; pointer-events: none; content: ''; background: radial-gradient(circle at 90% 10%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 30%), linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 9%, transparent) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--color-accent) 9%, transparent) 1px, transparent 1px); background-size: auto, 2rem 2rem, 2rem 2rem; opacity: .6; mask-image: linear-gradient(to bottom, black, transparent); }
.quiz-header, .question-content, .live-votes, .result-intro, .result-columns, .final-intro, .final-ranking, .empty, .quiz-fallback { position: relative; z-index: 1; }
.quiz-header { display: flex; justify-content: space-between; gap: var(--space-3); padding-bottom: var(--space-4); border-bottom: 1px solid var(--line-color); }
.quiz-header div { display: grid; gap: .25rem; }.eyebrow, .question-kicker, .result-intro > span, .final-intro > span { color: var(--color-accent); font-size: .72rem; font-weight: 800; letter-spacing: .16em; }.timer { justify-items: end; color: var(--color-accent); text-shadow: var(--glow-soft); }.timer strong { font-size: clamp(1.25rem, 2vw, 2rem); }
.difficulty { align-self: center; padding: var(--space-1) var(--space-3); border: 1px solid currentColor; border-radius: var(--radius-sm); font-size: .68rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
.difficulty.facile { color: var(--color-accent); }
.difficulty.medio { color: color-mix(in srgb, var(--color-accent) 40%, var(--color-danger) 60%); }
.difficulty.difficile { color: var(--color-danger); }
.question-content { align-self: center; max-width: 58rem; animation: enter .55s var(--easing-glitch); }.question-content h1, .result-intro h1, .final-intro h1 { margin: var(--space-3) 0 var(--space-5); font-size: clamp(1.4rem, 3vw, 3.2rem); line-height: 1.16; }
.answers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); padding: 0; list-style: none; }.answers li { display: flex; align-items: center; gap: var(--space-3); min-height: 4rem; padding: var(--space-3); border: 1px solid var(--line-color); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--color-surface) 78%, transparent); font-size: clamp(.9rem, 1.4vw, 1.25rem); }.answers span, .vote strong { display: grid; width: 2rem; aspect-ratio: 1; place-items: center; color: var(--color-background); border-radius: 50%; background: var(--color-accent); font-weight: 900; }
.live-votes { display: grid; gap: var(--space-2); }.live-votes p { margin: 0; color: var(--color-text-muted); font-size: .78rem; letter-spacing: .08em; }.signal { display: inline-block; width: .55rem; aspect-ratio: 1; margin-right: .35rem; border-radius: 50%; background: var(--color-accent); box-shadow: var(--glow-soft); animation: pulse 1.1s infinite; }
.vote-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }.vote { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-2); padding: var(--space-2); border: 1px solid var(--line-color); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--color-surface) 72%, transparent); }.vote span { color: var(--color-text-muted); font-size: .75rem; }.vote b { color: var(--color-accent); }.vote.correct { border-color: var(--color-accent); box-shadow: var(--glow-soft); }
.result-intro, .final-intro { align-self: center; animation: enter .45s var(--easing-glitch); }.result-intro b { color: var(--color-accent); }.result-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, .8fr); gap: var(--space-5); align-self: center; }.result-columns h2 { color: var(--color-text-muted); font-size: .75rem; letter-spacing: .13em; }.ranking ol, .final-ranking { display: grid; gap: var(--space-2); padding: 0; list-style: none; }.ranking li, .final-ranking li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--space-3); padding: var(--space-2); border-bottom: 1px solid var(--line-color); }.ranking li > span { color: var(--color-accent); }.ranking b { color: var(--color-text-muted); font-size: .75rem; }.final-ranking { align-self: center; max-width: 50rem; width: 100%; margin: auto; }.final-ranking li { grid-template-columns: 3rem 1fr auto auto; font-size: clamp(.9rem, 1.4vw, 1.2rem); }.final-ranking li > span, .final-ranking em { color: var(--color-accent); font-style: normal; }.empty { align-self: center; color: var(--color-text-muted); text-align: center; }
.quiz-fallback { display: grid; align-self: center; gap: var(--space-3); max-width: 46rem; margin: auto; text-align: center; animation: enter .45s var(--easing-glitch); }.quiz-fallback > span { color: var(--color-accent); font-size: .72rem; font-weight: 800; letter-spacing: .16em; }.quiz-fallback h1 { margin: 0; font-size: clamp(1.4rem, 3vw, 3.2rem); }.quiz-fallback p { margin: 0; color: var(--color-text-muted); }
@keyframes enter { from { opacity: 0; transform: translateY(1rem) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes pulse { 50% { opacity: .4; transform: scale(.75); } }
/* overflow-y:auto, not the desktop overflow:hidden: on a short mobile viewport the quiz board's
   own content (question + 4 answers + live-vote rows) can exceed the height its grid row actually
   gets, and hidden was clipping the last answer outright rather than letting it scroll into view. */
/* .live-votes hides below 850px on purpose: it's supplementary live-tally detail, not the actual
   prompt viewers need to answer in chat, and a live vertical/portrait canvas is often shorter
   relative to its width than this breakpoint accounts for — every row it frees up helps the
   webcam and chat rows below it actually get some height instead of being squeezed toward zero. */
@media (max-width: 850px) { .answers, .result-columns { grid-template-columns: 1fr; }.vote-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.quiz-board { padding: var(--space-3); overflow-y: auto; }.result-columns { gap: var(--space-3); }.answers li { min-height: 3rem; }.live-votes { display: none; } }
</style>
