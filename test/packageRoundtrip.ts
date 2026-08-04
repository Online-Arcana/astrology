import { isDeepStrictEqual } from "node:util";
import { open, pack, readMeta } from "astral-packager";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const point = (sign: string): unknown => ({ position: { value: { sign } } });
const value = {
  schema: "integration-test/1.0.0",
  "astral-calculation": {
    system: {
      points: {
        sun: point("capricorn"),
        moon: point("virgo"),
        ascendant: point("capricorn"),
        midheaven: point("libra"),
        descendant: point("cancer"),
        imum_coeli: point("aries"),
      },
    },
  },
  nested: {
    unicode: "星と月",
    values: [1, true, null, "complete"],
  },
};
const password = "Crow-Nebula!Quartz-7391";
const source = JSON.stringify(value);

const packed = await pack(source, password);
assert(new TextDecoder().decode(packed.bytes.slice(0, 8)) === "ASTRPKG4", "packager must emit ASTRPKG4");
assert(packed.pubRaw.byteLength === 32, "package must expose the exact 32-byte Ed25519 public key");
assert(packed.pub.length === 43, "package must expose the canonical public-key display");

const meta = readMeta(packed.bytes);
assert(meta.ver === 4, "public metadata must report container version 4");
assert(meta.signs.solar === "capricorn", "public solar sign must survive packaging");
assert(meta.signs.lunar === "virgo", "public lunar sign must survive packaging");
assert(meta.signs.ascending === "capricorn", "public ascending sign must survive packaging");
assert(meta.signs.midheaven === "libra", "public midheaven sign must survive packaging");
assert(meta.signs.descending === "cancer", "public descending sign must survive packaging");
assert(meta.signs.imumCoeli === "aries", "public Imum Coeli sign must survive packaging");

const restored = await open(packed.bytes, password);
try {
  assert(isDeepStrictEqual(restored.json, value), "open must reconstruct the complete semantic JSON value");
  assert(restored.pub === packed.pub, "open must regenerate the package identity");
  assert(restored.pubRaw.every((byte, index) => byte === packed.pubRaw[index]), "open must regenerate the exact public-key bytes");
} finally {
  restored.id.drop();
}

let rejected = false;
try {
  await open(packed.bytes, "Wrong-Password!Quartz-7391");
} catch (cause: unknown) {
  rejected = cause instanceof Error && /Wrong password or damaged container/u.test(cause.message);
}
assert(rejected, "wrong passwords must fail without exposing the payload");

console.log("ok 1 - astral-packager encrypts and reconstructs a complete chart payload");
console.log("1..1");
