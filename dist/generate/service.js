import { BillCollector } from "astral-interpreter/web";
import { CalculationService, loadCalculationPorts, } from "../calculate/service.js";
import { assembleChart } from "astral-interpreter/web";
import { assembleAstralFile } from "../file/document.js";
import { legacyBirthInput, legacyGenerationRecoverySchema, migrateLegacyInterpretation, } from "./migration.js";
import { createOpenAISchemaClientFactory } from "astral-interpreter/web";
import { diagnosticHooks } from "astral-interpreter/web";
import { deterministicInterpretationPlan, nlpAuditProfile, promptCatalogue, runInterpretationPlan, structuredOutputCatalogue, } from "astral-interpreter/web";
import { buildSnapshot, snapshotText } from "astral-interpreter/web";
import { preferredGenderOf } from "../types/base.js";
export const generationRecoverySchema = "astral-generation-recovery/1.1.0";
const optionsFromConfig = (config) => ({
    primaryZodiac: config.chart.primaryZodiac,
    ayanamsha: config.chart.ayanamsha,
    interpretationMode: config.chart.interpretationMode,
});
const authority = (config, generatedAt) => {
    const signing = config.signing;
    if (!signing.enabled || signing.privateKey === null || signing.publicKey === null)
        return null;
    return {
        issuer: signing.issuer,
        keys: {
            privatePkcs8: signing.privateKey,
            publicRaw: signing.publicKey,
        },
        generatedAt,
    };
};
const baseDeveloperInstruction = [
    "Interpret only the requested astrology field.",
    "Never calculate placements, scores, ranks or availability.",
    "Never output reasoning, planning, preambles, disclaimers or process narration.",
    "Never combine multiple interpretation fields.",
    "Return only the requested strict JSON schema.",
].join("\n");
const grammaticalGenderInstruction = (gender) => {
    const neutral = "Prefer natural gender-neutral wording whenever it preserves meaning, especially in English. Never infer anatomy, sex at birth, social roles, interests or relationship roles from preferred gender.";
    switch (gender) {
        case "male": return `${neutral} Where the target language genuinely requires gender agreement or a personal pronoun, use masculine forms and masculine pronouns.`;
        case "female": return `${neutral} Where the target language genuinely requires gender agreement or a personal pronoun, use feminine forms and feminine pronouns.`;
        case "non-binary": return `${neutral} Use neutral pronouns and neutral grammatical forms where established. Otherwise rewrite the sentence naturally to avoid gendered pronouns or morphology rather than forcing an awkward form.`;
    }
};
const languageInstruction = (calculation) => {
    const ayanamsha = calculation.settings.siderealAyanamsha;
    return [
        `Write all interpretation text in ${calculation.subject.language}.`,
        "The subject is an adult.",
        grammaticalGenderInstruction(preferredGenderOf(calculation.subject)),
        "Astrology may be interpreted as symbolism, tendencies and patterns only.",
        "Do not add medical, legal, financial, safeguarding or crisis advice.",
        `Use only the selected ${calculation.system.zodiac} zodiac system.`,
        ayanamsha === null
            ? "Do not mention, compare or import sidereal placements or ayanamshas."
            : `Use only the ${ayanamsha} ayanamsha and never import another ayanamsha or tropical placement.`,
    ].join("\n");
};
const interpretationOrder = (calculation) => [
    ...calculation.interpretationPlan.units.map(({ id }) => id),
    ...(calculation.subject.providedName === null ? ["generated-name"] : []),
];
const expandedWave = (wave) => {
    if (wave === null || wave === undefined)
        return null;
    const phase = wave.assembled
        ? "assembled"
        : wave.lanes.every(({ status }) => status === "complete" || status === "blocked")
            ? "barrier"
            : "running";
    return {
        ...wave,
        lanes: wave.lanes.map((lane) => ({
            ...lane,
            assignments: [...lane.assignments],
            completed: [...lane.completed],
            position: lane.completed.length,
        })),
        staged: { ...wave.staged },
        conflicts: [...wave.conflicts],
        phase,
        stagedOrder: Object.keys(wave.staged),
    };
};
const authoritativeInterpretation = async (calculation, interpretation) => {
    const wave = expandedWave(interpretation.wave);
    const saved = interpretation.snapshot;
    if (saved === null || saved === undefined)
        return { ...interpretation, wave };
    const rebuilt = await buildSnapshot({ "astral-calculation": calculation }, interpretation.units, interpretationOrder(calculation), saved.revision);
    if (rebuilt.sha256 !== saved.sha256) {
        throw new Error("Generation recovery local snapshot does not match its accepted interpretation units");
    }
    if (saved.localSnapshot !== undefined) {
        let local;
        try {
            local = JSON.parse(saved.localSnapshot);
        }
        catch {
            throw new Error("Generation recovery local snapshot is not valid JSON");
        }
        if (typeof local !== "object"
            || local === null
            || local.sha256 !== saved.sha256) {
            throw new Error("Generation recovery local snapshot identity is invalid");
        }
    }
    return {
        ...interpretation,
        snapshot: {
            ...saved,
            remoteFileId: null,
            acceptedOrder: [...rebuilt.acceptedOrder],
            localSnapshot: snapshotText(rebuilt),
        },
        wave,
    };
};
const recoveryFor = async (version, calculation, interpretation, billing) => ({
    schema: generationRecoverySchema,
    version,
    calculationFingerprint: calculation.provenance.calculationFingerprint,
    calculation,
    interpretation: await authoritativeInterpretation(calculation, interpretation),
    billing,
});
const assertRecoveryBasis = (checkpoint, config) => {
    const settings = checkpoint.calculation.settings;
    if (settings.primaryZodiac !== config.chart.primaryZodiac || settings.interpretationMode !== config.chart.interpretationMode) {
        throw new Error("Generation recovery zodiac does not match the runtime chart configuration; create or resume the matching chart instead");
    }
    const expectedAyanamsha = settings.primaryZodiac === "sidereal" ? config.chart.ayanamsha : null;
    if (settings.siderealAyanamsha !== expectedAyanamsha) {
        throw new Error("Generation recovery ayanamsha does not match the runtime chart configuration; create or resume the matching chart instead");
    }
};
const memoizedSemanticProvider = (provider) => {
    const maps = new Map();
    return {
        mapFor: (calculation, unit) => {
            const existing = maps.get(unit.id);
            if (existing !== undefined)
                return existing;
            const map = provider.mapFor(calculation, unit);
            maps.set(unit.id, map);
            return map;
        },
    };
};
export class ChartGenerationService {
    #runtime;
    constructor(runtime) {
        this.#runtime = runtime;
    }
    async generate(birth, options = optionsFromConfig(this.#runtime.config), hooks = {}) {
        const calculation = await this.#runtime.calculation.calculate(birth, options);
        await hooks.onCalculation?.(calculation);
        return this.#complete(calculation, hooks, null, null);
    }
    async resume(checkpoint, hooks = {}) {
        if (checkpoint.schema === legacyGenerationRecoverySchema) {
            const calculation = await this.#runtime.calculation.calculate(legacyBirthInput(checkpoint), optionsFromConfig(this.#runtime.config));
            await hooks.onCalculation?.(calculation);
            const recovery = migrateLegacyInterpretation(checkpoint, calculation);
            return this.#complete(calculation, hooks, recovery, null);
        }
        if (checkpoint.schema !== generationRecoverySchema) {
            throw new Error("Generation recovery schema is unsupported");
        }
        if (checkpoint.version !== this.#runtime.version) {
            throw new Error(`Generation recovery version ${checkpoint.version} does not match runtime ${this.#runtime.version}`);
        }
        if (checkpoint.calculation.provenance.calculationFingerprint !== checkpoint.calculationFingerprint) {
            throw new Error("Generation recovery calculation fingerprint does not match its calculation");
        }
        assertRecoveryBasis(checkpoint, this.#runtime.config);
        await hooks.onCalculation?.(checkpoint.calculation);
        const recovery = await authoritativeInterpretation(checkpoint.calculation, checkpoint.interpretation);
        return this.#complete(checkpoint.calculation, hooks, recovery, checkpoint.billing ?? null);
    }
    async #complete(calculation, hooks, recovery, priorBill) {
        const collector = new BillCollector(calculation.provenance.calculationFingerprint, priorBill, () => this.#runtime.now());
        const report = (raw) => {
            const event = collector.add(raw);
            hooks.onUsage?.(event);
            hooks.onBill?.(collector.snapshot());
        };
        const { onCalculation: _onCalculation, onCheckpoint, onUsage: _onUsage, onBill: _onBill, ...runHooks } = hooks;
        const instrumented = diagnosticHooks({
            ...runHooks,
            ...(onCheckpoint === undefined
                ? {}
                : {
                    onCheckpoint: async (checkpoint) => onCheckpoint(await recoveryFor(this.#runtime.version, calculation, checkpoint, collector.snapshot())),
                }),
        }, () => this.#runtime.now());
        const configuredProvider = this.#runtime.semanticProvider ?? null;
        const semanticProvider = configuredProvider === null
            ? null
            : memoizedSemanticProvider(configuredProvider);
        try {
            let interpreted = await runInterpretationPlan(calculation, this.#runtime.config, this.#runtime.schemaFactory(calculation, report), instrumented, recovery, semanticProvider);
            const generatedAt = this.#runtime.now();
            const assemble = (candidate) => assembleChart(calculation, candidate.run, {
                generatedAt,
                bigModel: this.#runtime.config.openai.bigModel,
                smallModel: this.#runtime.config.openai.smallModel,
                structuredOutputSchema: structuredOutputCatalogue,
                promptCatalogue,
                astrologyCatalogue: calculation.provenance.astrologyProfile,
                nlpAuditProfile,
                ...(candidate.generatedName === null ? {} : { generatedName: candidate.generatedName }),
            });
            let chart;
            try {
                chart = assemble(interpreted);
            }
            catch (assemblyCause) {
                if (this.#runtime.config.chart.throwOnInterpretationFailure)
                    throw assemblyCause;
                // Preserve reviewed chart-specific meaning first.
                interpreted = deterministicInterpretationPlan(calculation, instrumented, assemblyCause, semanticProvider);
                try {
                    chart = assemble(interpreted);
                }
                catch (semanticFallbackCause) {
                    // Absolute customer-delivery floor: if map-backed deterministic
                    // prose cannot pass final assembly, use the schema-complete neutral
                    // generic catalogue with no semantic-provider dependency.
                    interpreted = deterministicInterpretationPlan(calculation, instrumented, semanticFallbackCause, null);
                    chart = assemble(interpreted);
                }
            }
            const file = await assembleAstralFile(calculation, chart, authority(this.#runtime.config, generatedAt));
            const bill = collector.finish("completed", generatedAt);
            hooks.onBill?.(bill);
            return { calculation, interpretation: interpreted.run, chart, file, bill };
        }
        catch (cause) {
            hooks.onBill?.(collector.finish("failed", this.#runtime.now()));
            throw cause;
        }
    }
}
export const loadChartGenerationService = async (config, version = "0.20.0", openai = {}, semanticProvider = null) => {
    if (config.openai.apiKey.trim().length === 0) {
        throw new Error("OPENAI_API_KEY is required for interpreted chart generation");
    }
    const ports = await loadCalculationPorts(version);
    const calculation = new CalculationService(ports);
    const schemaFactory = (value, onUsage) => createOpenAISchemaClientFactory({
        apiKey: config.openai.apiKey,
        instructions: `${baseDeveloperInstruction}\n\n${languageInstruction(value)}`,
        metadata: {
            service: "astral-charts",
            calculation_fingerprint: value.provenance.calculationFingerprint,
            astral_charts_version: version,
            zodiac: value.system.zodiac,
            ayanamsha: value.settings.siderealAyanamsha ?? "none",
            preferred_gender: preferredGenderOf(value.subject),
        },
        ...(config.chart.laneContextTokens === undefined
            ? {}
            : { contextTokenBudget: config.chart.laneContextTokens }),
        onUsage,
        ...openai,
    });
    return new ChartGenerationService({
        calculation,
        schemaFactory,
        config,
        version,
        ...(semanticProvider === null ? {} : { semanticProvider }),
        now: () => new Date().toISOString(),
    });
};
//# sourceMappingURL=service.js.map