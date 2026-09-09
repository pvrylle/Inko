"use client";

import { motion } from "motion/react";
import type { MascotState } from "./mascot-state";

type InkoMascotProps = {
  state: MascotState;
  amplitude?: number;
  className?: string;
  /** Override eye scale (0–1). Ignored if undefined; lets focus mode dim eyes without changing global presence. */
  eyeOpenness?: number;
  /** Optional prop worn on the mascot. */
  accessory?: "headphones";
};

const bodyMotion = {
  idle: { y: [0, -7, 0], scale: [1, 1.018, 1], rotate: [-1, 1, -1] },
  listening: { y: 0, scale: 1.045, rotate: 0 },
  thinking: { y: [0, -2, 0], scale: 1, rotate: [-1, 0, -1] },
  speaking: { y: [0, -3, 0], scale: [1, 1.012, 1], rotate: 0 },
  sleeping: { y: 8, scale: 0.97, rotate: -3 },
  error: { x: [-3, 3, -2, 2, 0], scale: 0.98 },
};

export function InkoMascot({ state, amplitude = 0, className = "", eyeOpenness, accessory }: InkoMascotProps) {
  const isHappy = state.mood === "happy";
  const isSleeping = state.presence === "sleeping";
  const isThinking = state.presence === "thinking";
  const isListening = state.presence === "listening";
  const isSpeaking = state.presence === "speaking";
  const pupilX = isThinking ? 4 : 0;
  const pupilY = isThinking ? -4 : 0;
  const mouthScale = isSpeaking ? 0.8 + amplitude * 1.8 : 1;
  const eyeScale = eyeOpenness !== undefined ? eyeOpenness : isSleeping ? 0.1 : isListening ? 1.14 : 1;

  return (
    <div className={`inko-mascot-wrap ${className}`} data-mode={state.mode} data-mood={state.mood} data-presence={state.presence} role="img" aria-label={`Inko is ${state.presence}`}>
      {isHappy && <div className="mascot-particles" aria-hidden="true"><span>✦</span><span>★</span><span>✦</span><span>•</span></div>}
      {isSleeping && <div className="sleep-particles" aria-hidden="true"><span>Z</span><span>z</span><span>z</span></div>}
      <motion.svg
        animate={state.presence}
        className="inko-svg"
        initial="idle"
        transition={{ duration: state.presence === "idle" ? 3.6 : 0.34, ease: "easeInOut", repeat: state.presence === "idle" || isSpeaking || isThinking ? Infinity : 0 }}
        variants={bodyMotion}
        viewBox="0 0 320 330"
      >
        <defs>
          <linearGradient id="inkoBody" x1="58" x2="257" y1="48" y2="274" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF2F83" />
            <stop offset="0.56" stopColor="#FF4F65" />
            <stop offset="1" stopColor="#FF7A3D" />
          </linearGradient>
          <linearGradient id="inkoHighlight" x1="75" x2="185" y1="55" y2="225" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.34" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <filter id="inkoShadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="18" floodColor="#D82972" floodOpacity="0.24" stdDeviation="14" />
          </filter>
        </defs>

        <ellipse cx="160" cy="308" fill="#5A43C8" opacity="0.1" rx="94" ry="13" />

        <motion.g
          animate={isHappy ? { rotate: [0, -11, 10, -6, 0], y: [0, -10, 0] } : {}}
          style={{ transformOrigin: "160px 180px" }}
          transition={{ duration: 0.75, repeat: isHappy ? 2 : 0 }}
        >
          <motion.path d="M79 221C49 231 38 268 58 281C75 292 87 264 105 249" fill="none" stroke="url(#inkoBody)" strokeLinecap="round" strokeWidth="30" animate={isHappy ? { d: ["M79 221C49 231 38 268 58 281C75 292 87 264 105 249", "M82 218C48 205 34 178 50 166C69 152 82 194 108 225", "M79 221C49 231 38 268 58 281C75 292 87 264 105 249"] } : {}} transition={{ duration: 0.8, repeat: isHappy ? 2 : 0 }} />
          <path d="M106 237C83 257 77 298 101 306C123 313 125 271 137 248" fill="none" stroke="url(#inkoBody)" strokeLinecap="round" strokeWidth="31" />
          <motion.path d="M146 243C137 271 142 314 166 314C190 314 179 270 177 245" fill="none" stroke="url(#inkoBody)" strokeLinecap="round" strokeWidth="32" animate={isThinking ? { rotate: [0, 4, 0] } : {}} style={{ transformOrigin: "161px 245px" }} transition={{ duration: 0.55, repeat: isThinking ? Infinity : 0 }} />
          <path d="M187 242C194 273 203 309 227 301C250 293 228 259 213 235" fill="none" stroke="url(#inkoBody)" strokeLinecap="round" strokeWidth="31" />
          <motion.path d="M220 220C254 223 278 249 269 269C261 289 235 266 211 247" fill="none" stroke="url(#inkoBody)" strokeLinecap="round" strokeWidth="30" animate={isHappy ? { rotate: [0, 12, -8, 0] } : {}} style={{ transformOrigin: "218px 224px" }} transition={{ duration: 0.55, repeat: isHappy ? 3 : 0 }} />
          <path d="M231 196C268 184 292 198 289 217C285 239 254 228 220 223" fill="none" stroke="url(#inkoBody)" strokeLinecap="round" strokeWidth="28" />

          <path d="M160 39C169 19 190 20 197 34C205 51 187 60 176 50C167 42 178 31 187 39" fill="none" stroke="#FF3880" strokeLinecap="round" strokeWidth="12" />
          <motion.circle cx="192" cy="34" fill={isListening ? "#27D4C6" : "#FF8EAD"} opacity={isListening ? 0.95 : 0.6} r={isListening ? 9 : 5} animate={isListening ? { opacity: [0.4, 1, 0.4], r: [5, 10, 5] } : {}} transition={{ duration: 1.1, repeat: isListening ? Infinity : 0 }} />

          <path d="M160 45C103 45 66 87 68 157C69 221 105 258 161 259C218 260 254 222 253 157C252 88 217 45 160 45Z" fill="url(#inkoBody)" filter="url(#inkoShadow)" />
          <path d="M115 58C86 75 76 111 79 156C81 196 96 218 116 232C94 195 96 91 137 52C129 53 122 55 115 58Z" fill="url(#inkoHighlight)" />

          <motion.g animate={{ scaleY: eyeScale }} style={{ transformOrigin: "160px 132px" }}>
            <ellipse cx="122" cy="132" fill="white" rx="27" ry="31" />
            <ellipse cx="199" cy="132" fill="white" rx="27" ry="31" />
            <ellipse cx={122 + pupilX} cy={134 + pupilY} fill="#151A4B" rx="12" ry="15" />
            <ellipse cx={199 + pupilX} cy={134 + pupilY} fill="#151A4B" rx="12" ry="15" />
            <circle cx={118 + pupilX} cy={129 + pupilY} fill="white" r="4" />
            <circle cx={195 + pupilX} cy={129 + pupilY} fill="white" r="4" />
          </motion.g>

          <motion.ellipse cx="94" cy="178" fill="#FFB0C6" opacity="0.72" rx="18" ry="9" animate={isSpeaking ? { opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.1, 0.9] } : {}} transition={{ duration: 0.45, repeat: isSpeaking ? Infinity : 0 }} />
          <motion.ellipse cx="227" cy="178" fill="#FFB0C6" opacity="0.72" rx="18" ry="9" animate={isSpeaking ? { opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.1, 0.9] } : {}} transition={{ duration: 0.45, repeat: isSpeaking ? Infinity : 0 }} />

          {isHappy ? (
            <path d="M137 183C144 208 178 208 186 183" fill="#8C2358" stroke="#151A4B" strokeLinecap="round" strokeWidth="5" />
          ) : isSleeping ? (
            <path d="M149 195H174" fill="none" stroke="#151A4B" strokeLinecap="round" strokeWidth="5" />
          ) : (
            <motion.ellipse cx="161" cy="191" fill="#8C2358" rx="14" ry="9" stroke="#151A4B" strokeWidth="4" animate={{ scaleY: mouthScale }} style={{ transformOrigin: "161px 191px" }} transition={{ duration: 0.08 }} />
          )}

          {accessory === "headphones" && (
            <motion.g
              animate={{ opacity: 1, y: 0, scale: 1 }}
              initial={{ opacity: 0, y: -8, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }}
            >
              <path d="M 66 106 Q 160 58 254 106" fill="none" stroke="#151A4B" strokeLinecap="round" strokeWidth="10" />
              <path d="M 66 106 Q 160 62 254 106" fill="none" stroke="#7357F6" strokeLinecap="round" strokeWidth="4" />
              <ellipse cx="66" cy="140" fill="#151A4B" rx="14" ry="21" />
              <ellipse cx="66" cy="140" fill="#7357F6" rx="8" ry="14" />
              <ellipse cx="63" cy="132" fill="white" opacity="0.55" rx="3" ry="4" />
              <ellipse cx="254" cy="140" fill="#151A4B" rx="14" ry="21" />
              <ellipse cx="254" cy="140" fill="#7357F6" rx="8" ry="14" />
              <ellipse cx="251" cy="132" fill="white" opacity="0.55" rx="3" ry="4" />
            </motion.g>
          )}
        </motion.g>
      </motion.svg>
    </div>
  );
}
