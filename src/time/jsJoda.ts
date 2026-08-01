import type { CivilCandidate, CivilInput, CivilResolution, TimeResolver, TimeZoneInfo } from "./model.js";

export interface JodaOffset {
  totalSeconds(): number;
}

export interface JodaInstant {
  toString(): string;
}

export interface JodaLocalDateTime {
  toString(): string;
  toInstant(offset: JodaOffset): JodaInstant;
}

export interface JodaTransition {
  dateTimeBefore(): JodaLocalDateTime;
  dateTimeAfter(): JodaLocalDateTime;
  offsetBefore(): JodaOffset;
  offsetAfter(): JodaOffset;
}

export interface JodaRules {
  validOffsets(local: JodaLocalDateTime): JodaOffset[];
  transition(local: JodaLocalDateTime): JodaTransition | null;
  isDaylightSavings(instant: JodaInstant): boolean;
}

export interface JodaPort {
  localDateTime(iso: string): JodaLocalDateTime;
  rules(zone: string): JodaRules;
}

const candidate = (local: JodaLocalDateTime, offset: JodaOffset, rules: JodaRules, fold: 0 | 1 | null): CivilCandidate => {
  const instant = local.toInstant(offset);
  return {
    fold,
    utcIso: instant.toString(),
    offsetSeconds: offset.totalSeconds(),
    daylightSaving: rules.isDaylightSavings(instant),
  };
};

export class JsJodaResolver implements TimeResolver {
  readonly info: TimeZoneInfo;
  readonly #port: JodaPort;

  constructor(port: JodaPort, info: Omit<TimeZoneInfo, "provider">) {
    this.#port = port;
    this.info = { provider: "js-joda", ...info };
  }

  resolve(input: CivilInput): CivilResolution {
    const localIso = `${input.date}T${input.time}`;
    try {
      const local = this.#port.localDateTime(localIso);
      const rules = this.#port.rules(input.zone);
      const offsets = rules.validOffsets(local);
      if (offsets.length === 1) return { kind: "exact", localIso, candidate: candidate(local, offsets[0] as JodaOffset, rules, null) };
      if (offsets.length === 2) {
        const candidates: [CivilCandidate, CivilCandidate] = [
          candidate(local, offsets[0] as JodaOffset, rules, 0),
          candidate(local, offsets[1] as JodaOffset, rules, 1),
        ];
        if (input.fold !== undefined) return { kind: "exact", localIso, candidate: candidates[input.fold] };
        return { kind: "ambiguous", localIso, candidates };
      }
      const transition = rules.transition(local);
      if (!transition) return { kind: "unsupported", localIso, reason: "No offset or transition supplied by provider" };
      return {
        kind: "nonexistent",
        localIso,
        beforeUtcIso: transition.dateTimeBefore().toInstant(transition.offsetBefore()).toString(),
        afterUtcIso: transition.dateTimeAfter().toInstant(transition.offsetAfter()).toString(),
      };
    } catch (error) {
      return { kind: "unsupported", localIso, reason: error instanceof Error ? error.message : "Unknown time resolver failure" };
    }
  }
}
