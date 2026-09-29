export const cuteCharacterVoice = { rate: 1.04, pitch: 1.18, volume: 1 };

const maleVoiceName = /\b(david|mark|james|george|ryan|guy|ravi|richard|thomas|daniel|steffan|andrew|brian|christopher|eric|tony|paul|charles|michael|john|fred|albert|gordon|male)\b/i;
const femaleVoiceName = /\b(anna|zira|hazel|aria|jenny|samantha|susan|eva|michelle|linda|helen|catherine|sonia|libby|moira|tessa|fiona|karen|victoria|allison|ava|emma|female)\b/i;

export function pickAnnaVoice<T extends { name: string; lang: string; localService?: boolean }>(voices: T[]) {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const female = english.filter((voice) => !maleVoiceName.test(voice.name));
  return female.find((voice) => /\banna\b/i.test(voice.name))
    ?? female.find((voice) => voice.localService && femaleVoiceName.test(voice.name))
    ?? female.find((voice) => femaleVoiceName.test(voice.name))
    ?? female[0]
    ?? null;
}

export function assignAnnaVoice(utterance: SpeechSynthesisUtterance, voices: SpeechSynthesisVoice[]) {
  const voice = pickAnnaVoice(voices);
  utterance.lang = voice?.lang || "en-US";
  if (voice) utterance.voice = voice;
  utterance.volume = cuteCharacterVoice.volume;
  utterance.rate = cuteCharacterVoice.rate;
  utterance.pitch = cuteCharacterVoice.pitch;
}
