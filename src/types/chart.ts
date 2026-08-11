import type { JsonRef } from "./base.js";
import type {
  CompatibilityDomain,
  HouseMap,
  PointMap,
  Sign,
  SignMap,
  Zodiac,
} from "./astro.js";

export interface Section {
  status: "written" | "unavailable" | "not_applicable";
  title: string;
  summary: string | null;
  detail: string | null;
  themes: string[];
  strengths: string[];
  tensions: string[];
  sourceRefs: JsonRef[];
}

export interface RomanticInterpretation extends Section {
  affectionStyle: string | null;
  courtshipStyle: string | null;
  attachmentNeeds: string | null;
  preferredPartnerQualities: string[];
  relationshipStrengths: string[];
  relationshipDifficulties: string[];
  commitmentPattern: string | null;
}

export interface SexualInterpretation extends Section {
  desireStyle: string | null;
  libidoPattern: string | null;
  initiationStyle: string | null;
  preferredPace: string | null;
  physicalAffection: string | null;
  likelyTurnOns: string[];
  likelyTurnOffs: string[];
  experimentationStyle: string | null;
  emotionalSexConnection: string | null;
  controlAndSurrender: string | null;
  powerDynamics: string | null;
  exclusivityPattern: string | null;
  sexualCommunication: string | null;
  likelyFrustrations: string[];
}

export interface CareerInterpretation extends Section {
  vocationalThemes: string[];
  suitableFields: string[];
  preferredWorkEnvironment: string | null;
  leadershipStyle: string | null;
  authorityRelationship: string | null;
  ambitionPattern: string | null;
  publicReputation: string | null;
  careerStrengths: string[];
  careerRisks: string[];
}

export interface MoneyInterpretation extends Section {
  earningStyle: string | null;
  spendingStyle: string | null;
  securityNeeds: string | null;
  riskTolerance: string | null;
  materialStrengths: string[];
  financialBlindSpots: string[];
}

export interface LifeInterpretation {
  identityAndPurpose: Section;
  emotionalNature: Section;
  mindAndCommunication: Section;
  romance: RomanticInterpretation;
  sexuality: SexualInterpretation;
  committedPartnerships: Section;
  homeAndFamily: Section;
  childhoodPatterns: Section;
  creativityAndSelfExpression: Section;
  childrenAndNurturing: Section;
  friendship: Section;
  communityAndGroups: Section;
  workStyle: Section;
  careerAndVocation: CareerInterpretation;
  businessAndLeadership: Section;
  moneyAndMaterialSecurity: MoneyInterpretation;
  publicLifeAndAmbition: Section;
  conflictAndAssertion: Section;
  growthAndOpportunity: Section;
  restrictionsAndResponsibility: Section;
  transformationAndCrisis: Section;
  spiritualityAndMeaning: Section;
  unconsciousPatterns: Section;
  wellbeingAndDailyRhythm: Section;
  developmentalDirection: Section;
}

export interface AspectInterpretation {
  id: string;
  section: Section;
}

export interface PatternInterpretation {
  id: string;
  section: Section;
}

export interface SystemInterpretation {
  zodiac: Zodiac;
  overview: Section;
  bigThree: {
    sun: Section;
    moon: Section;
    ascendant: Section;
  };
  points: PointMap<Section>;
  houses: HouseMap<Section>;
  aspects: AspectInterpretation[];
  patterns: PatternInterpretation[];
  lunar: {
    phase: Section;
    nodes: Section;
    lilith: Section;
  };
  eclipses: {
    atBirth: Section;
    prenatalSolar: Section;
    prenatalLunar: Section;
  };
  rulershipAndDignity: Section;
  chartBalance: Section;
  dominantThemes: Section;
  life: LifeInterpretation;
  synthesis: {
    centralThemes: string[];
    contradictions: string[];
    gifts: string[];
    growthEdges: string[];
    narrative: string;
    sourceRefs: JsonRef[];
  };
}

export interface SignCompatibilityInterpretation {
  sign: Sign;
  summary: string;
  dynamic: string;
  strengths: string[];
  tensions: string[];
  attraction: string | null;
  sustainability: string | null;
  bestExpression: string;
  sourceRefs: JsonRef[];
}

export interface CompatibilityDomainInterpretation {
  domain: CompatibilityDomain;
  overview: string;
  sourceRefs: JsonRef[];
  signs: SignMap<SignCompatibilityInterpretation>;
}

export interface CompatibilityInterpretation {
  zodiac: Zodiac;
  method: "natal_to_sign_archetype";
  domains: Record<CompatibilityDomain, CompatibilityDomainInterpretation>;
}

export interface CrossSystemInterpretation {
  sharedThemes: string[];
  tropicalEmphasis: string[];
  siderealEmphasis: string[];
  apparentContradictions: string[];
  reconciliations: string[];
  synthesis: string;
  sourceRefs: JsonRef[];
}

export interface FinalSynthesis {
  essence: string;
  definingThemes: string[];
  strongestAssets: string[];
  recurringTensions: string[];
  relationshipPattern: string;
  sexualPattern: string;
  friendshipPattern: string;
  vocationalPattern: string;
  moneyPattern: string;
  developmentalArc: string;
  closingPortrait: string;
  sourceRefs: JsonRef[];
}

export interface FinalSubject {
  name: {
    value: string;
    source: "provided" | "generated";
    sourceRefs: JsonRef[];
  };
}

export interface LlmPhaseProvenance {
  id: string;
  schema: string;
  model: string;
  attempts: number;
}

export interface TestArtifactProvenance {
  schema: "astral-test-artifact/1.0.0";
  purpose: "chart-ui-testing";
  warning: "TEST_ONLY_NOT_FOR_PRODUCTION";
  interpretation: "lorem_ipsum_no_llm";
  signingMode: "test_key" | "existing_key";
  signingKeyId: string;
  nonce: string;
}

export interface ChartProvenance {
  generatedAt: string;
  bigModel: string;
  smallModel: string;
  structuredOutputSchema: string;
  promptCatalogue: string;
  astrologyCatalogue: string;
  nlpAuditProfile: string;
  interpretationCalls: number;
  retries: number;
  sharedConversation: false;
  orchestration: "bounded_waves";
  conversationCount: number;
  waves: number;
  snapshotRevision: number;
  phases: LlmPhaseProvenance[];
  testArtifact?: TestArtifactProvenance;
}

export interface AstralChart {
  schema: "astral-chart/1.1.0";
  subject: FinalSubject;
  zodiac: Zodiac;
  system: SystemInterpretation;
  compatibility: CompatibilityInterpretation;
  finalSynthesis: FinalSynthesis;
  provenance: ChartProvenance;
}
