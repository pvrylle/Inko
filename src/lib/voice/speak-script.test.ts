import { prepareAnnaSpeech } from "./speak-script";

describe("prepareAnnaSpeech", () => {
  it("strips markdown and citations so Anna reads prose", () => {
    expect(prepareAnnaSpeech("The **G1** checkpoint [1] stops the cell.")).toBe("The G 1 checkpoint stops the cell.");
  });

  it("turns a heading into a spoken sentence", () => {
    expect(prepareAnnaSpeech("## What is mitosis")).toBe("What is mitosis.");
  });

  it("does not speak citation chips or grouped source numbers", () => {
    expect(prepareAnnaSpeech(
      "climate change [1] , scientific history [3] , and the Clean Air Act [4] to make sure my answers are accurate.",
    )).toBe("climate change, scientific history, and the Clean Air Act to make sure my answers are accurate.");
    expect(prepareAnnaSpeech("impact our atmosphere [1, 4]. The reason I cite these sources is to ground our study.")).toBe(
      "impact our atmosphere. The reason I cite these sources is to ground our study.",
    );
    expect(prepareAnnaSpeech("source [4] helps explain how regulations address air pollution.")).toBe(
      "helps explain how regulations address air pollution.",
    );
  });
});
