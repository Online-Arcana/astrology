export type FallbackFamily =
  | "section"
  | "romance"
  | "sexuality"
  | "career"
  | "money"
  | "synthesis"
  | "compatibility-overview"
  | "compatibility-sign"
  | "final-synthesis"
  | "generated-name";

export const fallbackCatalogueVersion = "astral-deterministic-fallbacks/1.0.0" as const;

/** Generated from fallbacks.xml. Keep both files in sync. */
export const fallbackCatalogue: Readonly<Record<FallbackFamily, Readonly<Record<string, string>>>> = {
  section: {
    title: "{topic}",
    summary: "You may experience {topicLower} through a mixture of steady strengths and changing pressures.",
    detail: "You can understand {topicLower} by noticing what stays consistent, what changes with circumstance and where deliberate choices help you respond more effectively.",
    themes: "You may notice recurring patterns in {topicLower} that become clearer through experience.",
    strengths: "You can draw on self-awareness and adaptability in this area.",
    tensions: "You may need to balance competing needs without forcing a single response.",
  },
  romance: {
    title: "Romance",
    summary: "You may approach romance by balancing emotional openness with a realistic sense of pace and trust.",
    detail: "You can build more satisfying relationships when attraction, communication and emotional safety are allowed to develop together.",
    themes: "You may repeatedly explore how closeness and independence can support one another.",
    strengths: "You can bring sincerity and growing self-awareness into romantic bonds.",
    tensions: "You may need to avoid treating temporary uncertainty as a final judgement on a relationship.",
    affectionStyle: "You may express affection most naturally through consistent attention, warmth and responsiveness.",
    courtshipStyle: "You may prefer courtship that develops through clear interest, mutual effort and enough time to recognise genuine compatibility.",
    attachmentNeeds: "You may feel safest when closeness is dependable without becoming restrictive.",
    preferredPartnerQualities: "You may value a partner who communicates honestly, respects boundaries and responds with emotional maturity.",
    relationshipStrengths: "You can strengthen relationships through loyalty, reflection and willingness to adjust.",
    relationshipDifficulties: "You may struggle when expectations remain unspoken or when reassurance and autonomy feel difficult to balance.",
    commitmentPattern: "You may commit most fully when trust has been demonstrated through consistent actions rather than promises alone.",
  },
  sexuality: {
    title: "Sexuality",
    summary: "You may experience sexuality as a personal balance of desire, trust, communication and changing emotional context.",
    detail: "You can develop a more satisfying intimate life by recognising your own pace, communicating boundaries clearly and allowing mutual responsiveness to guide the connection.",
    themes: "You may repeatedly explore how desire and emotional safety influence one another.",
    strengths: "You can bring curiosity, self-awareness and honest communication into intimacy.",
    tensions: "You may need to balance immediate desire with the pace required for trust and mutual comfort.",
    desireStyle: "Your desire may become clearest when interest feels mutual, direct and emotionally safe.",
    libidoPattern: "Your level of desire may vary with stress, trust, novelty and the quality of emotional connection.",
    initiationStyle: "You may initiate most comfortably when signals are clear and mutual enthusiasm is easy to recognise.",
    preferredPace: "You may prefer a pace that feels responsive rather than rushed or mechanically fixed.",
    physicalAffection: "You may value physical affection that communicates attention, reassurance and genuine presence.",
    likelyTurnOns: "You may respond positively to mutual confidence, clear consent and attentive communication.",
    likelyTurnOffs: "You may withdraw when pressure, ambiguity or disregard for boundaries disrupts trust.",
    experimentationStyle: "You may explore new experiences most comfortably when curiosity is shared and boundaries remain explicit.",
    emotionalSexConnection: "You may find intimacy more meaningful when emotional understanding supports physical attraction.",
    controlAndSurrender: "You may prefer control and surrender to remain negotiated, reversible and grounded in trust.",
    powerDynamics: "You may engage with power dynamics best when both people communicate expectations and preserve mutual respect.",
    exclusivityPattern: "Your preferences around exclusivity may depend on trust, clarity and whether agreements feel genuinely mutual.",
    sexualCommunication: "You can strengthen intimacy by naming preferences, limits and changes in comfort directly.",
    likelyFrustrations: "You may feel frustrated when desire, pace or expectations are assumed instead of discussed.",
  },
  career: {
    title: "Career and vocation",
    summary: "You may build a satisfying career by combining practical competence with work that feels personally meaningful.",
    detail: "You can make stronger vocational choices when you consider both your natural working style and the environment in which your abilities are most consistently supported.",
    themes: "You may repeatedly evaluate how ambition, purpose and sustainable effort fit together.",
    strengths: "You can contribute through adaptability, persistence and increasing clarity about your priorities.",
    tensions: "You may need to balance achievement with realistic limits and long-term wellbeing.",
    vocationalThemes: "You may be drawn towards work that rewards learning, responsibility and visible contribution.",
    suitableFields: "You may do well in fields that value judgement, communication, analysis or dependable problem-solving.",
    preferredWorkEnvironment: "You may work best where expectations are clear, autonomy is respected and useful feedback is available.",
    leadershipStyle: "You may lead most effectively through clarity, consistency and willingness to listen before deciding.",
    authorityRelationship: "You may respond best to authority that is competent, transparent and accountable.",
    ambitionPattern: "Your ambition may strengthen when progress feels purposeful and achievable rather than purely competitive.",
    publicReputation: "You may become known for the qualities you demonstrate consistently, especially reliability and thoughtful effort.",
    careerStrengths: "You can build professional trust through preparation, adaptability and follow-through.",
    careerRisks: "You may need to avoid overcommitting or remaining in work that no longer supports growth.",
  },
  money: {
    title: "Money and material security",
    summary: "You may approach money by balancing immediate needs, long-term security and the freedom to adapt.",
    detail: "You can strengthen material stability by making priorities explicit, reviewing habits regularly and separating emotional reactions from practical decisions.",
    themes: "You may repeatedly consider how security, value and personal freedom influence financial choices.",
    strengths: "You can improve financial stability through awareness, planning and willingness to adjust.",
    tensions: "You may need to balance caution with the confidence to use resources constructively.",
    earningStyle: "You may earn most reliably through consistent skills, useful contribution and relationships built on trust.",
    spendingStyle: "Your spending may reflect both practical priorities and the emotional meaning attached to comfort or freedom.",
    securityNeeds: "You may feel more secure when essential commitments are covered and future choices remain possible.",
    riskTolerance: "Your tolerance for risk may change according to preparation, available reserves and confidence in the underlying plan.",
    materialStrengths: "You can build security through planning, adaptability and realistic assessment of resources.",
    financialBlindSpots: "You may overlook how stress, urgency or optimism can temporarily distort financial judgement.",
  },
  synthesis: {
    centralThemes: "You may recognise a recurring need to balance self-expression, responsibility and adaptation.",
    contradictions: "You may sometimes want certainty while also needing room to change direction.",
    gifts: "You can draw on self-awareness, resilience and the ability to learn from experience.",
    growthEdges: "You may grow by responding deliberately instead of treating every tension as something that must be resolved immediately.",
    narrative: "Your chart can be read as a developing pattern rather than a fixed verdict. You may become more effective as you recognise recurring strengths, accept genuine tensions and choose how to express them in context.",
  },
  "compatibility-overview": {
    overview: "You may experience this compatibility area differently with each person, with communication, maturity and shared expectations shaping how the underlying pattern develops.",
  },
  "compatibility-sign": {
    summary: "You may find a workable connection with {sign} when both people communicate clearly and allow differences to develop at a realistic pace.",
    dynamic: "You may experience a connection that combines natural understanding with differences requiring patience, negotiation and context.",
    strengths: "You may support one another through complementary perspectives and willingness to adapt.",
    tensions: "You may experience friction when assumptions replace direct communication.",
    attraction: "You may find attraction grows through curiosity, mutual respect and clear responsiveness.",
    sustainability: "You may find the connection becomes more sustainable when expectations are explicit and both people adjust in good faith.",
    bestExpression: "You may find this connection works best when both people preserve individuality while building dependable ways to cooperate.",
  },
  "final-synthesis": {
    essence: "You may be understood as a person whose strengths become clearest through self-awareness, adaptation and deliberate choice.",
    definingThemes: "You may repeatedly balance independence, connection, responsibility and personal growth.",
    strongestAssets: "You can draw on resilience, reflection and the ability to learn from changing circumstances.",
    recurringTensions: "You may encounter tension when different needs compete for attention at the same time.",
    relationshipPattern: "You may build stronger relationships through honest communication, dependable boundaries and realistic expectations.",
    sexualPattern: "You may experience intimacy most constructively when desire, trust and communication remain connected.",
    friendshipPattern: "You may value friendships that allow both loyalty and enough freedom for each person to remain authentic.",
    vocationalPattern: "You may work best when practical contribution and personal meaning reinforce one another.",
    moneyPattern: "You may strengthen material security through clear priorities, regular review and adaptable planning.",
    developmentalArc: "Your development may involve turning recurring tensions into more conscious choices rather than fixed limitations.",
    closingPortrait: "Your chart suggests a developing person rather than a finished definition. You may become most fully yourself by recognising what is consistent, adapting where circumstances change and choosing how your strengths are expressed.",
  },
  "generated-name": {
    value: "Cosmic-pattern-portrait",
  },
};
