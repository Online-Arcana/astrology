import type {
  CorpusAtom,
  CorpusAtomKind,
  CorpusClaim,
  CorpusClaimCategory,
  CorpusClaimConfidence,
  CorpusReviewStatus,
  CorpusSource,
  CorpusSourceRole,
} from "./types.js";

export const corpusXmlFormat = "astral-corpus-xml/1.0.0" as const;

interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

export interface CorpusXmlDocument {
  name: string;
  xml: string;
}

export interface ParsedCorpusXml {
  sources: CorpusSource[];
  atoms: CorpusAtom[];
  claims: CorpusClaim[];
  categories: string[];
}

const sourceRoles = ["calculation", "semantic", "architecture"] as const satisfies readonly CorpusSourceRole[];
const reviewStatuses = ["approved", "pending", "rejected"] as const satisfies readonly CorpusReviewStatus[];
const atomKinds = ["entity", "domain", "style", "relation", "condition", "derived-construct"] as const satisfies readonly CorpusAtomKind[];
const claimCategories = ["core", "constructive", "difficult", "developmental", "interaction"] as const satisfies readonly CorpusClaimCategory[];
const claimConfidences = ["core", "well-supported", "school-specific", "experimental"] as const satisfies readonly CorpusClaimConfidence[];

const xmlName = /^[A-Za-z_][A-Za-z0-9_.:-]*$/u;

const decodeEntity = (token: string, documentName: string): string => {
  switch (token) {
    case "amp": return "&";
    case "lt": return "<";
    case "gt": return ">";
    case "quot": return "\"";
    case "apos": return "'";
    default: {
      const value = token.startsWith("#x") || token.startsWith("#X")
        ? Number.parseInt(token.slice(2), 16)
        : token.startsWith("#")
          ? Number.parseInt(token.slice(1), 10)
          : Number.NaN;
      if (!Number.isSafeInteger(value) || value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) {
        throw new Error(`${documentName}: unsupported XML entity &${token};`);
      }
      return String.fromCodePoint(value);
    }
  }
};

const decodeXmlText = (value: string, documentName: string): string => {
  let output = "";
  let offset = 0;
  while (offset < value.length) {
    const amp = value.indexOf("&", offset);
    if (amp < 0) return output + value.slice(offset);
    output += value.slice(offset, amp);
    const end = value.indexOf(";", amp + 1);
    if (end < 0) throw new Error(`${documentName}: unescaped ampersand in XML text`);
    output += decodeEntity(value.slice(amp + 1, end), documentName);
    offset = end + 1;
  }
  return output;
};

