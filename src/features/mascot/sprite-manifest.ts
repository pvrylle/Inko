// Runtime access to the generated mascot sprite atlases + state-aware animation
// routing for both characters. The atlases are produced by
// `scripts/build-mascot-sprites.mjs` (npm run build:mascots) from all verified
// mascot sprite exports. Inko (octopus) and MR Claws are selectable companions;
// clips follow presence, tool labels, and emotion (AI-ready).

import type { MascotState } from "./mascot-state";
import manifestJson from "../../../public/mascots/generated/manifest.json";

export type SpriteAtlas = {
  key: string;
  url: string;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  count: number;
  fps: number;
};

export type MascotCharacter = "octopus" | "mrclaws";

type Manifest = {
  fps: number;
  characters: Record<MascotCharacter, Record<string, SpriteAtlas>>;
};

const manifest = manifestJson as Manifest;

const LOGO_URL: Record<MascotCharacter, string> = {
  octopus: "/mascots/generated/octopus/logo.webp",
  mrclaws: "/mascots/generated/mrclaws/logo.webp",
};

export function getMascotLogoUrl(character: MascotCharacter): string {
  return LOGO_URL[character];
}

function isHappy(state: MascotState): boolean {
  return state.mood === "happy" || state.emotion === "happy";
}

function inkoAnimation(state: MascotState): string {
  const message = state.message.toLowerCase();
  switch (state.presence) {
    case "idle":
      return isHappy(state) ? "happy" : "idle-state";
    case "listening":
      return "ideal-state";
    case "thinking":
      return "thinking";
    case "speaking":
      return /debate|contradict|challenge|compare/.test(message)
        ? "talking-debate"
        : "conversation-loop";
    case "sleeping":
      return state.mode === "focus" ? "sleeping-keme" : "ideal-sleeping-state";
    case "working":
      if (/read|book/.test(message)) return "reading";
      return "inko-pdf";
    case "researching":
      return /compare|evidence|contradict/.test(message)
        ? "research-pdf-standalone"
        : "research-pdf";
    case "error":
    default:
      return "idle-state";
  }
}

function mrClawsAnimation(state: MascotState): string {
  const message = state.message.toLowerCase();
  switch (state.presence) {
    case "listening":
      return "listening-yuh";
    case "speaking":
      return /debate|contradict|challenge/.test(message) ? "talking-debate" : "talking";
    case "working":
      if (/compare|result/.test(message)) return "compare-results";
      if (/check|detail/.test(message)) return "checking-details";
      if (/verify|pdf|document/.test(message)) return "paper-verification";
      return "research-paper";
    case "researching":
      return /paper|source/.test(message) ? "research-paper" : "research";
    case "thinking":
    case "sleeping":
    case "error":
    case "idle":
    default:
      return isHappy(state) ? "talking" : "question";
  }
}

/** Resolve the most appropriate clip for the complete mascot state. */
export function getMascotAtlas(character: MascotCharacter, state: MascotState): SpriteAtlas | null {
  const clips = manifest.characters[character];
  if (!clips) return null;
  const key = character === "octopus" ? inkoAnimation(state) : mrClawsAnimation(state);
  const fallback = character === "octopus" ? "idle-state" : "question";
  return clips[key] ?? clips[fallback] ?? Object.values(clips)[0] ?? null;
}

/** All atlas URLs for a character — handy for preloading. */
export function getCharacterAtlases(character: MascotCharacter): SpriteAtlas[] {
  return Object.values(manifest.characters[character] ?? {});
}
