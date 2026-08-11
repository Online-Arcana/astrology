import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const xmlDir = resolve("src/interpretation/corpus/data/xml");
const outputPath = resolve("src/interpretation/corpus/data/xml.generated.ts");
const sourceManifestName = "sources.xml";
const corpusDocumentNames = [
  "angles.xml",
  "aspects.xml",
  "bodies.xml",
  "conditions.xml",
  "derived.xml",
  "domains.xml",
  "eclipses.xml",
  "houses.xml",
  "patterns.xml",
  "points.xml",
  "signs.xml",
];

const readXml = async (name) => readFile(resolve(xmlDir, name), "utf8");
const sourceManifestXml = await readXml(sourceManifestName);
const documents = await Promise.all(corpusDocumentNames.map(async (name) => ({
  name,
  xml: await readXml(name),
})));

const generated = [
  "/*",
  " * GENERATED FILE. DO NOT EDIT.",
  " *",
  " * The authored interpretation corpus lives in data/xml/*.xml.",
  " * Run `npm run corpus:embed` after changing XML. This module embeds the",
  " * raw XML text so Node and browser builds use the same XML parser/runtime.",
  " */",
  "",
  `export const corpusSourceManifestName = ${JSON.stringify(sourceManifestName)} as const;`,
  `export const corpusSourceManifestXml = ${JSON.stringify(sourceManifestXml)} as const;`,
  "",
  "export const corpusXmlDocuments = [",
  ...documents.map(({ name, xml }) => `  { name: ${JSON.stringify(name)}, xml: ${JSON.stringify(xml)} },`),
  "] as const;",
  "",
].join("\n");

await writeFile(outputPath, generated, "utf8");
console.log(`Embedded ${documents.length + 1} XML corpus documents into ${outputPath}`);
