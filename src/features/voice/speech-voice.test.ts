import { assignAnnaVoice, cuteCharacterVoice, pickAnnaVoice } from "./speech-voice";

describe("pickAnnaVoice", () => {
  it("selects Anna over other English voices", () => {
    const voices = [
      { name: "Microsoft David Desktop - English (United States)", lang: "en-US" },
      { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
      { name: "Microsoft Anna - English (United States)", lang: "en-US" },
    ];
    expect(pickAnnaVoice(voices)?.name).toBe("Microsoft Anna - English (United States)");
  });

  it("never falls back to a male Windows voice", () => {
    expect(pickAnnaVoice([
      { name: "Microsoft David Desktop - English (United States)", lang: "en-US" },
      { name: "Microsoft Mark - English (United States)", lang: "en-US" },
      { name: "Microsoft Zira Desktop - English (United States)", lang: "en-US", localService: true },
    ])?.name).toBe("Microsoft Zira Desktop - English (United States)");
  });

  it("tunes the chosen voice like a cute character", () => {
    const utterance = { lang: "", rate: 1, pitch: 1, volume: 1 } as SpeechSynthesisUtterance;
    assignAnnaVoice(utterance, [{ name: "Microsoft Anna", lang: "en-US", default: false, localService: true, voiceURI: "anna" } as SpeechSynthesisVoice]);
    expect(utterance.pitch).toBe(cuteCharacterVoice.pitch);
    expect(utterance.rate).toBe(cuteCharacterVoice.rate);
    expect(utterance.volume).toBe(cuteCharacterVoice.volume);
    expect(utterance.voice?.name).toBe("Microsoft Anna");
  });
});
