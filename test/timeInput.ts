import { resolveBirthTime } from "../src/time/calculate.js";
import type { TimeResolver } from "../src/time/model.js";
import type { BirthInput } from "../src/types/base.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let resolvedTime = "";
const resolver: TimeResolver = {
  info: {
    provider: "test",
    providerVersion: "1",
    dataVersion: "1",
    supportedRange: "1900/2100",
    calendar: "proleptic_gregorian",
  },
  resolve: ({ date, time }) => {
    resolvedTime = time;
    return {
      kind: "exact",
      localIso: `${date}T${time}`,
      candidate: {
        fold: null,
        utcIso: `${date}T${time}Z`,
        offsetSeconds: 0,
        daylightSaving: false,
      },
    };
  },
};

const astronomy = {
  time: () => ({ julianDay: 2440000.5, julianEphemerisDay: 2440000.5005, deltaTSeconds: 43.2 }),
};

const birth = (time: string): BirthInput => ({
  date: "1991-06-15",
  time,
  timeAccuracy: "exact",
  placeId: "fixture:place",
});

const result = resolveBirthTime(birth("12:30"), "Europe/London", resolver, astronomy);
equal(resolvedTime, "12:30:00", "minute-precision time is normalised for the resolver");
equal(result.localIso, "1991-06-15T12:30:00", "normalised local time");

let invalid = false;
try {
  resolveBirthTime(birth("24:00"), "Europe/London", resolver, astronomy);
} catch (cause) {
  invalid = cause instanceof Error && cause.message === "Birth time is invalid";
}
assert(invalid, "out-of-range times must remain invalid");

console.log("1..2");
console.log("ok 1 - minute-precision birth time is accepted");
console.log("ok 2 - invalid civil time is rejected");
