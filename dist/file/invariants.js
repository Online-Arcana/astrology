const signs = [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];
const rootKeys = ["schema", "astral-calculation", "astral-chart", "crc", "authority"];
export const generatedNamePattern = /^[\p{L}\p{N}]+-[\p{L}\p{N}]+-[\p{L}\p{N}]+$/u;
export const compatibilityValid = (domain) => {
    if (domain.ranked.length !== 12 || new Set(domain.ranked).size !== 12)
        return false;
    if (!signs.every((sign) => domain.ranked.includes(sign) && domain.signs[sign].sign === sign))
        return false;
    const ranks = signs.map((sign) => domain.signs[sign].rank).sort((a, b) => a - b);
    return ranks.every((rank, index) => rank === index + 1)
        && signs.every((sign) => domain.signs[sign].score >= 0 && domain.signs[sign].score <= 100);
};
export const rootShapeValid = (file) => {
    const keys = Object.keys(file);
    return keys.length === rootKeys.length
        && rootKeys.every((key) => Object.hasOwn(file, key))
        && file.schema === "astral/1.1.0";
};
//# sourceMappingURL=invariants.js.map