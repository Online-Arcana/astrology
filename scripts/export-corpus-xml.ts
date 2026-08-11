import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { corpusSources } from "../src/interpretation/corpus/sources.js";
import type { CorpusAtom, CorpusClaim, CorpusSource } from "../src/interpretation/corpus/types.js";
import { angleAtoms, angleClaims, angleSources } from "../src/interpretation/corpus/data/angles.js";
import { aspectAtoms, aspectClaims } from "../src/interpretation/corpus/data/aspects.js";
import { bodyAtoms, bodyClaims } from "../src/interpretation/corpus/data/bodies.js";
import { balanceConditionSource, conditionAtoms, conditionClaims } from "../src/interpretation/corpus/data/conditions.js";
import { derivedAtoms, derivedClaims, derivedSources } from "../src/interpretation/corpus/data/derived.js";
import { domainAtoms, domainClaims, projectDomainSource } from "../src/interpretation/corpus/data/domains.js";
import { eclipseAtoms, eclipseClaims, eclipseSources } from "../src/interpretation/corpus/data/eclipses.js";
import { houseAtoms, houseClaims } from "../src/interpretation/corpus/data/houses.js";
import { patternAtoms, patternClaims, patternSources } from "../src/interpretation/corpus/data/patterns.js";
import { pointAtoms, pointClaims, pointSources } from "../src/interpretation/corpus/data/points.js";
import { signAtoms, signClaims } from "../src/interpretation/corpus/data/signs.js";

const out = resolve(process.argv[2] ?? "/tmp/corpus-xml");
const esc = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");
const attr = (name: string, value: string): string => ` ${name}="${esc(value)}"`;
const text = (name: string, value: string | null, indent: string): string => value === null
  ? `${indent}<${name} null="true" />`
  : `${indent}<${name}>${esc(value)}</${name}>`;
const list = (name: string, item: string, values: readonly string[], indent: string): string[] => [
  `${indent}<${name}>`,
  ...values.map((value) => `${indent}  <${item}>${esc(value)}</${item}>`),
  `${indent}</${name}>`,
];

const sourceXml = (source: CorpusSource): string[] => [
  `  <source${attr("id", source.id)}${attr("role", source.role)}${attr("review-status", source.reviewStatus)}>`,
  text("title", source.title, "    "),
  text("author", source.author, "    "),
  text("publisher", source.publisher, "    "),
  text("edition-or-date", source.editionOrDate, "    "),
  ...list("allowed-sections", "section", source.allowedSections, "    "),
  ...list("notes", "note", source.notes, "    "),
  "  </source>",
];

const atomXml = (atom: CorpusAtom): string[] => [
  `  <atom${attr("id", atom.id)}${attr("kind", atom.kind)}${attr("review-status", atom.reviewStatus)}>`,
  text("display-name", atom.displayName, "    "),
  text("plain-english", atom.plainEnglish, "    "),
  ...list("aliases", "alias", atom.aliases, "    "),
  ...list("internal-ids", "internal-id", atom.internalIds, "    "),
  ...list("claim-ids", "claim-id", atom.claimIds, "    "),
  ...list("do-not-infer", "concept", atom.doNotInfer, "    "),
  ...list("related-atom-ids", "atom-id", atom.relatedAtomIds, "    "),
  ...list("source-ids", "source-id", atom.sourceIds, "    "),
  "  </atom>",
];

const claimXml = (claim: CorpusClaim): string[] => [
  `  <claim${attr("id", claim.id)}${attr("atom-id", claim.atomId)}${attr("category", claim.category)}${attr("confidence", claim.confidence)}>`,
  text("proposition", claim.proposition, "    "),
  ...list("tags", "tag", claim.tags, "    "),
  ...list("source-refs", "source-ref", claim.sourceRefs, "    "),
  `    <neutrality religious="false" spiritual="false" karmic="false" fatalistic="false" supernatural="false" />`,
  "  </claim>",
];

const sourceManifest: readonly CorpusSource[] = [
  ...corpusSources,
  projectDomainSource,
  balanceConditionSource,
  ...pointSources,
  ...angleSources,
  ...patternSources,
  ...derivedSources,
  ...eclipseSources,
];

const groups: ReadonlyArray<{ name: string; atoms: readonly CorpusAtom[]; claims: readonly CorpusClaim[] }> = [
  { name: "bodies", atoms: bodyAtoms, claims: bodyClaims },
  { name: "points", atoms: pointAtoms, claims: pointClaims },
  { name: "angles", atoms: angleAtoms, claims: angleClaims },
  { name: "signs", atoms: signAtoms, claims: signClaims },
  { name: "houses", atoms: houseAtoms, claims: houseClaims },
  { name: "aspects", atoms: aspectAtoms, claims: aspectClaims },
  { name: "conditions", atoms: conditionAtoms, claims: conditionClaims },
  { name: "patterns", atoms: patternAtoms, claims: patternClaims },
  { name: "derived", atoms: derivedAtoms, claims: derivedClaims },
  { name: "eclipses", atoms: eclipseAtoms, claims: eclipseClaims },
  { name: "domains", atoms: domainAtoms, claims: domainClaims },
];

await mkdir(out, { recursive: true });
await writeFile(resolve(out, "sources.xml"), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<sources format="astral-corpus-xml/1.0.0">',
  ...sourceManifest.flatMap(sourceXml),
  '</sources>',
  '',
].join("\n"), "utf8");

for (const group of groups) {
  await writeFile(resolve(out, `${group.name}.xml`), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<corpus format="astral-corpus-xml/1.0.0" category="${group.name}">`,
    '  <atoms>',
    ...group.atoms.flatMap((atom) => atomXml(atom).map((line) => `  ${line}`)),
    '  </atoms>',
    '  <claims>',
    ...group.claims.flatMap((claim) => claimXml(claim).map((line) => `  ${line}`)),
    '  </claims>',
    '</corpus>',
    '',
  ].join("\n"), "utf8");
}

console.log(`Exported ${groups.length} corpus documents and one source manifest to ${out}`);
