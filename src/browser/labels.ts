const words = (value: string): string => value
  .split("_")
  .filter(Boolean)
  .map((word) => word === "mc" ? "MC" : word === "ic" ? "IC" : word)
  .join(" ");

const title = (value: string): string => {
  const selected = words(value);
  return selected.length === 0 ? "Interpretation" : `${selected[0]?.toLocaleUpperCase("en-GB")}${selected.slice(1)}`;
};

const lifeLabels: Readonly<Record<string, string>> = {
  identity_and_purpose: "Identity and purpose",
  emotional_nature: "Emotional nature",
  mind_and_communication: "Mind and communication",
  romance: "Romance",
  sexuality: "Intimacy and sexuality",
  committed_partnerships: "Committed partnerships",
  home_and_family: "Home and family",
  childhood_patterns: "Childhood patterns",
  creativity_and_self_expression: "Creativity and self-expression",
  children_and_nurturing: "Children and nurturing",
  friendship: "Friendship",
  community_and_groups: "Community and groups",
  work_style: "Work style",
  career_and_vocation: "Career and vocation",
  business_and_leadership: "Business and leadership",
  money_and_material_security: "Money and material security",
  public_life_and_ambition: "Public life and ambition",
  conflict_and_assertion: "Conflict and assertion",
  growth_and_opportunity: "Growth and opportunity",
  restrictions_and_responsibility: "Restrictions and responsibility",
  transformation_and_crisis: "Transformation and crisis",
  spirituality_and_meaning: "Spirituality and meaning",
  unconscious_patterns: "Unconscious patterns",
  wellbeing_and_daily_rhythm: "Wellbeing and daily rhythm",
  developmental_direction: "Developmental direction",
};

export const unitLabel = (id: string): string => {
  const parts = id.split(".");
  const section = parts[1] ?? "";
  if (section === "compatibility") {
    const domain = parts[2] ?? "";
    const sign = title(parts[3] ?? "");
    if (domain === "romantic") return `Romantic compatibility with ${sign}`;
    if (domain === "sexual") return `Intimacy compatibility with ${sign}`;
    if (domain === "business") return `Business compatibility with ${sign}`;
    if (domain === "friendship") return `Friendship compatibility with ${sign}`;
    if (domain === "overall") return `Overall compatibility with ${sign}`;
    return `${title(domain)} compatibility with ${sign}`;
  }
  if (section === "point") return `${title(parts.slice(2).join("_"))} placement`;
  if (section === "house") return `House ${parts[2] ?? ""}`.trim();
  if (section === "aspect") return `${title(parts.slice(2).join("_"))} aspect`;
  if (section === "pattern") return `${title(parts.slice(2).join("_"))} pattern`;
  if (section === "life") {
    const key = parts.slice(2).join("_");
    return lifeLabels[key] ?? title(key);
  }
  if (section === "lunar") return title(`lunar_${parts.slice(2).join("_")}`);
  if (section === "eclipse") return title(`eclipse_${parts.slice(2).join("_")}`);
  if (section === "overview") return "Chart overview";
  if (id.endsWith("final_synthesis")) return "Final chart synthesis";
  if (id === "generated-name") return "Chart nickname";
  return title(parts.slice(1).join("_"));
};

export const correctionSummary = (count: number): string => {
  const noun = count === 1 ? "interpretation is" : "interpretations are";
  return `${count} ${noun} being corrected by the small model. Accepted work remains safe.`;
};
