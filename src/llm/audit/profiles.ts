import type { FieldProfile } from "./field.js";

const romanceFields: Readonly<Record<string, readonly string[]>> = {
  affectionStyle: ["affection", "warmth", "tenderness", "touch", "care", "closeness", "gesture", "afecto", "cariño", "ternura", "contacto", "cuidado", "cercanía"],
  courtshipStyle: ["courtship", "pursuit", "flirting", "attraction", "initiative", "dating", "approach", "cortejo", "conquista", "coqueteo", "atracción", "iniciativa", "citas", "acercamiento"],
  attachmentNeeds: ["attachment", "security", "reassurance", "trust", "consistency", "closeness", "autonomy", "space", "safety", "apego", "seguridad", "confianza", "constancia", "cercanía", "autonomía", "espacio"],
  preferredPartnerQualities: ["partner", "quality", "compatibility", "trust", "communication", "stability", "independence", "pareja", "cualidad", "compatibilidad", "confianza", "comunicación", "estabilidad", "independencia"],
  relationshipStrengths: ["support", "affection", "trust", "commitment", "reciprocity", "loyalty", "apoyo", "afecto", "confianza", "compromiso", "reciprocidad", "lealtad"],
  relationshipDifficulties: ["conflict", "distance", "jealousy", "avoidance", "pressure", "mistrust", "conflicto", "distancia", "celos", "evasión", "presión", "desconfianza"],
  commitmentPattern: ["commitment", "loyalty", "stability", "duration", "exclusivity", "independence", "compromiso", "lealtad", "estabilidad", "duración", "exclusividad", "independencia"],
};

const sexualityFields: Readonly<Record<string, readonly string[]>> = {
  desireStyle: ["desire", "attraction", "erotic", "longing", "chemistry", "deseo", "atracción", "erótico", "anhelo", "química"],
  libidoPattern: ["libido", "drive", "frequency", "energy", "fluctuation", "impulse", "libido", "impulso", "frecuencia", "energía", "fluctuación"],
  initiationStyle: ["initiate", "pursue", "approach", "signal", "invite", "first move", "iniciar", "perseguir", "acercarse", "señal", "invitar", "primer paso"],
  preferredPace: ["pace", "tempo", "slow", "gradual", "quick", "build-up", "ritmo", "tempo", "lento", "gradual", "rápido", "preámbulo"],
  physicalAffection: ["touch", "physical", "affection", "sensual", "contact", "tenderness", "tacto", "físico", "afecto", "sensual", "contacto", "ternura"],
  likelyTurnOns: ["turn-on", "arousal", "excite", "attract", "stimulate", "enciende", "excitación", "atrae", "estimula"],
  likelyTurnOffs: ["turn-off", "aversion", "repel", "discomfort", "inhibit", "desagrada", "aversión", "rechazo", "incomodidad", "inhibe"],
  experimentationStyle: ["experiment", "novelty", "curiosity", "variety", "boundary", "adventure", "experimentar", "novedad", "curiosidad", "variedad", "límite", "aventura"],
  emotionalSexConnection: ["emotion", "bond", "trust", "intimacy", "vulnerability", "connection", "emoción", "vínculo", "confianza", "intimidad", "vulnerabilidad", "conexión"],
  controlAndSurrender: ["control", "surrender", "yield", "lead", "receive", "release", "control", "entrega", "ceder", "liderar", "recibir", "soltar"],
  powerDynamics: ["power", "equality", "dominance", "submission", "agency", "balance", "poder", "igualdad", "dominancia", "sumisión", "agencia", "equilibrio"],
  exclusivityPattern: ["exclusive", "monogamy", "commitment", "freedom", "loyalty", "boundaries", "exclusividad", "monogamia", "compromiso", "libertad", "lealtad", "límites"],
  sexualCommunication: ["communicate", "voice", "ask", "consent", "boundary", "feedback", "comunicar", "expresar", "pedir", "consentimiento", "límite", "respuesta"],
  likelyFrustrations: ["frustration", "mismatch", "inhibition", "pressure", "distance", "dissatisfaction", "frustración", "desajuste", "inhibición", "presión", "distancia", "insatisfacción"],
};

