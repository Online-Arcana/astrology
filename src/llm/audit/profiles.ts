import type { FieldProfile } from "./field.js";

export const fieldProfiles: Readonly<Record<string, FieldProfile>> = {
  sexuality: {
    id: "sexuality",
    lexicon: ["Mars", "Venus", "Pluto", "desire", "attraction", "libido", "intimacy", "pace", "initiation", "turn-on", "surrender", "control", "erotic", "fifth house", "eighth house"],
    minLength: 20,
  },
  career: {
    id: "career",
    lexicon: ["vocation", "work", "authority", "ambition", "achievement", "tenth house", "Midheaven", "Saturn", "Mars", "Jupiter", "career"],
    minLength: 20,
  },
  romance: {
    id: "romance",
    lexicon: ["affection", "attachment", "courtship", "partnership", "Venus", "Moon", "fifth house", "seventh house", "romance"],
    minLength: 20,
  },
  money: {
    id: "money",
    lexicon: ["money", "income", "earning", "spending", "security", "risk", "resources", "second house", "Saturn", "Venus"],
    minLength: 20,
  },
};
