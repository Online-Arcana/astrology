import { readConfig as readInterpreterConfig } from "astral-interpreter/web";
const oneOf = (value, fallback, values, key) => {
    const selected = value ?? fallback;
    if (!values.includes(selected))
        throw new Error(`${key} has an unsupported value`);
    return selected;
};
const bool = (value, fallback, key) => {
    if (value === undefined || value === "")
        return fallback;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    throw new Error(`${key} must be true or false`);
};
export const readConfig = (env) => {
    const interpreter = readInterpreterConfig(env);
    const primaryZodiac = oneOf(env["ASTRAL_PRIMARY_ZODIAC"], "tropical", ["tropical", "sidereal"], "ASTRAL_PRIMARY_ZODIAC");
    if (env["ASTRAL_INTERPRETATION_MODE"] === "both")
        throw new Error("ASTRAL_INTERPRETATION_MODE=both is no longer supported; create separate tropical and sidereal charts");
    const interpretationMode = oneOf(env["ASTRAL_INTERPRETATION_MODE"], primaryZodiac, ["tropical", "sidereal"], "ASTRAL_INTERPRETATION_MODE");
    if (primaryZodiac !== interpretationMode)
        throw new Error("ASTRAL_PRIMARY_ZODIAC and ASTRAL_INTERPRETATION_MODE must select the same zodiac");
    const signingEnabled = bool(env["ASTRAL_SIGNING_ENABLED"], false, "ASTRAL_SIGNING_ENABLED");
    const privateKey = env["ASTRAL_ED25519_PRIVATE_KEY"] || null;
    const publicKey = env["ASTRAL_ED25519_PUBLIC_KEY"] || null;
    if (signingEnabled && (!privateKey || !publicKey))
        throw new Error("Signing requires both Ed25519 keys");
    return {
        ...interpreter,
        chart: {
            ...interpreter.chart,
            primaryZodiac,
            ayanamsha: oneOf(env["ASTRAL_SIDEREAL_AYANAMSHA"], "lahiri", ["lahiri", "fagan_bradley", "krishnamurti", "raman"], "ASTRAL_SIDEREAL_AYANAMSHA"),
            interpretationMode,
        },
        signing: {
            enabled: signingEnabled,
            issuer: env["ASTRAL_AUTHORITY_ISSUER"] ?? "kitty-crow/astral-charts",
            privateKey,
            publicKey,
        },
    };
};
//# sourceMappingURL=config.js.map