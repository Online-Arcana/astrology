export type WorkKind = "local" | "big" | "small";

export interface WorkUnit {
  id: string;
  label: string;
  kind: WorkKind;
  weight: number;
}

const local = (id: string, label: string, weight = 1): WorkUnit => ({ id, label, kind: "local", weight });
const big = (id: string, label: string, weight = 5): WorkUnit => ({ id, label, kind: "big", weight });
const small = (id: string, label: string, weight = 2): WorkUnit => ({ id, label, kind: "small", weight });

export const baseWork = (): WorkUnit[] => [
  local("input", "Validating input"),
  local("place", "Resolving place"),
  local("time", "Resolving civil time", 2),
  local("astronomy", "Calculating astronomy", 4),
  local("tropical", "Deriving tropical chart", 3),
  local("sidereal", "Deriving sidereal chart", 3),
  local("compat-tropical", "Scoring tropical compatibility", 3),
  local("compat-sidereal", "Scoring sidereal compatibility", 3),
  big("tropical-core", "Interpreting tropical core"),
  big("sidereal-core", "Interpreting sidereal core"),
  ...(["overall", "romantic", "sexual", "emotional", "communication", "intellectual", "friendship", "business", "domestic", "long_term", "conflict_resolution", "spiritual"] as const)
    .flatMap((domain) => [
      big(`compat-tropical-${domain}`, `Interpreting tropical ${domain} compatibility`, 6),
      big(`compat-sidereal-${domain}`, `Interpreting sidereal ${domain} compatibility`, 6),
    ]),
  big("cross-system", "Reconciling zodiac systems", 4),
  big("final", "Writing final synthesis", 4),
  small("name", "Generating chart name"),
  local("audit", "Auditing interpretation", 4),
  local("assembly", "Assembling file"),
  local("crc", "Generating integrity block"),
  local("sign", "Signing authority"),
  local("validate", "Validating final file", 2),
];
