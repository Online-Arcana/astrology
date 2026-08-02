export type CompletionCode =
  | "missing_terminal_punctuation"
  | "unbalanced_delimiter"
  | "dangling_clause"
  | "unfinished_sentence"
  | "missing_required_content";

export interface CompletionIssue {
  path: string;
  code: CompletionCode;
  message: string;
}

const terminal = /[.!?…”’)]$/u;
const dangling = /\b(?:and|or|but|because|although|while|with|without|through|towards?|into|from|of|for|to|as|than|which|that|who|whose|when|where|if|unless|despite|including|such as)\s*$/iu;
const continuation = /\b(?:continued|continue|to be continued|more follows|the rest|remaining fields?)\s*$/iu;
const openEnding = /[,;:/\-–—]\s*$/u;

const balanced = (value: string, open: string, close: string): boolean => {
  let depth = 0;
  for (const character of value) {
    if (character === open) depth += 1;
    else if (character === close) depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
};

const completeText = (value: string, path: string): CompletionIssue[] => {
  const text = value.trim();
  if (text.length === 0) return [{
    path,
    code: "missing_required_content",
    message: `${path} contains no text`,
  }];
  if (/(?:^|\.)title$/iu.test(path) || text.length < 24) return [];
  const issues: CompletionIssue[] = [];
  if (!balanced(text, "(", ")") || !balanced(text, "[", "]") || !balanced(text, "{", "}")) {
    issues.push({ path, code: "unbalanced_delimiter", message: `${path} contains an unbalanced delimiter` });
  }
  const quotes = (text.match(/[“”"]/gu) ?? []).length;
  if (quotes % 2 !== 0) {
    issues.push({ path, code: "unbalanced_delimiter", message: `${path} contains an unbalanced quotation mark` });
  }
  if (dangling.test(text) || openEnding.test(text)) {
    issues.push({ path, code: "dangling_clause", message: `${path} ends with an unfinished clause` });
  }
  if (continuation.test(text)) {
    issues.push({ path, code: "unfinished_sentence", message: `${path} contains continuation language instead of complete content` });
  }
  if (text.length >= 48 && !terminal.test(text)) {
    issues.push({ path, code: "missing_terminal_punctuation", message: `${path} does not end naturally` });
  }
  return issues;
};

const structural = new Set(["status", "sign", "domain"]);

const visit = (value: unknown, path: string, key: string | null, issues: CompletionIssue[]): void => {
  if (key === "sourceRefs") return;
  if (typeof value === "string") {
    if (key === null || !structural.has(key)) issues.push(...completeText(value, path));
    return;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, `${path}[${index}]`, null, issues));
    return;
  }
  if (typeof value !== "object") return;
  for (const [childKey, child] of Object.entries(value)) {
    visit(child, path.length === 0 ? childKey : `${path}.${childKey}`, childKey, issues);
  }
};

export const auditCompletion = (value: unknown, root = "output"): CompletionIssue[] => {
  const issues: CompletionIssue[] = [];
  visit(value, root, null, issues);
  return issues;
};

export const incompleteOutput = (value: unknown): boolean => auditCompletion(value).length > 0;
