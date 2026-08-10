import type { CorpusAtom, CorpusClaim, CorpusSource } from "../types.js";

const neutral = {
  religious: false,
  spiritual: false,
  karmic: false,
  fatalistic: false,
  supernatural: false,
} as const;

export const eclipseSources: readonly CorpusSource[] = [
  {
    id: "semantic.astrodienst.eclipse-context",
    title: "Eclipse - Astrodienst Astrowiki",
    author: null,
    publisher: "Astrodienst",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: ["modern-trigger-context", "solar-new-moon-node", "lunar-full-moon-node"],
    notes: [
      "Reviewed public source: https://www.astro.com/astrowiki/en/Eclipses",
      "Approved for the modern-astrology statement that eclipses are used as contextual activators of contacted chart factors and for the Sun-Moon-node geometry distinguishing solar and lunar eclipses.",
      "Traditional omens, malefic judgement, event prediction, breakthrough/conclusion claims and claims about eclipse power are excluded.",
    ],
  },
  {
    id: "semantic.zodisphere.prenatal-eclipse-definition",
    title: "Prenatal Eclipse - Astrology Definition",
    author: null,
    publisher: "Zodisphere",
    editionOrDate: null,
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: ["sensitive-degree-definition"],
    notes: [
      "Reviewed public source: https://zodisphere.com/glossary/prenatal-eclipse",
      "Approved only for the modern-practice definition of a prenatal eclipse as a sensitised chart degree associated with an eclipse before birth.",
      "No predictive activation claim is imported into the production corpus.",
    ],
  },
  {
    id: "semantic.augurine.prenatal-eclipse-context",
    title: "Prenatal Eclipse Calculator: The Eclipse Before Birth",
    author: null,
    publisher: "Augurine",
    editionOrDate: "2026-06-19",
    role: "semantic",
    reviewStatus: "approved",
    allowedSections: ["read-in-context-not-verdict"],
    notes: [
      "Reviewed public source: https://www.augurine.com/tools/prenatal-eclipse-calculator",
      "Approval is limited to the guidance that a prenatal eclipse is read in context with sign, house, node and the rest of the chart and is not a verdict or prediction.",
      "Universal-destiny, forward/backward-pull, spiritual, karmic and other source material discussed elsewhere on the page is excluded.",
    ],
  },
] as const;

export const eclipseClaims: readonly CorpusClaim[] = [
  {
    id: "derived.eclipses-at-birth.core.context",
    atomId: "derived.eclipses-at-birth",
    category: "core",
    proposition: "An eclipse coinciding with birth can be treated as additional context around the natal Sun-Moon-node configuration and any chart factors closely connected with the eclipse degree.",
    tags: ["eclipse at birth", "natal context", "Sun-Moon-node configuration", "contacted chart factors"],
    sourceRefs: ["semantic.astrodienst.eclipse-context#modern-trigger-context"],
    neutrality: neutral,
    confidence: "school-specific",
  },
  {
    id: "derived.eclipses-at-birth.detail.types",
    atomId: "derived.eclipses-at-birth",
    category: "interaction",
    proposition: "A solar eclipse is a New-Moon conjunction near the lunar nodal axis, while a lunar eclipse is a Full-Moon opposition near that axis; the type is calculation evidence rather than a prediction of what must happen to the person.",
    tags: ["solar eclipse", "lunar eclipse", "New Moon", "Full Moon", "nodal axis"],
    sourceRefs: [
      "semantic.astrodienst.eclipse-context#solar-new-moon-node",
      "semantic.astrodienst.eclipse-context#lunar-full-moon-node",
    ],
    neutrality: neutral,
    confidence: "core",
  },
  {
    id: "derived.eclipses-prenatal-solar.core.context",
    atomId: "derived.eclipses-prenatal-solar",
    category: "core",
    proposition: "The prenatal solar eclipse is retained as a sensitised solar-eclipse degree from before birth and is read only in context with its sign, house, node, aspects and the rest of the natal chart.",
    tags: ["prenatal solar eclipse", "sensitive degree", "chart context", "sign", "house", "node", "aspects"],
    sourceRefs: [
      "semantic.zodisphere.prenatal-eclipse-definition#sensitive-degree-definition",
      "semantic.augurine.prenatal-eclipse-context#read-in-context-not-verdict",
    ],
    neutrality: neutral,
    confidence: "school-specific",
  },
  {
    id: "derived.eclipses-prenatal-lunar.core.context",
    atomId: "derived.eclipses-prenatal-lunar",
    category: "core",
    proposition: "The prenatal lunar eclipse is retained as a sensitised lunar-eclipse degree from before birth and is read only in context with its sign, house, node, aspects and the rest of the natal chart.",
    tags: ["prenatal lunar eclipse", "sensitive degree", "chart context", "sign", "house", "node", "aspects"],
    sourceRefs: [
      "semantic.zodisphere.prenatal-eclipse-definition#sensitive-degree-definition",
      "semantic.augurine.prenatal-eclipse-context#read-in-context-not-verdict",
    ],
    neutrality: neutral,
    confidence: "school-specific",
  },
] as const;

