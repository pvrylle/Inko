"use client";

import type { MascotState } from "./mascot-state";
import { getMascotAtlas, type MascotCharacter } from "./sprite-manifest";
import { SpriteMascot } from "./sprite-mascot";
import { useMascot } from "./mascot-provider";

type InkoMascotProps = {
  state: MascotState;
  /** Kept for API compatibility with the previous SVG mascot; unused by sprites. */
  amplitude?: number;
  className?: string;
  /** Kept for API compatibility; unused by sprites. */
  eyeOpenness?: number;
  /** Kept for API compatibility; unused by sprites. */
  accessory?: "headphones";
  /** Override the user-selected companion. Defaults to MascotProvider character. */
  character?: MascotCharacter;
  /** contain for heroes; cover for compact chips. */
  fit?: "contain" | "cover";
};

const characterName: Record<MascotCharacter, string> = {
  octopus: "Inko",
  mrclaws: "Mr Claws",
};

/**
 * The animated mascot. Renders sprite-sheet animations for the selected
 * companion (Inko or Mr Claws) driven by MascotState.
 */
export function InkoMascot({
  state,
  className = "",
  character: characterProp,
  fit = "contain",
}: InkoMascotProps) {
  const { character: selected } = useMascot();
  const character = characterProp ?? selected;
  const isHappy = state.mood === "happy" || state.emotion === "happy";
  const isSleeping = state.presence === "sleeping";
  const atlas = getMascotAtlas(character, state);
  const aspect =
    atlas && atlas.frameHeight > 0 ? `${atlas.frameWidth} / ${atlas.frameHeight}` : undefined;

  return (
    <div
      className={`inko-mascot-wrap ${className}`}
      data-mode={state.mode}
      data-mood={state.mood}
      data-emotion={state.emotion}
      data-presence={state.presence}
      data-character={character}
      data-fit={fit}
      role="img"
      aria-label={`${characterName[character]} is ${state.presence}`}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {isHappy && (
        <div className="mascot-particles" aria-hidden="true">
          <span>✦</span><span>★</span><span>✦</span><span>•</span>
        </div>
      )}
      {isSleeping && (
        <div className="sleep-particles" aria-hidden="true">
          <span>Z</span><span>z</span><span>z</span>
        </div>
      )}
      <SpriteMascot atlas={atlas} className="inko-svg" fit={fit} />
    </div>
  );
}
