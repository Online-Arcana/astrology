import type {
  AstralAuthority,
  AstralFile,
  EncodedPublicKey,
  EncodedSignature,
  KeyId,
  SignedDigest,
} from "../types/file.js";
import { canonicalBytes } from "./canonical.js";
import { base64url, ownedBuffer, unbase64url } from "./codec.js";
import { digest } from "./hash.js";

interface Signable {
  schema: AstralFile["schema"];
  "astral-calculation": AstralFile["astral-calculation"];
  "astral-chart": AstralFile["astral-chart"];
  crc: AstralFile["crc"];
}

const signable = (file: AstralFile): Signable => ({
  schema: file.schema,
  "astral-calculation": file["astral-calculation"],
  "astral-chart": file["astral-chart"],
  crc: file.crc,
});

export interface AuthorityKeys {
  privatePkcs8: string;
  publicRaw: string;
}

export const sign = async (file: AstralFile, issuer: string, keys: AuthorityKeys, generatedAt: string): Promise<AstralFile> => {
  const bytes = canonicalBytes(signable(file));
  const publicRaw = unbase64url(keys.publicRaw);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    ownedBuffer(unbase64url(keys.privatePkcs8)),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, ownedBuffer(bytes)));
  const authority: AstralAuthority = {
    schema: "astral-authority/1.0.0",
    algorithm: "Ed25519",
    canonicalisation: "RFC8785",
    encoding: "utf-8",
    scope: ["schema", "astral-calculation", "astral-chart", "crc"],
    issuer,
    keyId: `sha256:${await digest("SHA-256", publicRaw)}` as KeyId,
    publicKey: `base64url:${base64url(publicRaw)}` as EncodedPublicKey,
    signature: `base64url:${base64url(signature)}` as EncodedSignature,
    signedSha256: `sha256:${await digest("SHA-256", bytes)}` as SignedDigest,
    generatedAt,
  };
  return { ...file, authority };
};

export const signatureValid = async (file: AstralFile): Promise<boolean> => {
  if (!file.authority) return false;
  const bytes = canonicalBytes(signable(file));
  const publicRaw = unbase64url(file.authority.publicKey);
  const expectedKeyId = `sha256:${await digest("SHA-256", publicRaw)}`;
  if (file.authority.keyId !== expectedKeyId) return false;
  const publicKey = await crypto.subtle.importKey(
    "raw",
    ownedBuffer(publicRaw),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const digestValue = `sha256:${await digest("SHA-256", bytes)}`;
  if (digestValue !== file.authority.signedSha256) return false;
  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    ownedBuffer(unbase64url(file.authority.signature)),
    ownedBuffer(bytes),
  );
};
