export type ProgressStage = "validated" | "calculated" | "foundation" | "wave" | "synthesis" | "audited" | "assembled" | "complete" | "failed";
export interface ProgressEvent {
    stage: ProgressStage;
    complete: number;
    total: number;
    message: string;
    unitId?: string;
}
//# sourceMappingURL=progress.d.ts.map