import { displayReadingTitle, readingDescription } from "./readingHelp.js";

interface PlainAspectLanguage {
  title: string;
  description: string;
}

const plainFactorNames: Readonly<Record<string, string>> = {
  "North Node": "Growth direction",
  "South Node": "Familiar patterns",
  "Part of Fortune": "Ease and fulfilment",
  "Part of Spirit": "Purpose and inner direction",
  "Imum Coeli": "Home and private foundations",
  "East Point": "Personal presence",
  Lilith: "Autonomy and instinct",
  Ascendant: "How you present yourself",
  Descendant: "Close relationships",
  Midheaven: "Career and public direction",
  Vertex: "Significant encounters",
  Antivertex: "Your response to significant encounters",
};

const plainFactor = (value: string): string => plainFactorNames[value] ?? value;

const aspectLanguage: readonly [RegExp, (left: string, right: string) => PlainAspectLanguage][] = [
  [/^(.+?) conjunct (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: strongly combined influences`,
    description: `${plainFactor(left)} and ${plainFactor(right)} are closely linked in this chart, so their themes tend to operate together rather than separately.`,
  })],
  [/^(.+?) opposite (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: balancing opposite pulls`,
    description: `${plainFactor(left)} and ${plainFactor(right)} pull in different directions, creating a polarity that tends to work best when both sides are acknowledged and balanced.`,
  })],
  [/^(.+?) trine (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: natural strengths and easy flow`,
    description: `${plainFactor(left)} and ${plainFactor(right)} support one another naturally, so their qualities can work together with relatively little friction.`,
  })],
  [/^(.+?) square (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: pressure, friction and growth`,
    description: `${plainFactor(left)} and ${plainFactor(right)} create tension that can feel demanding, but that pressure can also drive action, awareness and development.`,
  })],
  [/^(.+?) sextile (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: supportive opportunities`,
    description: `${plainFactor(left)} and ${plainFactor(right)} can support one another through opportunities that tend to become more useful when you actively engage with them.`,
  })],
  [/^(.+?) quincunx (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: adjustment and compromise`,
    description: `${plainFactor(left)} and ${plainFactor(right)} do not fit together automatically, so their interaction often calls for ongoing adjustment, flexibility and compromise.`,
  })],
  [/^(.+?) semi-sextile (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: a subtle connection`,
    description: `${plainFactor(left)} and ${plainFactor(right)} have a quieter connection that may need conscious attention before its usefulness becomes obvious.`,
  })],
  [/^(.+?) semi-square (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: low-level friction`,
    description: `${plainFactor(left)} and ${plainFactor(right)} create mild but recurring friction that can encourage small, practical adjustments over time.`,
  })],
  [/^(.+?) sesquiquadrate (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: persistent pressure`,
    description: `${plainFactor(left)} and ${plainFactor(right)} create persistent tension that tends to push for adjustment rather than offering a quick or effortless resolution.`,
  })],
  [/^(.+?) quintile (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: creative talent and unusual strengths`,
    description: `${plainFactor(left)} and ${plainFactor(right)} can combine in specialised or creative ways, especially when the connection is developed deliberately.`,
  })],
  [/^(.+?) biquintile (.+)$/u, (left, right) => ({
    title: `${plainFactor(left)} and ${plainFactor(right)}: creative talent and unusual strengths`,
    description: `${plainFactor(left)} and ${plainFactor(right)} can combine in specialised or creative ways, especially when the connection is developed deliberately.`,
  })],
];

const patternTitles: Readonly<Record<string, string>> = {
  "T-square": "Focused pressure that needs an outlet",
  "Grand trine": "Strong natural flow across the chart",
  "Grand cross": "Competing pressures that need balance",
  "Mystic rectangle": "Balance between tension and natural flow",
  "Grand sextile": "A wide network of supportive opportunities",
  "Thor's hammer": "Concentrated pressure and determination",
  Yod: "A strong need for adjustment and redirection",
  Kite: "Natural strengths channelled towards a clear focus",
};

