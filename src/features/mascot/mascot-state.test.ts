import { initialMascotState, mascotReducer } from "./mascot-state";

describe("mascotReducer", () => {
  it("moves through the voice conversation states", () => {
    const listening = mascotReducer(initialMascotState, { type: "USER_STARTED" });
    const thinking = mascotReducer(listening, { type: "USER_STOPPED" });
    const speaking = mascotReducer(thinking, { type: "AGENT_AUDIO" });
    const idle = mascotReducer(speaking, { type: "REPLY_DONE" });

    expect(listening.presence).toBe("listening");
    expect(thinking.presence).toBe("thinking");
    expect(speaking.presence).toBe("speaking");
    expect(idle.presence).toBe("idle");
  });

  it("keeps focus mode while presence changes", () => {
    const focus = mascotReducer(initialMascotState, { type: "SET_MODE", mode: "focus" });
    const listening = mascotReducer(focus, { type: "USER_STARTED" });
    expect(listening.mode).toBe("focus");
    expect(listening.presence).toBe("listening");
  });

  it("only sleeps from idle and wakes on interaction", () => {
    const listening = mascotReducer(initialMascotState, { type: "USER_STARTED" });
    expect(mascotReducer(listening, { type: "SLEEP" }).presence).toBe("listening");
    const sleeping = mascotReducer(initialMascotState, { type: "SLEEP" });
    expect(mascotReducer(sleeping, { type: "WAKE" }).presence).toBe("idle");
  });
});