const careerFields: Readonly<Record<string, readonly string[]>> = {
  vocationalThemes: ["vocation", "calling", "purpose", "contribution", "mission", "vocación", "llamado", "propósito", "contribución", "misión"],
  suitableFields: ["field", "industry", "profession", "occupation", "sector", "campo", "industria", "profesión", "ocupación", "sector"],
  preferredWorkEnvironment: ["environment", "workplace", "team", "autonomy", "structure", "pace", "entorno", "lugar de trabajo", "equipo", "autonomía", "estructura", "ritmo"],
  leadershipStyle: ["leadership", "lead", "delegate", "influence", "decision", "liderazgo", "liderar", "delegar", "influir", "decisión"],
  authorityRelationship: ["authority", "manager", "hierarchy", "rule", "supervision", "autoridad", "gerente", "jerarquía", "regla", "supervisión"],
  ambitionPattern: ["ambition", "achievement", "goal", "status", "advancement", "ambición", "logro", "meta", "estatus", "avance"],
  publicReputation: ["reputation", "public", "recognition", "visibility", "credibility", "reputación", "público", "reconocimiento", "visibilidad", "credibilidad"],
  careerStrengths: ["strength", "skill", "talent", "competence", "advantage", "fortaleza", "habilidad", "talento", "competencia", "ventaja"],
  careerRisks: ["risk", "burnout", "conflict", "stagnation", "overwork", "riesgo", "agotamiento", "conflicto", "estancamiento", "sobrecarga"],
};

const moneyFields: Readonly<Record<string, readonly string[]>> = {
  earningStyle: ["earn", "income", "revenue", "work", "resource", "ganar", "ingreso", "renta", "trabajo", "recurso"],
  spendingStyle: ["spend", "purchase", "budget", "expense", "indulgence", "gastar", "compra", "presupuesto", "gasto", "capricho"],
  securityNeeds: ["security", "reserve", "stability", "savings", "certainty", "seguridad", "reserva", "estabilidad", "ahorro", "certeza"],
  riskTolerance: ["risk", "investment", "speculation", "caution", "volatility", "riesgo", "inversión", "especulación", "cautela", "volatilidad"],
  materialStrengths: ["strength", "resource", "discipline", "planning", "stewardship", "fortaleza", "recurso", "disciplina", "planificación", "gestión"],
  financialBlindSpots: ["blind spot", "overspend", "scarcity", "avoidance", "debt", "punto ciego", "gasto excesivo", "escasez", "evasión", "deuda"],
};

export const fieldProfiles: Readonly<Record<string, FieldProfile>> = {
  sexuality: {
    id: "sexuality",
    lexicon: ["desire", "attraction", "libido", "intimacy", "pace", "touch", "communication", "deseo", "atracción", "intimidad", "ritmo", "contacto", "comunicación"],
    fieldLexicons: sexualityFields,
    minLength: 20,
  },
  career: {
    id: "career",
    lexicon: ["vocation", "work", "authority", "ambition", "achievement", "career", "vocación", "trabajo", "autoridad", "ambición", "logro", "carrera"],
    fieldLexicons: careerFields,
    minLength: 20,
  },
  romance: {
    id: "romance",
    lexicon: ["affection", "attachment", "courtship", "partnership", "relationship", "love", "commitment", "afecto", "apego", "cortejo", "pareja", "relación", "amor", "compromiso"],
    fieldLexicons: romanceFields,
    minLength: 20,
  },
  money: {
    id: "money",
    lexicon: ["money", "income", "earning", "spending", "security", "risk", "resources", "dinero", "ingreso", "ganancia", "gasto", "seguridad", "riesgo", "recursos"],
    fieldLexicons: moneyFields,
    minLength: 20,
  },
};