const claimsFor = (atomId: string): string[] =>
  eclipseClaims.filter((claim) => claim.atomId === atomId).map((claim) => claim.id);

const forbidden = [
  "fate", "destiny", "predestination", "karmic path", "karmic debt", "past lives", "reincarnation",
  "a soul agreement", "soul purpose", "dharma", "spiritual journey", "cosmic plan", "divine intervention",
  "events that must happen", "a guaranteed crisis", "a guaranteed beginning or ending", "medical outcomes",
] as const;

export const eclipseAtoms: readonly CorpusAtom[] = [
  {
    id: "derived.eclipses-at-birth",
    kind: "derived-construct",
    displayName: "Eclipse at birth",
    plainEnglish: "eclipse context within the natal Sun-Moon-node configuration",
    aliases: ["Eclipse at birth", "Natal eclipse"],
    internalIds: ["eclipsesAtBirth"],
    claimIds: claimsFor("derived.eclipses-at-birth"),
    doNotInfer: [...forbidden, "an omen", "a malefic influence"],
    relatedAtomIds: ["body.sun", "body.moon", "point.north-node", "point.south-node", "derived.lunar-phase"],
    sourceIds: ["semantic.astrodienst.eclipse-context"],
    reviewStatus: "approved",
  },
  {
    id: "derived.eclipses-prenatal-solar",
    kind: "derived-construct",
    displayName: "Prenatal solar eclipse",
    plainEnglish: "a pre-birth solar-eclipse degree used as contextual chart evidence",
    aliases: ["Prenatal solar eclipse"],
    internalIds: ["prenatalSolar"],
    claimIds: claimsFor("derived.eclipses-prenatal-solar"),
    doNotInfer: [...forbidden, "universal destiny", "a quality the soul came to develop"],
    relatedAtomIds: ["derived.eclipses-at-birth", "body.sun", "body.moon"],
    sourceIds: ["semantic.zodisphere.prenatal-eclipse-definition", "semantic.augurine.prenatal-eclipse-context"],
    reviewStatus: "approved",
  },
  {
    id: "derived.eclipses-prenatal-lunar",
    kind: "derived-construct",
    displayName: "Prenatal lunar eclipse",
    plainEnglish: "a pre-birth lunar-eclipse degree used as contextual chart evidence",
    aliases: ["Prenatal lunar eclipse"],
    internalIds: ["prenatalLunar"],
    claimIds: claimsFor("derived.eclipses-prenatal-lunar"),
    doNotInfer: [...forbidden, "a lesson the soul needs to learn", "dual destiny"],
    relatedAtomIds: ["derived.eclipses-at-birth", "body.sun", "body.moon"],
    sourceIds: ["semantic.zodisphere.prenatal-eclipse-definition", "semantic.augurine.prenatal-eclipse-context"],
    reviewStatus: "approved",
  },
] as const;
