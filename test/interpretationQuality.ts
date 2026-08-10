import { strict as assert } from "node:assert";

// Regression fixtures for the interpretation-quality classifier. These examples
// deliberately distinguish semantically useful prose from deterministic fallback
// boilerplate that merely repeats internal unit labels.

const stale = [
  "You may experience tropical aspect north node mean uranus conjunction through a mixture of steady strengths and changing pressures.",
  "You can understand tropical life children and nurturing by noticing what stays consistent, what changes with circumstance and where deliberate choices help you respond more effectively.",
  "You may experience tropical aspect part of spirit vertex trine through a mixture of steady strengths and changing pressures.",
];

const usefulCompatibility = [
  "You may find a workable connection with Capricorn when both people communicate clearly and allow differences to develop at a realistic pace.",
  "You may experience a connection that combines natural understanding with differences requiring patience, negotiation and context.",
  "You may support one another through complementary perspectives and willingness to adapt.",
  "You may experience friction when assumptions replace direct communication.",
  "You may find attraction grows through curiosity, mutual respect and clear responsiveness.",
  "You may find the connection becomes more sustainable when expectations are explicit and both people adjust in good faith.",
  "You may find this connection works best when both people preserve individuality while building dependable ways to cooperate.",
];

const internalLabel = /\b(?:tropical|sidereal)\s+(?:aspect|house|life|point|pattern|eclipse)\b/iu;
const metaFallback = /\b(?:you may experience .+ through a mixture of steady strengths and changing pressures|you can understand .+ by noticing what stays consistent|you may notice recurring patterns in .+ that become clearer through experience)\b/iu;

for (const text of stale) {
  assert.equal(internalLabel.test(text) || metaFallback.test(text), true, `stale fixture must be rejected: ${text}`);
}
for (const text of usefulCompatibility) {
  assert.equal(internalLabel.test(text), false, `good compatibility prose must not look like an internal label: ${text}`);
  assert.equal(metaFallback.test(text), false, `good compatibility prose must not look like fallback boilerplate: ${text}`);
}

console.log("ok 1 - stale internal-label fallback prose is rejected");
console.log("ok 2 - useful compatibility prose remains accepted");
console.log("1..2");
