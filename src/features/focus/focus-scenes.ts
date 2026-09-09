export type FocusScene = {
  id: "aurora" | "ocean" | "forest" | "ember";
  label: string;
  description: string;
  gradient: string;
  accent: string;
};

export const focusScenes: FocusScene[] = [
  {
    id: "aurora",
    label: "Aurora",
    description: "Soft violet drift for deep-thinking work.",
    gradient: "linear-gradient(160deg, #eeeaff 0%, #d9dcff 55%, #c8f6ef 100%)",
    accent: "#7357f6",
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Cool blues for calm, steady progress.",
    gradient: "linear-gradient(155deg, #e2f5ff 0%, #cfe9ff 45%, #d9e2ff 100%)",
    accent: "#27a8d4",
  },
  {
    id: "forest",
    label: "Forest",
    description: "Green light for reading and writing.",
    gradient: "linear-gradient(160deg, #e5fbf8 0%, #d1f5e6 50%, #fdf8e3 100%)",
    accent: "#27d4c6",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm coral to spark a fresh burst.",
    gradient: "linear-gradient(160deg, #fff0f3 0%, #ffe1dd 50%, #fff5ea 100%)",
    accent: "#ff4f6b",
  },
];

export const defaultSceneId: FocusScene["id"] = "aurora";
