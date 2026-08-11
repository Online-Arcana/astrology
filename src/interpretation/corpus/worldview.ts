const technicalProperNames = [
  "part of spirit",
  "lot of spirit",
  "part of fortune",
  "lot of fortune",
] as const;

const shieldTechnicalProperNames = (value: string): string => technicalProperNames.reduce(
  (current, name) => current.replaceAll(new RegExp(`\\b${name.replaceAll(" ", "\\s+")}\\b`, "giu"), " technical-point "),
  value,
);

interface FindingRule {
  category: import("./types.js").WorldviewCategory;
  severity: import("./types.js").WorldviewSeverity;
  reason: string;
  patterns: readonly RegExp[];
}

const rules: readonly FindingRule[] = [
  {
    category: "religious_doctrine",
    severity: "reject",
    reason: "asserts or assumes religious doctrine",
    patterns: [
      /\b(?:heaven|hell|religious salvation|salvation from sin|original sin)\b/giu,
      /\b(?:angel|guardian angel|demon)s?\b/giu,
    ],
  },
  {
    category: "religious_agency",
    severity: "reject",
    reason: "assigns events or obligations to religious agency",
    patterns: [
      /\b(?:god|gods|a deity|the deity|a higher power)\s+(?:(?:has|have|had|is|are|was|were|will|would|can|could|may|might|should)\s+)?(?:wants?|wanted|wanting|asks?|asked|asking|gives?|gave|given|giving|sends?|sent|sending|places?|placed|placing|chooses?|chose|chosen|choosing|decides?|decided|deciding|intends?|intended|intending|guides?|guided|guiding|punishes?|punished|punishing|rewards?|rewarded|rewarding)\b/giu,
      /\b(?:god[- ]given|god's plan|divine punishment|divine reward)\b/giu,
    ],
  },
  {
    category: "divine_agency",
    severity: "reject",
    reason: "assigns purpose or causation to divine intention",
    patterns: [
      /\bdivin(?:e|ely)\s+(?:intended|ordained|guided|chosen|sent|placed|planned|purposed|meant)\b/giu,
      /\bdivine\s+(?:will|purpose|plan|intervention|calling|mission|lesson)\b/giu,
    ],
  },
  {
    category: "karma_or_reincarnation",
    severity: "reject",
    reason: "assumes karma, reincarnation or past-life causation",
    patterns: [
      /\bkarma\b|\bkarmic\b/giu,
      /\bpast[- ]l(?:ife|ives)\b/giu,
      /\breincarnat(?:e|ed|es|ion|ions)\b/giu,
      /\bincarnat(?:e|ed|es|ion|ions)\b/giu,
    ],
  },
  {
    category: "soul_assumption",
    severity: "reject",
    reason: "assumes a soul or soul-level obligation as fact",
    patterns: [
      /\b(?:your|their|the)\s+soul\b/giu,
      /\bsoul\s+(?:contract|purpose|mission|lesson|path|journey|choice|chose|chooses|agreement|agenda)s?\b/giu,
      /\bsoulmate\b|\bsoul mate\b/giu,
      /\bhigher self\b/giu,
    ],
  },
  {
    category: "fate_or_predestination",
    severity: "reject",
    reason: "states or implies predestination as a fact",
    patterns: [
      /\b(?:fated|destined|predestined)\b/giu,
      /\b(?:fate|destiny|predestination)\b/giu,
      /\bmeant\s+to\s+(?:be|happen|meet|occur|become|experience)\b/giu,
      /\bwas\s+always\s+going\s+to\b/giu,
    ],
  },
  {
    category: "supernatural_agency",
    severity: "reject",
    reason: "assumes supernatural intervention or causation",
    patterns: [
      /\bsupernatural\s+(?:agency|cause|causation|intervention|force|guidance)\b/giu,
      /\b(?:spirit guides?|guardian spirits?)\s+(?:(?:has|have|had|is|are|was|were|will|would|can|could|may|might|should)\s+)?(?:wants?|wanted|wanting|guides?|guided|guiding|sends?|sent|sending|places?|placed|placing|tells?|told|telling|asks?|asked|asking)\b/giu,
    ],
  },
  {
    category: "cosmic_intentionality",
    severity: "reject",
    reason: "assigns intention or a plan to the universe, cosmos or life",
    patterns: [
      /\b(?:the\s+)?(?:universe|cosmos|life)\s+(?:(?:has|have|had|is|are|was|were|will|would|can|could|may|might|should)\s+)?(?:wants?|wanted|wanting|asks?|asked|asking|tells?|told|telling|sends?|sent|sending|places?|placed|placing|guides?|guided|guiding|chooses?|chose|chosen|choosing|intends?|intended|intending|plans?|planned|planning|decides?|decided|deciding|teaches?|taught|teaching)\b/giu,
      /\b(?:cosmic|universal)\s+(?:plan|purpose|intention|lesson|mission|design)\b/giu,
    ],
  },
  {
    category: "spiritual_worldview",
    severity: "reject",
    reason: "imposes a spiritual worldview on the subject",
    patterns: [
      /\bspiritual\s+(?:destiny|obligation|mission|purpose|lesson|path|calling|development|evolution)\b/giu,
      /\bspiritually\s+(?:meant|called|guided|obliged|required)\s+to\b/giu,
      /\bsacred\s+(?:calling|mission|purpose|duty|path)\b/giu,
    ],
  },
  {
    category: "cosmic_intentionality",
    severity: "review",
    reason: "may imply an external purpose or directing agency without naming it",
    patterns: [
      /\b(?:person|relationship|encounter|experience|challenge|event|opportunity)\s+(?:entered|came|arrived|appeared)\s+(?:into\s+)?(?:your|their)\s+life\s+for\s+a\s+reason\b/giu,
      /\b(?:placed|put|sent)\s+(?:in|on)\s+(?:your|their)\s+path\b/giu,
      /\b(?:life|circumstances|events)\s+(?:brings?|sends?|places?)\s+.+\s+when\s+(?:you|they)\s+are\s+ready\b/giu,
      /\b(?:part|piece)\s+of\s+(?:a|the)\s+larger\s+(?:plan|design)\b/giu,
    ],
  },
];

const matchedFindings = (raw: string): import("./types.js").WorldviewFinding[] => {
  const value = shieldTechnicalProperNames(raw);
  const findings: import("./types.js").WorldviewFinding[] = [];
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      for (const match of value.matchAll(pattern)) {
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
  }
  return findings;
};

const dedupe = (findings: readonly import("./types.js").WorldviewFinding[]): import("./types.js").WorldviewFinding[] => {
  const seen = new Set<string>();
  const output: import("./types.js").WorldviewFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.category}:${finding.severity}:${finding.phrase.toLocaleLowerCase("en-GB")}:${finding.path ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
};

export const auditWorldviewText = (value: string): import("./types.js").WorldviewTextAudit => {
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

export const auditWorldviewObject = (value: unknown, path = "$"): import("./types.js").WorldviewTextAudit => {
  const findings: import("./types.js").WorldviewFinding[] = [];
  const visit = (current: unknown, currentPath: string, key: string | null): void => {
    // source references, policy prohibitions and composition identifiers are
    // private metadata. They may legitimately contain words that prose must not.
    if (key === "sourceRefs" || key === "forbiddenClaims" || key === "composition" || finalChartNonInterpretivePath(currentPath)) return;
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

const categoryPresent = (findings: readonly import("./types.js").WorldviewFinding[], category: import("./types.js").WorldviewCategory): boolean =>
  findings.some((finding) => finding.category === category);

export const auditSourceNeutrality = (passage: string): import("./types.js").SourceNeutralityAudit => {
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

export const worldviewFailureMessages = (audit: import("./types.js").WorldviewTextAudit): string[] => audit.findings.map((finding) => {
  const location = finding.path === undefined ? "interpretation" : finding.path;
  const prefix = finding.severity === "review" ? "requires worldview review" : "violates worldview neutrality";
  return `${location} ${prefix}: ${finding.reason} (${finding.phrase})`;
});

export const assertAgnosticText = (value: string, context: string): void => {
  const audit = auditWorldviewText(value);
  if (audit.safe && !audit.requiresReview) return;
  throw new Error(`${context} failed worldview-neutrality policy: ${worldviewFailureMessages(audit).join("; ")}`);
};
