import type { BirthInput } from "../types/base.js";
import type { AstralCalculation } from "../types/file.js";
import type { InterpretationRecovery } from "astral-interpreter/web";
export declare const legacyGenerationRecoverySchema: "astral-generation-recovery/1.0.0";
interface LegacyCalculation {
    schema: "astral-calculation/1.0.0";
    subject: {
        providedName: string | null;
        language: string;
    };
    birth: {
        date: string;
        time: string | null;
        timeAccuracy: BirthInput["timeAccuracy"];
    };
    place: {
        id: string;
    };
    provenance: {
        calculationFingerprint: string;
    };
}
export interface LegacyGenerationCheckpoint {
    schema: typeof legacyGenerationRecoverySchema;
    version: string;
    calculationFingerprint: string;
    calculation: LegacyCalculation;
    interpretation: InterpretationRecovery;
}
export declare const legacyBirthInput: (checkpoint: LegacyGenerationCheckpoint) => BirthInput;
export declare const migrateLegacyInterpretation: (checkpoint: LegacyGenerationCheckpoint, calculation: AstralCalculation) => InterpretationRecovery;
export {};
//# sourceMappingURL=migration.d.ts.map