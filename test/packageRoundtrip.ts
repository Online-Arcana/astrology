import { isDeepStrictEqual } from "node:util";
import { chartWheelCalculationFromPublicMeta } from "astral-chart-wheel";
import { open, pack, readMeta, readWheel } from "astral-packager";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const point = (sign: string, longitudeDegrees: number): unknown => ({
  position: { value: { sign, longitudeDegrees } },
});
const houses = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  const cusp = (294 + index * 30) % 360;
  const end = (294 + (index + 1) * 30) % 360;
  return [String(number), {
    number,
    cusp: { value: { longitudeDegrees: cusp } },
    end: { value: { longitudeDegrees: end } },
  }];
}));
const value = {
  schema: "integration-test/1.0.0",
  "astral-calculation": {
    subject: { providedName: "Not public" },
    birth: { date: "1991-01-15", time: "12:34:00" },
    settings: {
      primaryHouseSystem: "placidus",
    },
    provenance: {
      calculationFingerprint: "sha256:package-public-wheel-roundtrip",
    },
    system: {
      points: {
        sun: point("capricorn", 281),
        moon: point("virgo", 166),
        mars: point("taurus", 42),
        ascendant: point("capricorn", 294),
        midheaven: point("libra", 202),
        descendant: point("cancer", 114),
        imum_coeli: point("aries", 22),
      },
      houses: {
        placidus: {
          status: "calculated",
          houses,
        },
      },
      aspects: [
        {
          id: "sun-trine-mars",
          a: "sun",
          b: "mars",
          kind: "trine",
          class: "major",
          character: "flowing",
        },
      ],
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
assert(new TextDecoder().decode(packed.bytes.slice(0, 8)) === "ASTRPKG5", "packager must emit ASTRPKG5");
assert(packed.pubRaw.byteLength === 32, "package must expose the exact 32-byte Ed25519 public key");
assert(packed.pub.length === 43, "package must expose the canonical public-key display");

const meta = readMeta(packed.bytes);
assert(meta.ver === 5, "public metadata must report container version 5");
assert(meta.signs.solar === "capricorn", "public solar sign must survive packaging");
assert(meta.signs.lunar === "virgo", "public lunar sign must survive packaging");
assert(meta.signs.ascending === "capricorn", "public ascending sign must survive packaging");
assert(meta.signs.midheaven === "libra", "public midheaven sign must survive packaging");
assert(meta.signs.descending === "cancer", "public descending sign must survive packaging");
assert(meta.signs.imumCoeli === "aries", "public Imum Coeli sign must survive packaging");

// This is intentionally before open(): the natal wheel must be reconstructable
// from the clear authenticated identity header without decrypting or decoding
// the compressed chart payload.
const publicWheel = readWheel(packed.bytes);
assert(publicWheel !== null, "packaged Astrology charts must expose public wheel geometry");
assert(publicWheel.calculationFingerprint === "sha256:package-public-wheel-roundtrip", "public wheel must retain calculation identity");
assert(publicWheel.points.sun === 281, "public wheel must retain solar longitude");
assert(publicWheel.points.moon === 166, "public wheel must retain lunar longitude");
assert(publicWheel.points.ascendant === 294, "public wheel must retain Ascendant longitude");
assert(publicWheel.points.midheaven === 202, "public wheel must retain Midheaven longitude");
assert(publicWheel.points.descendant === 114, "public wheel must retain Descendant longitude");
assert(publicWheel.points.imum_coeli === 22, "public wheel must retain Imum Coeli longitude");
assert(publicWheel.houses.houses["1"]?.cuspLongitudeDegrees === 294, "public wheel must retain selected house cusps");
assert(publicWheel.aspects[0]?.id === "sun-trine-mars", "public wheel must retain rendered aspect identity");

const wheelInput = chartWheelCalculationFromPublicMeta(publicWheel);
assert(wheelInput.provenance.calculationFingerprint === publicWheel.calculationFingerprint, "shared wheel adapter must retain the package fingerprint");
assert(wheelInput.settings.primaryHouseSystem === "placidus", "shared wheel adapter must retain the selected house system");
assert(wheelInput.system.points.ascendant.position.value?.longitudeDegrees === 294, "shared wheel adapter must reconstruct the Ascendant angle");
assert(wheelInput.system.houses.placidus.houses["1"].cusp.value?.longitudeDegrees === 294, "shared wheel adapter must reconstruct house geometry");
assert(wheelInput.system.aspects[0]?.kind === "trine", "shared wheel adapter must reconstruct aspect geometry inputs");

const headSize = new DataView(packed.bytes.buffer, packed.bytes.byteOffset + 28, 4).getUint32(0, false);
const publicHeader = new TextDecoder().decode(packed.bytes.slice(92, headSize));
assert(!publicHeader.includes("Not public"), "public wheel metadata must not expose the subject name");
assert(!publicHeader.includes("1991-01-15"), "public wheel metadata must not expose the birth date");
assert(!publicHeader.includes("12:34:00"), "public wheel metadata must not expose the birth time");

const restored = await open(packed.bytes, password);
try {
  const reconstructed: unknown = JSON.parse(restored.source);
  const materialised: unknown = JSON.parse(JSON.stringify(restored.json));
  assert(isDeepStrictEqual(reconstructed, value), "open must reconstruct the complete canonical JSON source");
  assert(isDeepStrictEqual(materialised, value), "decoded safe objects must preserve the complete semantic JSON value");
  assert(restored.pub === packed.pub, "open must regenerate the package identity");
  assert(restored.pubRaw.every((byte, index) => byte === packed.pubRaw[index]), "open must regenerate the exact public-key bytes");
  assert(isDeepStrictEqual(restored.wheel, publicWheel), "decrypted chart must reproduce the authenticated public wheel metadata exactly");
} finally {
  restored.id.drop();
}

let rejected = false;
try {
  await open(packed.bytes, "Wrong-Password!Quartz-7391");
} catch (cause: unknown) {
  rejected = cause instanceof Error && /Wrong password or damaged container/u.test(cause.message);
}
assert(rejected, "wrong passwords must fail without exposing the encrypted payload");

console.log("ok 1 - astral-packager exposes a reconstructable public wheel and preserves encrypted chart round-trip");
console.log("1..1");
