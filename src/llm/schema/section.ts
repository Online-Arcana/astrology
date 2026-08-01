import type { Section } from "../../types/chart.js";
import { list, nullableText, object, strictShape, text } from "./build.js";

export const sectionSchema = object({
  status: { type: "string", enum: ["written", "unavailable", "not_applicable"] },
  title: text(),
  summary: nullableText(),
  detail: nullableText(),
  themes: list(text()),
  strengths: list(text()),
  tensions: list(text()),
  sourceRefs: list(text()),
});

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

export const parseSection = (value: unknown): Section => {
  if (!record(value)) throw new TypeError("Section must be an object");
  const status = value["status"];
  if (status !== "written" && status !== "unavailable" && status !== "not_applicable") throw new TypeError("Invalid section status");
  if (typeof value["title"] !== "string") throw new TypeError("Section title is required");
  for (const key of ["summary", "detail"] as const) {
    if (value[key] !== null && typeof value[key] !== "string") throw new TypeError(`${key} must be text or null`);
  }
  for (const key of ["themes", "strengths", "tensions", "sourceRefs"] as const) {
    if (!strings(value[key])) throw new TypeError(`${key} must be a string array`);
  }
  return value as unknown as Section;
};

export const sectionShape = (name: string) => strictShape<Section>(name, sectionSchema, parseSection);
