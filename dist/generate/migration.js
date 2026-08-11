export const legacyGenerationRecoverySchema = "astral-generation-recovery/1.0.0";
const integer = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const migrateString = (value, zodiac) => value
    .replaceAll(`#/astral-calculation/systems/${zodiac}/`, "#/astral-calculation/system/")
    .replaceAll(`#/astral-calculation/compatibility/${zodiac}/`, "#/astral-calculation/compatibility/");
const migrateValue = (value, zodiac) => {
    if (typeof value === "string")
        return migrateString(value, zodiac);
    if (Array.isArray(value))
        return value.map((item) => migrateValue(item, zodiac));
    if (value === null || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, migrateValue(child, zodiac)]));
};
const migrateResult = (result, version, zodiac) => ({
    ...result,
    value: migrateValue(result.value, zodiac),
    provenance: {
        ...(result.provenance ?? {}),
        migratedFromVersion: version,
    },
});
const migrateActive = (active, allowed, completed) => {
    if (active === null || !allowed.has(active.id) || completed.has(active.id))
        return null;
    return {
        id: active.id,
        attempt: Number.isSafeInteger(active.attempt) && active.attempt >= 1 ? active.attempt : 1,
        correction: active.correction.filter((value) => typeof value === "string"),
        ...(active.failureKind === undefined ? {} : { failureKind: active.failureKind }),
    };
};
export const legacyBirthInput = (checkpoint) => {
    if (checkpoint.calculation.provenance.calculationFingerprint !== checkpoint.calculationFingerprint) {
        throw new Error("Legacy generation recovery calculation fingerprint does not match its calculation");
    }
    const calculation = checkpoint.calculation;
    return {
        date: calculation.birth.date,
        time: calculation.birth.time,
        timeAccuracy: calculation.birth.timeAccuracy,
        placeId: calculation.place.id,
        ...(calculation.subject.providedName === null ? {} : { name: calculation.subject.providedName }),
        ...(calculation.subject.language.length === 0 ? {} : { lang: calculation.subject.language }),
    };
};
export const migrateLegacyInterpretation = (checkpoint, calculation) => {
    const allowed = new Set([
        ...calculation.interpretationPlan.units.map(({ id }) => id),
        ...(calculation.subject.providedName === null ? ["generated-name"] : []),
    ]);
    const units = {};
    for (const [id, result] of Object.entries(checkpoint.interpretation.units)) {
        if (!allowed.has(id))
            continue;
        units[id] = migrateResult(result, checkpoint.version, calculation.system.zodiac);
    }
    const completed = new Set(Object.keys(units));
    const active = migrateActive(checkpoint.interpretation.active, allowed, completed);
    const conversationId = checkpoint.interpretation.conversationId
        ?? (completed.size === 0 ? null : `migrated-${checkpoint.calculationFingerprint.slice(-24)}`);
    return {
        conversationId,
        units,
        calls: integer(checkpoint.interpretation.calls),
        retries: integer(checkpoint.interpretation.retries),
        active,
        orchestration: "waves",
        foundationComplete: true,
        snapshot: null,
        wave: null,
    };
};
//# sourceMappingURL=migration.js.map