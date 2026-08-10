export const stripZodiacPrefix = (value: string): string => value
  .replace(/^\s*(?:tropical|sidereal)\s+/iu, "")
  .trim();

const sentence = (value: string): string => value.endsWith(".") ? value : `${value}.`;

export const readingDescription = (rawTitle: string): string | null => {
  const title = stripZodiacPrefix(rawTitle).toLocaleLowerCase("en-GB");

  if (/^ascendant\b|\bascendant\b/u.test(title)) {
    return "The Ascendant describes the style you present to the world, your instinctive approach to new situations, and how other people may first experience you.";
  }
  if (/^descendant\b|\bdescendant\b/u.test(title)) {
    return "The Descendant describes the qualities you tend to meet, seek or negotiate through close one-to-one relationships.";
  }
  if (/\bmidheaven\b/u.test(title)) {
    return "The Midheaven describes public direction, reputation, ambition and the kind of contribution you may feel drawn to make.";
  }
  if (/\bimum coeli\b/u.test(title)) {
    return "The Imum Coeli describes private foundations, roots, home life and the inner sense of belonging beneath your public identity.";
  }
  if (/\bvertex\b/u.test(title) && /\bantivertex\b/u.test(title)) {
    return "The Vertex–Antivertex axis is used to describe encounters or turning points that can feel unusually significant, especially through other people.";
  }
  if (/\bnorth node\b/u.test(title) && /\bsouth node\b/u.test(title)) {
    return "The lunar-node axis is used to contrast familiar patterns with directions of growth and development.";
  }
  if (/\blilith\b/u.test(title)) {
    return "Lilith interpretations explore themes of autonomy, exclusion, instinct, taboo and the parts of yourself that resist being domesticated or simplified.";
  }
  if (/\bprenatal lunar eclipse\b/u.test(title)) {
    return "The prenatal lunar eclipse is the most recent lunar eclipse before birth. Astrologers use it as a background theme for emotional culmination, release and inherited patterns.";
  }
  if (/\bprenatal solar eclipse\b/u.test(title)) {
    return "The prenatal solar eclipse is the most recent solar eclipse before birth. Astrologers use it as a background theme for beginnings, direction and long-running life motifs.";
  }
  if (/\brulership(?: and| ) dignity\b/u.test(title)) {
    return "Rulership and dignity describe how comfortably or strongly planets are traditionally considered to operate in their signs and how that modifies their expression.";
  }
  if (/\bchart balance\b/u.test(title)) {
    return "Chart balance summarises how the chart is distributed across elements, modalities, polarities and other structural emphases.";
  }
  if (/\bdominant themes\b/u.test(title)) {
    return "Dominant themes pull together the strongest repeating patterns across the chart rather than treating each placement in isolation.";
  }
  if (/\baspect\b/u.test(title)) {
    return sentence("An aspect describes the angular relationship between two chart points. The interpretation explains how those two functions tend to combine, reinforce or challenge one another");
  }
  if (/^house\s+\d+/u.test(title)) {
    return "A house describes an area of life where the signs and planets placed there are interpreted as becoming especially visible or active.";
  }
  if (/\bcompatibility\b/u.test(title)) {
    return "Compatibility compares this natal chart with the symbolic profile of another zodiac sign for the selected relationship domain.";
  }
  return null;
};
