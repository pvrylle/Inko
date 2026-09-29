import { base64Pcm16ToFloat, concatFloat32, floatToBase64Pcm16, resampleFloat32, rmsAmplitude } from "./audio-utils";

describe("voice audio utilities", () => {
  it("resamples browser audio to 24kHz", () => {
    const input = new Float32Array(480).fill(0.5);
    const output = resampleFloat32(input, 48_000);
    expect(output).toHaveLength(240);
    expect(output[100]).toBeCloseTo(0.5);
  });

  it("round-trips PCM16 audio", () => {
    const input = new Float32Array([-1, -0.5, 0, 0.5, 1]);
    const output = base64Pcm16ToFloat(floatToBase64Pcm16(input));
    expect([...output]).toEqual(expect.arrayContaining([expect.closeTo(-1, 2), expect.closeTo(0.5, 2)]));
  });

  it("calculates normalized amplitude", () => {
    expect(rmsAmplitude(new Float32Array(100).fill(0))).toBe(0);
    expect(rmsAmplitude(new Float32Array(100).fill(0.5))).toBeGreaterThan(0.9);
  });

  it("joins PCM clips without a gap", () => {
    const joined = concatFloat32([new Float32Array([1, 2]), new Float32Array([3, 4])]);
    expect([...joined]).toEqual([1, 2, 3, 4]);
  });
});
