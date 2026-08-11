import { canonicalBytes } from "./canonical.js";
import { crc32c } from "./crc32c.js";
import { digest } from "./hash.js";
export const core = (calculation, chart) => ({
    schema: "astral/1.1.0",
    "astral-calculation": calculation,
    "astral-chart": chart,
});
export const crcFor = async (value) => {
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
export const assembleUnsigned = async (calculation, chart) => {
    const value = core(calculation, chart);
    return { ...value, crc: await crcFor(value), authority: null };
};
export const integrityValid = async (file) => {
    const expected = await crcFor(core(file["astral-calculation"], file["astral-chart"]));
    return expected.byteLength === file.crc.byteLength
        && expected.sha256 === file.crc.sha256
        && expected.sha512 === file.crc.sha512
        && expected.crc32c === file.crc.crc32c;
};
//# sourceMappingURL=integrity.js.map