const parseAttributes = (raw: string, documentName: string, elementName: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  let remaining = raw.trim();
  const pattern = /^([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/u;
  while (remaining.length > 0) {
    const match = pattern.exec(remaining);
    if (match === null || match[1] === undefined) {
      throw new Error(`${documentName}: malformed attributes on <${elementName}>`);
    }
    const name = match[1];
    if (!xmlName.test(name)) throw new Error(`${documentName}: invalid XML attribute name ${name}`);
    if (attributes[name] !== undefined) throw new Error(`${documentName}: duplicate XML attribute ${name} on <${elementName}>`);
    attributes[name] = decodeXmlText(match[2] ?? match[3] ?? "", documentName);
    remaining = remaining.slice(match[0].length);
  }
  return attributes;
};

const appendText = (node: XmlNode, raw: string, documentName: string): void => {
  const decoded = decodeXmlText(raw, documentName).replaceAll(/\s+/gu, " ").trim();
  if (decoded.length === 0) return;
  node.text = node.text.length === 0 ? decoded : `${node.text} ${decoded}`;
};

const parseXmlDocument = (source: string, documentName: string): XmlNode => {
  if (/<!DOCTYPE\b|<!ENTITY\b/iu.test(source)) {
    throw new Error(`${documentName}: DTD and entity declarations are forbidden in corpus XML`);
  }

  const document: XmlNode = { name: "#document", attributes: {}, children: [], text: "" };
  const stack: XmlNode[] = [document];
  const token = /<\?xml\s[^?]*\?>|<!--[\s\S]*?-->|<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>|<([A-Za-z_][A-Za-z0-9_.:-]*)([^<>]*?)\/\s*>|<([A-Za-z_][A-Za-z0-9_.:-]*)([^<>]*?)>|([^<]+)/gu;
  let offset = 0;

  for (const match of source.matchAll(token)) {
    if (match.index !== offset) throw new Error(`${documentName}: malformed XML near offset ${offset}`);
    offset = match.index + match[0].length;

    if (match[0].startsWith("<?xml") || match[0].startsWith("<!--")) continue;

    const closing = match[1];
    if (closing !== undefined) {
      if (stack.length === 1) throw new Error(`${documentName}: unexpected closing tag </${closing}>`);
      const current = stack.pop();
      if (current?.name !== closing) {
        throw new Error(`${documentName}: mismatched closing tag </${closing}> for <${current?.name ?? "unknown"}>`);
      }
      continue;
    }

    const selfClosing = match[2];
    if (selfClosing !== undefined) {
      const parent = stack.at(-1);
      if (parent === undefined) throw new Error(`${documentName}: XML parser lost its parent node`);
      parent.children.push({
        name: selfClosing,
        attributes: parseAttributes(match[3] ?? "", documentName, selfClosing),
        children: [],
        text: "",
      });
      continue;
    }

    const opening = match[4];
    if (opening !== undefined) {
      const parent = stack.at(-1);
      if (parent === undefined) throw new Error(`${documentName}: XML parser lost its parent node`);
      const node: XmlNode = {
        name: opening,
        attributes: parseAttributes(match[5] ?? "", documentName, opening),
        children: [],
        text: "",
      };
      parent.children.push(node);
      stack.push(node);
      continue;
    }

    const parent = stack.at(-1);
    if (parent === undefined) throw new Error(`${documentName}: XML parser lost its text parent`);
    appendText(parent, match[6] ?? "", documentName);
  }

  if (offset !== source.length) throw new Error(`${documentName}: malformed XML near offset ${offset}`);
  if (stack.length !== 1) throw new Error(`${documentName}: unclosed XML element <${stack.at(-1)?.name ?? "unknown"}>`);
  if (document.text.length > 0) throw new Error(`${documentName}: text is not allowed outside the root element`);
  if (document.children.length !== 1 || document.children[0] === undefined) {
    throw new Error(`${documentName}: expected exactly one XML root element`);
  }
  return document.children[0];
};

const assertAttributes = (node: XmlNode, allowed: readonly string[], documentName: string): void => {
  const permitted = new Set(allowed);
  for (const name of Object.keys(node.attributes)) {
    if (!permitted.has(name)) throw new Error(`${documentName}: unexpected attribute ${name} on <${node.name}>`);
  }
};

const assertChildren = (node: XmlNode, allowed: readonly string[], documentName: string): void => {
  const permitted = new Set(allowed);
  for (const child of node.children) {
    if (!permitted.has(child.name)) throw new Error(`${documentName}: unexpected <${child.name}> inside <${node.name}>`);
  }
};

const childrenNamed = (node: XmlNode, name: string): XmlNode[] => node.children.filter((child) => child.name === name);

const oneChild = (node: XmlNode, name: string, documentName: string): XmlNode => {
  const found = childrenNamed(node, name);
  if (found.length !== 1 || found[0] === undefined) {
    throw new Error(`${documentName}: <${node.name}> requires exactly one <${name}> child`);
  }
  return found[0];
};

const leafText = (node: XmlNode, documentName: string): string => {
  if (node.children.length > 0) throw new Error(`${documentName}: <${node.name}> must contain text only`);
  if (Object.keys(node.attributes).length > 0) throw new Error(`${documentName}: <${node.name}> does not allow attributes`);
  return node.text;
};

const childText = (node: XmlNode, name: string, documentName: string): string =>
  leafText(oneChild(node, name, documentName), documentName);

const nullableChildText = (node: XmlNode, name: string, documentName: string): string | null => {
  const child = oneChild(node, name, documentName);
  assertAttributes(child, ["null"], documentName);
  if (child.children.length > 0) throw new Error(`${documentName}: <${name}> must contain text only`);
  const nullMarker = child.attributes["null"];
  if (nullMarker === undefined) return child.text;
  if (nullMarker !== "true") throw new Error(`${documentName}: <${name}> null attribute must be true when present`);
  if (child.text.length > 0) throw new Error(`${documentName}: null <${name}> cannot also contain text`);
  return null;
};

const listText = (
  node: XmlNode,
  containerName: string,
  itemName: string,
  documentName: string,
): string[] => {
  const container = oneChild(node, containerName, documentName);
  assertAttributes(container, [], documentName);
  assertChildren(container, [itemName], documentName);
  if (container.text.length > 0) throw new Error(`${documentName}: <${containerName}> may contain only <${itemName}> children`);
  return childrenNamed(container, itemName).map((item) => leafText(item, documentName));
};

const requiredAttribute = (node: XmlNode, name: string, documentName: string): string => {
  const value = node.attributes[name];
  if (value === undefined || value.length === 0) throw new Error(`${documentName}: <${node.name}> requires attribute ${name}`);
  return value;
};

const enumAttribute = <T extends string>(
  node: XmlNode,
  name: string,
  allowed: readonly T[],
  documentName: string,
): T => {
  const value = requiredAttribute(node, name, documentName);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${documentName}: invalid ${name}=${value} on <${node.name}>`);
  }
  return value as T;
};

const verifyFormat = (node: XmlNode, documentName: string): void => {
  const format = requiredAttribute(node, "format", documentName);
  if (format !== corpusXmlFormat) throw new Error(`${documentName}: unsupported corpus XML format ${format}`);
};

export const parseCorpusSourceManifestXml = (
  xml: string,
  documentName = "sources.xml",
): CorpusSource[] => {
  const root = parseXmlDocument(xml, documentName);
  if (root.name !== "sources") throw new Error(`${documentName}: expected <sources> root`);
  assertAttributes(root, ["format"], documentName);
  assertChildren(root, ["source"], documentName);
  verifyFormat(root, documentName);
  if (root.text.length > 0) throw new Error(`${documentName}: <sources> cannot contain direct text`);

  return childrenNamed(root, "source").map((source): CorpusSource => {
    assertAttributes(source, ["id", "role", "review-status"], documentName);
    assertChildren(source, ["title", "author", "publisher", "edition-or-date", "allowed-sections", "notes"], documentName);
    if (source.text.length > 0) throw new Error(`${documentName}: <source> cannot contain direct text`);
    return {
      id: requiredAttribute(source, "id", documentName),
      title: childText(source, "title", documentName),
      author: nullableChildText(source, "author", documentName),
      publisher: nullableChildText(source, "publisher", documentName),
      editionOrDate: nullableChildText(source, "edition-or-date", documentName),
      role: enumAttribute(source, "role", sourceRoles, documentName),
      reviewStatus: enumAttribute(source, "review-status", reviewStatuses, documentName),
      allowedSections: listText(source, "allowed-sections", "section", documentName),
      notes: listText(source, "notes", "note", documentName),
    };
  });
};

const parseAtom = (atom: XmlNode, documentName: string): CorpusAtom => {
  assertAttributes(atom, ["id", "kind", "review-status"], documentName);
  assertChildren(atom, [
    "display-name",
    "plain-english",
    "aliases",
    "internal-ids",
    "claim-ids",
    "do-not-infer",
    "related-atom-ids",
    "source-ids",
  ], documentName);
  if (atom.text.length > 0) throw new Error(`${documentName}: <atom> cannot contain direct text`);
  return {
    id: requiredAttribute(atom, "id", documentName),
    kind: enumAttribute(atom, "kind", atomKinds, documentName),
    displayName: childText(atom, "display-name", documentName),
    plainEnglish: childText(atom, "plain-english", documentName),
    aliases: listText(atom, "aliases", "alias", documentName),
    internalIds: listText(atom, "internal-ids", "internal-id", documentName),
    claimIds: listText(atom, "claim-ids", "claim-id", documentName),
    doNotInfer: listText(atom, "do-not-infer", "concept", documentName),
    relatedAtomIds: listText(atom, "related-atom-ids", "atom-id", documentName),
    sourceIds: listText(atom, "source-ids", "source-id", documentName),
    reviewStatus: enumAttribute(atom, "review-status", reviewStatuses, documentName),
  };
};

const parseNeutrality = (claim: XmlNode, documentName: string): CorpusClaim["neutrality"] => {
  const neutrality = oneChild(claim, "neutrality", documentName);
  const fields = ["religious", "spiritual", "karmic", "fatalistic", "supernatural"] as const;
  assertAttributes(neutrality, fields, documentName);
  assertChildren(neutrality, [], documentName);
  if (neutrality.text.length > 0) throw new Error(`${documentName}: <neutrality> must be empty`);
  for (const field of fields) {
    if (requiredAttribute(neutrality, field, documentName) !== "false") {
      throw new Error(`${documentName}: production corpus neutrality marker ${field} must be false`);
    }
  }
  return {
    religious: false,
    spiritual: false,
    karmic: false,
    fatalistic: false,
    supernatural: false,
  };
};

const parseClaim = (claim: XmlNode, documentName: string): CorpusClaim => {
  assertAttributes(claim, ["id", "atom-id", "category", "confidence"], documentName);
  assertChildren(claim, ["proposition", "tags", "source-refs", "neutrality"], documentName);
  if (claim.text.length > 0) throw new Error(`${documentName}: <claim> cannot contain direct text`);
  return {
    id: requiredAttribute(claim, "id", documentName),
    atomId: requiredAttribute(claim, "atom-id", documentName),
    category: enumAttribute(claim, "category", claimCategories, documentName),
    proposition: childText(claim, "proposition", documentName),
    tags: listText(claim, "tags", "tag", documentName),
    sourceRefs: listText(claim, "source-refs", "source-ref", documentName),
    neutrality: parseNeutrality(claim, documentName),
    confidence: enumAttribute(claim, "confidence", claimConfidences, documentName),
  };
};

export const parseCorpusXmlDocument = (
  xml: string,
  documentName: string,
): { category: string; atoms: CorpusAtom[]; claims: CorpusClaim[] } => {
  const root = parseXmlDocument(xml, documentName);
  if (root.name !== "corpus") throw new Error(`${documentName}: expected <corpus> root`);
  assertAttributes(root, ["format", "category"], documentName);
  assertChildren(root, ["atoms", "claims"], documentName);
  verifyFormat(root, documentName);
  if (root.text.length > 0) throw new Error(`${documentName}: <corpus> cannot contain direct text`);

  const atoms = oneChild(root, "atoms", documentName);
  assertAttributes(atoms, [], documentName);
  assertChildren(atoms, ["atom"], documentName);
  if (atoms.text.length > 0) throw new Error(`${documentName}: <atoms> cannot contain direct text`);

  const claims = oneChild(root, "claims", documentName);
  assertAttributes(claims, [], documentName);
  assertChildren(claims, ["claim"], documentName);
  if (claims.text.length > 0) throw new Error(`${documentName}: <claims> cannot contain direct text`);

  return {
    category: requiredAttribute(root, "category", documentName),
    atoms: childrenNamed(atoms, "atom").map((atom) => parseAtom(atom, documentName)),
    claims: childrenNamed(claims, "claim").map((claim) => parseClaim(claim, documentName)),
  };
};

export const parseReviewedCorpusXml = (
  sourceManifestXml: string,
  sourceManifestName: string,
  documents: readonly CorpusXmlDocument[],
): ParsedCorpusXml => {
  const sources = parseCorpusSourceManifestXml(sourceManifestXml, sourceManifestName);
  const atoms: CorpusAtom[] = [];
  const claims: CorpusClaim[] = [];
  const categories: string[] = [];
  const seenNames = new Set<string>();
  const seenCategories = new Set<string>();

  for (const document of documents) {
    if (seenNames.has(document.name)) throw new Error(`Duplicate corpus XML document name ${document.name}`);
    seenNames.add(document.name);
    const parsed = parseCorpusXmlDocument(document.xml, document.name);
    if (seenCategories.has(parsed.category)) throw new Error(`Duplicate corpus XML category ${parsed.category}`);
    seenCategories.add(parsed.category);
    categories.push(parsed.category);
    atoms.push(...parsed.atoms);
    claims.push(...parsed.claims);
  }

  return { sources, atoms, claims, categories };
};
