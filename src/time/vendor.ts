import { JsJodaResolver, type JodaPort } from "./jsJoda.js";
import type { CivilInput, CivilResolution, TimeResolver } from "./model.js";
import { loadVendor } from "../vendor/load.js";
import { vendorRevisions } from "../vendor/revisions.js";

interface JsJodaCore {
  LocalDateTime: { parse(value: string): ReturnType<JodaPort["localDateTime"]> };
  ZoneId: { of(value: string): { rules(): ReturnType<JodaPort["rules"]> } };
}

class RangeResolver implements TimeResolver {
  readonly info;
  readonly #inner: TimeResolver;

  constructor(inner: TimeResolver) {
    this.#inner = inner;
    this.info = inner.info;
  }

  resolve(input: CivilInput): CivilResolution {
    const year = Number(input.date.slice(0, 4));
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      return {
        kind: "unsupported",
        localIso: `${input.date}T${input.time}`,
        reason: `Date is outside supported range ${this.info.supportedRange}`,
      };
    }
    return this.#inner.resolve(input);
  }
}

export const loadTimeResolver = async (): Promise<TimeResolver> => {
  const core = await loadVendor<JsJodaCore>("@js-joda/core");
  await loadVendor<unknown>("@js-joda/timezone");
  const port: JodaPort = {
    localDateTime: (iso) => core.LocalDateTime.parse(iso),
    rules: (zone) => core.ZoneId.of(zone).rules(),
  };
  return new RangeResolver(new JsJodaResolver(port, {
    providerVersion: vendorRevisions.time.timezoneVersion,
    dataVersion: vendorRevisions.time.timeZoneDatabaseVersion,
    supportedRange: vendorRevisions.time.supportedRange,
    calendar: "proleptic_gregorian",
  }));
};
