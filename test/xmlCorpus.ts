import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  reviewedCorpusAtoms,
  reviewedCorpusCategories,
  reviewedCorpusClaims,
  reviewedCorpusOrigin,
  reviewedCorpusSources,
} from "../src/interpretation/corpus/data/index.js";
import {
  parseCorpusSourceManifestXml,
  parseCorpusXmlDocument,
  parseReviewedCorpusXml,
} from "../src/interpretation/corpus/xml.js";

const equal = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
};
const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

let passed = 0;
const test = (name: string, run: () => void): void => {
  run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

const xmlDir = resolve("src/interpretation/corpus/data/xml");
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
] as const;

const sourceManifestXml = readFileSync(resolve(xmlDir, sourceManifestName), "utf8");
const documents = corpusDocumentNames.map((name) => ({
  name,
  xml: readFileSync(resolve(xmlDir, name), "utf8"),
}));
const parsedDirectly = parseReviewedCorpusXml(sourceManifestXml, sourceManifestName, documents);

test("the production corpus is authored in XML", () => {
  equal(reviewedCorpusOrigin, "xml", "corpus origin");
  equal(
    JSON.stringify(reviewedCorpusCategories),
    JSON.stringify(corpusDocumentNames.map((name) => name.slice(0, -4))),
    "runtime category order",
  );
});

test("embedded runtime corpus is exactly the checked-in XML corpus", () => {
  equal(JSON.stringify(reviewedCorpusSources), JSON.stringify(parsedDirectly.sources), "source manifest parity");
  equal(JSON.stringify(reviewedCorpusAtoms), JSON.stringify(parsedDirectly.atoms), "atom parity");
  equal(JSON.stringify(reviewedCorpusClaims), JSON.stringify(parsedDirectly.claims), "claim parity");
});

test("XML source manifest retains document and section provenance", () => {
  const sources = parseCorpusSourceManifestXml(sourceManifestXml, sourceManifestName);
  const sun = sources.find(({ id }) => id === "semantic.hand.transits-sun-intro");
  assert(sun !== undefined, "reviewed Sun source should be present");
  equal(sun.role, "semantic", "Sun source role");
  equal(sun.reviewStatus, "approved", "Sun source review status");
  assert(sun.allowedSections.includes("central-function"), "approved section should survive XML parsing");
});

test("corpus XML parser rejects DTD and entity declarations", () => {
  let failed = false;
  try {
    parseCorpusSourceManifestXml(
      `<?xml version="1.0"?><!DOCTYPE sources [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><sources format="astral-corpus-xml/1.0.0"></sources>`,
      "unsafe.xml",
    );
  } catch (cause: unknown) {
    failed = cause instanceof Error && cause.message.includes("DTD and entity declarations are forbidden");
  }
  equal(failed, true, "DTD/XXE input must fail closed");
});

test("production XML cannot opt a claim into worldview assumptions", () => {
  const bodies = readFileSync(resolve(xmlDir, "bodies.xml"), "utf8");
  const contaminated = bodies.replace('religious="false"', 'religious="true"');
  let failed = false;
  try {
    parseCorpusXmlDocument(contaminated, "contaminated-bodies.xml");
  } catch (cause: unknown) {
    failed = cause instanceof Error && cause.message.includes("neutrality marker religious must be false");
  }
  equal(failed, true, "non-neutral XML claim must be rejected by the parser");
});

test("XML corpus contains the same complete record counts used by production", () => {
  equal(parsedDirectly.sources.length, 46, "source count");
  equal(parsedDirectly.atoms.length, 129, "atom count");
  equal(parsedDirectly.claims.length, 155, "claim count");
});

console.log(`1..${passed}`);
