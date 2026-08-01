import type { AstralChart, AstralCalculation, AstralCrc, AstralFile } from "../types/index.js";
import { canonicalBytes } from "./canonical.js";
import { crc32c } from "./crc32c.js";
import { digest } from "./hash.js";

export interface AstralCore {
  schema: "astral/1.0.0";
  "astral-calculation": AstralCalculation;
  "astral-chart": AstralChart;
}

export const core = (calculation: AstralCalculation, chart: AstralChart): AstralCore => ({
  schema: "astral/1.0.0",
  "astral-calculation": calculation,
  "astral-chart": chart,
});

export const crcFor = async (value: AstralCore): Promise<AstralCrc> => {
  const bytes = canonicalBytes(value);
  const [sha256, sha512] = await Promise.all([digest("SHA-256", bytes), digest("SHA-512", bytes)]);
  return {
    schema: "astral-crc/1.0.0",
    canonicalisation: "RFC8785",
    encoding: "utf-8",
    scope: ["schema", "astral-calculation", "astral-chart"],
    byteLength: bytes.byteLength,
    sha256,
    sha512,
    crc32c: crc32c(bytes),
  };
};

export const assembleUnsigned = async (calculation: AstralCalculation, chart: AstralChart): Promise<AstralFile> => {
  const value = core(calculation, chart);
  return { ...value, crc: await crcFor(value), authority: null };
};

export const integrityValid = async (file: AstralFile): Promise<boolean> => {
  const expected = await crcFor(core(file["astral-calculation"], file["astral-chart"]));
  return expected.byteLength === file.crc.byteLength
    && expected.sha256 === file.crc.sha256
    && expected.sha512 === file.crc.sha512
    && expected.crc32c === file.crc.crc32c;
};
