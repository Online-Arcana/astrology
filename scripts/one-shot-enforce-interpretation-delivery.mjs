import { readFile, writeFile } from "node:fs/promises";

const replaceRange = (text, startMarker, endMarker, replacement, file) => {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`${file}: missing start marker ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${file}: missing end marker ${endMarker}`);
  return text.slice(0, start) + replacement + text.slice(end);
};

{
  const file = "src/generate/service.ts";
  let text = await readFile(file, "utf8");
  text = text.replace("  interpretationCalls,\n  nlpAuditProfile,", "  nlpAuditProfile,");
  const preflight = `      // Preflight the complete corpus-backed call plan before opening a paid\n      // conversation. This validates and memoises every map that will later be\n      // shared by the writer and deterministic reconstruction.\n      if (semanticProvider !== null) interpretationCalls(calculation, semanticProvider);\n\n`;
  if (!text.includes(preflight)) throw new Error(`${file}: semantic preflight block not found`);
  text = text.replace(preflight, "");
  await writeFile(file, text);
}

{
  const file = "src/llm/orchestrate/plan.ts";
  let text = await readFile(file, "utf8");

  text = replaceRange(
    text,
    "const genericUnavailable =",
    "const fallbackCall =",
    "",
    file,
  );

  text = replaceRange(
    text,
    "const noSourceFallback =",
    "const semanticMapFor =",
    `const noSourceFallback = (unit: InterpretationUnit): UnitResult<object> =>\n  genericFallback(\n    unit,\n    [],\n    "No unambiguous deterministic source was available for this unit; generic interpretation supplied",\n  );\n\n`,
    file,
  );

  text = replaceRange(
    text,
    "const sourceAwareFallback =",
    "const substantiveCalls =",
    `const sourceAwareFallback = (\n  calculation: AstralCalculation,\n  unit: InterpretationUnit,\n  warning: string,\n  semanticProvider: InterpretationSemanticProvider | null = null,\n): UnitResult<object> => {\n  const refs = sourceRefsFor(calculation, unit);\n  if (refs.length === 0) return noSourceFallback(unit);\n  try {\n    const semanticMap = semanticMapFor(calculation, unit, semanticProvider);\n    return genericFallback(unit, refs, warning, semanticMap);\n  } catch (cause: unknown) {\n    const reason = cause instanceof Error ? cause.message : String(cause);\n    return genericFallback(\n      unit,\n      refs,\n      \`${warning}; semantic authority unavailable, generic interpretation supplied: \${reason}\`,\n    );\n  }\n};\n\n`,
    file,
  );

  await writeFile(file, text);
}

{
  const file = "test/semanticPlanFallback.ts";
  let text = await readFile(file, "utf8");
  const marker = `test("missing semantic authority cannot be swallowed by the production fallback catch", async () => {`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`${file}: old missing-authority test not found`);
  text = text.slice(0, start) + `test("missing semantic authority degrades to a generic deterministic interpretation", async () => {\n  const provider: InterpretationSemanticProvider = {\n    mapFor: () => {\n      throw new Error("semantic authority missing");\n    },\n  };\n\n  const result = await runInterpretationPlan(\n    calculation,\n    readConfig({}),\n    unavailableConversation,\n    {},\n    null,\n    provider,\n  );\n\n  const recovered = result.run.units[unitId];\n  assert.ok(recovered);\n  assert.equal(recovered.provenance?.repairedBy, "deterministic");\n  assert.equal(recovered.provenance?.repairKind, "xml_fallback");\n  const value = recovered.value as { status?: string; summary?: string; detail?: string };\n  assert.equal(value.status, "written");\n  assert.ok((value.summary ?? "").trim().length > 0);\n  assert.ok((value.detail ?? "").trim().length > 0);\n});\n\ntest("a unit with no usable deterministic source still receives generic written prose", async () => {\n  const noSourceCalculation = {\n    ...calculation,\n    interpretationPlan: {\n      ...calculation.interpretationPlan,\n      units: calculation.interpretationPlan.units.map((unit) => ({ ...unit, allowedSourceRefs: [] })),\n    },\n  } as AstralCalculation;\n\n  const result = await runInterpretationPlan(\n    noSourceCalculation,\n    readConfig({}),\n    unavailableConversation,\n  );\n\n  const recovered = result.run.units[unitId];\n  assert.ok(recovered);\n  const value = recovered.value as { status?: string; summary?: string; detail?: string; sourceRefs?: JsonRef[] };\n  assert.equal(value.status, "written");\n  assert.ok((value.summary ?? "").trim().length > 0);\n  assert.ok((value.detail ?? "").trim().length > 0);\n  assert.deepEqual(value.sourceRefs, []);\n});\n`;
  await writeFile(file, text);
}

{
  const file = "test/generationSemanticProvider.ts";
  let text = await readFile(file, "utf8");
  text = text.replace(
    `  equal(calls, 1, "semantic provider call count");\n  equal(schemaClients, 0, "semantic preflight must happen before a schema call");\n  equal(message, "semantic provider reached", "provider failure should remain fail-closed without debug mode");`,
    `  equal(calls >= 2, true, "semantic provider should be attempted before generic reconstruction");\n  equal(schemaClients, 0, "semantic failure must degrade before a paid schema call");\n  equal(message.includes("semantic provider reached"), false, "semantic provider failure must not escape the customer delivery path");`,
  );
  text = text.replace(
    `test("ChartGenerationService preflights an explicit semantic provider before paid generation", async () => {`,
    `test("ChartGenerationService does not expose semantic-provider failure to the customer path", async () => {`,
  );
  await writeFile(file, text);
}

{
  const file = "docs/interpretation-corpus.md";
  let text = await readFile(file, "utf8");
  const heading = "## Delivery invariant";
  if (!text.includes(heading)) {
    text += `\n\n${heading}\n\nInterpretation delivery is fail-soft in production. Corpus, semantic-map, model, audit, correction or reconstruction failures must not leave a requested interpretation empty and must not abort customer delivery. A corpus-backed field first falls back through deterministic semantic reconstruction; if semantic authority itself is unavailable, the engine uses the neutral generic fallback catalogue to produce a schema-complete written interpretation. Units with no usable deterministic source also receive generic written prose with no invented source references. Explicit debug mode may still throw so failures remain testable during development.\n`;
  }
  await writeFile(file, text);
}

console.log("Applied interpretation delivery invariant patch");
