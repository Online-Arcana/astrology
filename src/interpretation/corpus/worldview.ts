import type {
  SourceNeutralityAudit,
  WorldviewCategory,
  WorldviewFinding,
  WorldviewTextAudit,
} from "./types.js";

interface Rule {
  category: WorldviewCategory;
  severity: "reject" | "review";
  pattern: RegExp;
  reason: string;
}

const technicalAllowances: readonly RegExp[] = [
  /\bPart of Spirit\b/giu,
  /\bLot of Spirit\b/giu,
  /\bParte del Espíritu\b/giu,
  /\bLote del Espíritu\b/giu,
];

const shieldTechnicalNames = (value: string): string => {
  let output = value;
  technicalAllowances.forEach((pattern, index) => {
    output = output.replace(pattern, ` TECHNICAL_ASTROLOGICAL_NAME_${index} `);
  });
  return output;
};

const rules: readonly Rule[] = [
  {
    category: "religious_agency",
    severity: "reject",
    pattern: /\b(?:god|gods|a deity|the deity)\s+(?:wants?|asks?|is asking|commands?|is commanding|(?:has |had )?(?:placed|sent|given|guided|chosen)|gave|gives|punishes?|rewards?|guides?|is guiding|chose|chooses)\b/giu,
    reason: "a religious being is given causal or directive agency in the user's life",
  },
  {
    category: "religious_agency",
    severity: "reject",
    pattern: /\b(?:dios|los dioses|una deidad|la deidad)\s+(?:quiere|pide|est[aá] pidiendo|ordena|est[aá] ordenando|(?:ha |hab[ií]a )?(?:colocado|puesto|enviado|dado|guiado|elegido)|coloc[oó]|puso|envi[oó]|dio|da|castiga|premia|gu[ií]a|est[aá] guiando|eligi[oó]|elige)\b/giu,
    reason: "a religious being is given causal or directive agency in the user's life",
  },
  {
    category: "religious_doctrine",
    severity: "reject",
    pattern: /\b(?:god|gods|goddess|deity|prayer|providence|salvation|heaven|hell|angel|angels|demon|demons)\b/giu,
    reason: "religious doctrine or being is asserted in interpretation prose",
  },
  {
    category: "religious_doctrine",
    severity: "reject",
    pattern: /\b(?:dios|dioses|diosa|deidad|oraci[oó]n|providencia|salvaci[oó]n|cielo|infierno|[aá]ngel(?:es)?|demonio(?:s)?)\b/giu,
    reason: "religious doctrine or being is asserted in interpretation prose",
  },
  {
    category: "divine_agency",
    severity: "reject",
    pattern: /\b(?:divine|divinely|god[- ]given|divine intervention|divine purpose|divine plan|divine lesson)\b/giu,
    reason: "divine agency or purpose is assumed",
  },
  {
    category: "divine_agency",
    severity: "reject",
    pattern: /\b(?:divin[oa]s?|intervenci[oó]n divina|prop[oó]sito divino|plan divino|lecci[oó]n divina)\b/giu,
    reason: "divine agency or purpose is assumed",
  },
  {
    category: "karma_or_reincarnation",
    severity: "reject",
    pattern: /\b(?:karma|karmic|karmically|karmic debt|past lives?|reincarnat(?:e|ed|es|ion|ion's|ing)|previous incarnation)\b/giu,
    reason: "karma, reincarnation or past-life metaphysics is assumed",
  },
  {
    category: "karma_or_reincarnation",
    severity: "reject",
    pattern: /\b(?:karma|k[aá]rmic[oa]s?|deuda k[aá]rmica|vidas? pasadas?|reencarnaci[oó]n|encarnaci[oó]n anterior)\b/giu,
    reason: "karma, reincarnation or past-life metaphysics is assumed",
  },
  {
    category: "soul_assumption",
    severity: "reject",
    pattern: /\b(?:your soul|the soul|soul contracts?|soul purpose|soul lessons?|soul journey|soul chose|soulmate(?:s)?|higher self)\b/giu,
    reason: "a soul-based metaphysical model is asserted as fact",
  },
  {
    category: "soul_assumption",
    severity: "reject",
    pattern: /\b(?:tu alma|su alma|el alma|contratos? del alma|prop[oó]sito del alma|lecciones? del alma|viaje del alma|alma gemela|yo superior)\b/giu,
    reason: "a soul-based metaphysical model is asserted as fact",
  },
  {
    category: "fate_or_predestination",
    severity: "reject",
    pattern: /\b(?:fate|fated|destiny|destined|predestination|predestined|meant to be|written in the stars)\b/giu,
    reason: "fate or predestination is asserted",
  },
  {
    category: "fate_or_predestination",
    severity: "reject",
    pattern: /\b(?:destino|destinad[oa]s?|predestinaci[oó]n|predestinad[oa]s?|escrito en las estrellas|estaba destinado)\b/giu,
    reason: "fate or predestination is asserted",
  },
  {
    category: "supernatural_agency",
    severity: "reject",
    pattern: /\b(?:supernatural|spirit guides?|guardian angels?|higher power|otherworldly intervention|your spirit chose)\b/giu,
    reason: "supernatural agency is asserted",
  },
  {
    category: "supernatural_agency",
    severity: "reject",
    pattern: /\b(?:sobrenatural|gu[ií]as? espirituales?|[aá]ngeles? guardianes?|poder superior|intervenci[oó]n sobrenatural)\b/giu,
    reason: "supernatural agency is asserted",
  },
  {
    category: "cosmic_intentionality",
    severity: "reject",
    pattern: /\b(?:the universe|the cosmos|cosmic forces?|life)\s+(?:wants?|intends?|needs you to|is telling|is teaching|is guiding|(?:has |had )?(?:sent|placed|guided|chosen|given)|sends?|places?|guides?|chose|chooses|gave|gives)\b/giu,
    reason: "the universe, cosmos or life is given human-like intention or agency",
  },
  {
    category: "cosmic_intentionality",
    severity: "reject",
    pattern: /\b(?:el universo|el cosmos|fuerzas c[oó]smicas|la vida)\s+(?:quiere|pretende|te dice|te ense[ñn]a|te env[ií]a|est[aá] guiando|(?:ha |hab[ií]a )?(?:enviado|colocado|puesto|guiado|elegido|dado)|env[ií]a|coloca|puso|gu[ií]a|eligi[oó]|te da)\b/giu,
    reason: "the universe, cosmos or life is given human-like intention or agency",
  },
  {
    category: "spiritual_worldview",
    severity: "reject",
    pattern: /\b(?:spiritual destiny|spiritual lesson|spiritual obligation|spiritual mission|spiritually meant to|spiritually required|sacred calling|sacred mission|cosmic purpose|cosmic plan|cosmic lesson)\b/giu,
    reason: "a spiritual or cosmic worldview is imposed as the explanation",
  },
  {
    category: "spiritual_worldview",
    severity: "reject",
    pattern: /\b(?:destino espiritual|lecci[oó]n espiritual|obligaci[oó]n espiritual|misi[oó]n espiritual|espiritualmente destinad[oa]|espiritualmente obligad[oa]|llamado sagrado|misi[oó]n sagrada|prop[oó]sito c[oó]smico|plan c[oó]smico)\b/giu,
    reason: "a spiritual or cosmic worldview is imposed as the explanation",
  },
  {
    category: "cosmic_intentionality",
    severity: "review",
    pattern: /\b(?:entered|came into|appeared in) your life for (?:a|some) reason\b/giu,
    reason: "the phrase may imply externally assigned purpose without naming an agent",
  },
  {
    category: "cosmic_intentionality",
    severity: "review",
    pattern: /\b(?:placed|put|sent) (?:in|on) your path\b/giu,
    reason: "the phrase may imply an unnamed external directing agency",
  },
  {
    category: "fate_or_predestination",
    severity: "review",
    pattern: /\b(?:was supposed to happen|had to happen|was always going to happen|inevitable encounter)\b/giu,
    reason: "the phrase may imply inevitability or predestination",
  },
  {
    category: "cosmic_intentionality",
    severity: "review",
    pattern: /\b(?:larger|greater|bigger) (?:cosmic )?plan\b/giu,
    reason: "the phrase may imply a purposeful external plan",
  },
  {
    category: "cosmic_intentionality",
    severity: "review",
    pattern: /\b(?:lleg[oó]|entr[oó]|apareci[oó]) en tu vida por (?:una|alguna) raz[oó]n\b/giu,
    reason: "the phrase may imply externally assigned purpose without naming an agent",
  },
  {
    category: "fate_or_predestination",
    severity: "review",
    pattern: /\b(?:ten[ií]a que pasar|deb[ií]a pasar|era inevitable)\b/giu,
    reason: "the phrase may imply inevitability or predestination",
  },
];

const matchedFindings = (raw: string): WorldviewFinding[] => {
  const value = shieldTechnicalNames(raw);
  const findings: WorldviewFinding[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of value.matchAll(rule.pattern)) {
      const phrase = match[0]?.trim();
      if (!phrase) continue;
      findings.push({
        category: rule.category,
        severity: rule.severity,
        phrase,
        reason: rule.reason,
      });
    }
  }
  return findings;
};

const dedupe = (findings: readonly WorldviewFinding[]): WorldviewFinding[] => {
  const seen = new Set<string>();
  const output: WorldviewFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.category}:${finding.severity}:${finding.phrase.toLocaleLowerCase("en-GB")}:${finding.path ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
};

export const auditWorldviewText = (value: string): WorldviewTextAudit => {
  const findings = dedupe(matchedFindings(value));
  return {
    safe: !findings.some(({ severity }) => severity === "reject"),
    requiresReview: findings.some(({ severity }) => severity === "review"),
    findings,
  };
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finalChartNonInterpretivePath = (path: string): boolean =>
  path === "astral-chart.subject"
  || path.startsWith("astral-chart.subject.")
  || path === "astral-chart.provenance"
  || path.startsWith("astral-chart.provenance.");

export const auditWorldviewObject = (value: unknown, path = "$"): WorldviewTextAudit => {
  const findings: WorldviewFinding[] = [];
  const visit = (current: unknown, currentPath: string, key: string | null): void => {
    if (key === "sourceRefs" || key === "forbiddenClaims" || finalChartNonInterpretivePath(currentPath)) return;
    if (typeof current === "string") {
      findings.push(...matchedFindings(current).map((finding) => ({ ...finding, path: currentPath })));
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`, null));
      return;
    }
    if (!record(current)) return;
    Object.entries(current).forEach(([childKey, child]) => visit(child, `${currentPath}.${childKey}`, childKey));
  };
  visit(value, path, null);
  const unique = dedupe(findings);
  return {
    safe: !unique.some(({ severity }) => severity === "reject"),
    requiresReview: unique.some(({ severity }) => severity === "review"),
    findings: unique,
  };
};

const categoryPresent = (findings: readonly WorldviewFinding[], category: WorldviewCategory): boolean =>
  findings.some((finding) => finding.category === category);

export const auditSourceNeutrality = (passage: string): SourceNeutralityAudit => {
  const audit = auditWorldviewText(passage);
  return {
    religiousDoctrine: categoryPresent(audit.findings, "religious_doctrine"),
    religiousAgency: categoryPresent(audit.findings, "religious_agency"),
    divineAgency: categoryPresent(audit.findings, "divine_agency"),
    karmaOrReincarnation: categoryPresent(audit.findings, "karma_or_reincarnation"),
    soulAssumption: categoryPresent(audit.findings, "soul_assumption"),
    fateOrPredestination: categoryPresent(audit.findings, "fate_or_predestination"),
    supernaturalAgency: categoryPresent(audit.findings, "supernatural_agency"),
    cosmicIntentionality: categoryPresent(audit.findings, "cosmic_intentionality"),
    assumesSpiritualWorldview: categoryPresent(audit.findings, "spiritual_worldview"),
    safeForAgnosticCorpus: audit.safe && !audit.requiresReview,
    requiresReview: audit.requiresReview,
    confidence: audit.findings.length === 0 ? 1 : audit.requiresReview && audit.safe ? 0.55 : 0.99,
    findings: audit.findings,
  };
};

export const worldviewFailureMessages = (audit: WorldviewTextAudit): string[] => audit.findings.map((finding) => {
  const location = finding.path === undefined ? "interpretation" : finding.path;
  const prefix = finding.severity === "review" ? "requires worldview review" : "violates worldview neutrality";
  return `${location} ${prefix}: ${finding.reason} (${finding.phrase})`;
});

export const assertAgnosticText = (value: string, context: string): void => {
  const audit = auditWorldviewText(value);
  if (audit.safe && !audit.requiresReview) return;
  throw new Error(`${context} failed worldview-neutrality policy: ${worldviewFailureMessages(audit).join("; ")}`);
};