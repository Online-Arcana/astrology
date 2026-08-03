import { readFile } from "node:fs/promises";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const controls = await readFile("public/key-export.js", "utf8");
const safeguards = await readFile("public/usability.css", "utf8");
const build = await readFile("scripts/build-pages.mjs", "utf8");

assert(/astral\.chart-form/u.test(controls), "chart form values must be saved in localStorage");
assert(/document\.addEventListener\("submit"/u.test(controls), "generation submit must save current credentials and form data");
assert(/astral\.openai-key/u.test(controls), "OpenAI key must be saved when generation starts");
assert(/timeInput\.step = "60"/u.test(controls), "browser birth time must use minute precision");
assert(/showSigningKeyBundle/u.test(controls) && /password-toggle/u.test(controls), "signing bundle visibility must use an in-field eye control");
assert(!/action\("showSigningKeyBundle"/u.test(controls), "signing bundle visibility must not be a separate action button");
assert(/min-width:\s*0/u.test(safeguards), "responsive controls must be allowed to shrink inside their containers");
assert(/max-width:\s*100%/u.test(safeguards), "responsive controls must never exceed their containers");
assert(/overflow-x:\s*hidden/u.test(safeguards), "page-level horizontal overflow must be blocked");
assert(/usability\.css/u.test(build), "Pages build must inject responsive safeguards into every HTML page");

console.log("1..10");
for (let index = 1; index <= 10; index += 1) console.log(`ok ${index} - browser usability safeguard`);