const plainTitles: Readonly<Record<string, string>> = {
  "North node mean": "Growth direction",
  "North node true": "Growth direction",
  "North Node": "Growth direction",
  "South node mean": "Familiar patterns",
  "South node true": "Familiar patterns",
  "South Node": "Familiar patterns",
  "Part of Fortune": "Ease, fulfilment and natural support",
  "Part of Spirit": "Purpose and inner direction",
  "Imum Coeli": "Home, roots and private foundations",
  "East Point": "Personal presence and first impressions",
  Lilith: "Autonomy, instinct and taboo",
  Vertex: "Significant encounters and turning points",
  Antivertex: "How you respond to significant encounters",
  "Lunar nodes": "Familiar patterns and growth direction",
  "Vertex–Antivertex axis": "Significant encounters and your response",
  "Ascendant–Descendant axis": "Self-presentation and close relationships",
  "Rulership and dignity": "How strongly each planet can express itself",
};

const plainAspect = (technicalTitle: string): PlainAspectLanguage | null => {
  for (const [pattern, build] of aspectLanguage) {
    const match = pattern.exec(technicalTitle);
    if (match?.[1] !== undefined && match[2] !== undefined) return build(match[1], match[2]);
  }
  return null;
};

export const customerReadingTitle = (rawTitle: string): string => {
  const technicalTitle = displayReadingTitle(rawTitle);
  const aspect = plainAspect(technicalTitle);
  if (aspect !== null) return aspect.title;
  return patternTitles[technicalTitle] ?? plainTitles[technicalTitle] ?? technicalTitle;
};

export const customerReadingDescription = (rawTitle: string): string | null => {
  const technicalTitle = displayReadingTitle(rawTitle);
  const aspect = plainAspect(technicalTitle);
  if (aspect !== null) return aspect.description;

  const pattern = patternTitles[technicalTitle];
  if (pattern !== undefined) {
    return `This is a larger chart-wide pattern. ${pattern} describes how several individual connections reinforce one another, so it is more useful to read them together than as isolated pairs.`;
  }

  const title = plainTitles[technicalTitle];
  if (title !== undefined) {
    const descriptions: Readonly<Record<string, string>> = {
      "Growth direction": "This section looks at qualities and experiences associated with longer-term growth and movement towards less familiar ways of responding.",
      "Familiar patterns": "This section looks at familiar habits, strengths and default responses that may feel natural but can become limiting when relied on automatically.",
      "Ease, fulfilment and natural support": "This section looks at areas where circumstances may feel easier to work with and where effort can produce a stronger sense of fulfilment.",
      "Purpose and inner direction": "This section looks at motivation, intention and the sense of inner direction behind the choices you make.",
      "Home, roots and private foundations": "This section focuses on home, family roots, private life and the emotional foundations beneath your public identity.",
      "Personal presence and first impressions": "This section focuses on personal presence and the impression you tend to make when entering social situations.",
      "Autonomy, instinct and taboo": "This section explores autonomy, instinct, exclusion, taboo and the parts of yourself that resist being simplified or controlled.",
      "Significant encounters and turning points": "This section focuses on encounters and turning points that may feel unusually significant, especially through other people.",
      "How you respond to significant encounters": "This section focuses on your side of unusually significant encounters and the way you respond when other people become catalysts for change.",
      "Familiar patterns and growth direction": "This section contrasts familiar default patterns with qualities and experiences associated with longer-term growth.",
      "Significant encounters and your response": "This section looks at significant encounters as a two-sided pattern: what arrives through other people and how you respond to it.",
      "Self-presentation and close relationships": "This section connects the way you present yourself with the qualities you seek, meet or negotiate through close relationships.",
      "How strongly each planet can express itself": "This section summarises traditional indicators of whether each planet is considered especially comfortable, constrained or emphasised in its sign.",
    };
    return descriptions[title] ?? readingDescription(rawTitle);
  }

  return readingDescription(rawTitle);
};
