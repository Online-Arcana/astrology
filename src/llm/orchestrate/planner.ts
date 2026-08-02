import type { InterpretationCall, UnitResult } from "./types.js";

export interface LanePlan {
  id: string;
  units: InterpretationCall[];
  estimatedTokens: number;
}

const pending = (
  calls: readonly InterpretationCall[],
  accepted: Readonly<Record<string, UnitResult<object>>>,
): InterpretationCall[] => calls.filter(({ id }) => accepted[id] === undefined);

export const foundationPlan = (
  calls: readonly InterpretationCall[],
  accepted: Readonly<Record<string, UnitResult<object>>>,
  maximum = 10,
): InterpretationCall[] => {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error("Foundation maximum must be a positive integer");
  return pending(calls, accepted).slice(0, maximum);
};

const dependenciesMet = (
  call: InterpretationCall,
  accepted: ReadonlySet<string>,
  lane: readonly InterpretationCall[],
): boolean => {
  const local = new Set(lane.map(({ id }) => id));
  return (call.dependsOn ?? []).every((id) => accepted.has(id) || local.has(id));
};

const weight = (call: InterpretationCall): number => call.tokens ?? (call.kind === "big" ? 3_200 : 1_800);

export const wavePlan = (
  calls: readonly InterpretationCall[],
  acceptedUnits: Readonly<Record<string, UnitResult<object>>>,
  maximumLanes = 4,
  maximumPerLane = 10,
): LanePlan[] => {
  if (!Number.isSafeInteger(maximumLanes) || maximumLanes < 1 || maximumLanes > 4) {
    throw new Error("Wave lane count must be from 1 through 4");
  }
  if (!Number.isSafeInteger(maximumPerLane) || maximumPerLane < 1 || maximumPerLane > 10) {
    throw new Error("Lane batch size must be from 1 through 10");
  }

  const accepted = new Set(Object.keys(acceptedUnits));
  const remaining = pending(calls, acceptedUnits);
  const lanes: LanePlan[] = Array.from({ length: Math.min(maximumLanes, remaining.length) }, (_, index) => ({
    id: `lane-${index + 1}`,
    units: [],
    estimatedTokens: 0,
  }));

  let changed = true;
  while (changed) {
    changed = false;
    for (const call of remaining) {
      if (lanes.some((lane) => lane.units.some(({ id }) => id === call.id))) continue;
      const candidates = lanes
        .filter((lane) => lane.units.length < maximumPerLane && dependenciesMet(call, accepted, lane.units))
        .sort((left, right) => left.estimatedTokens - right.estimatedTokens || left.units.length - right.units.length);
      const lane = candidates[0];
      if (lane === undefined) continue;
      lane.units.push(call);
      lane.estimatedTokens += weight(call);
      changed = true;
      if (lanes.reduce((count, item) => count + item.units.length, 0) >= maximumLanes * maximumPerLane) break;
    }
  }

  return lanes.filter(({ units }) => units.length > 0);
};
