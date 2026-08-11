import { canonicalBytes } from "./canonical.js";
import { base64url, ownedBuffer, unbase64url } from "./codec.js";
import { digest } from "./hash.js";
const signable = (file) => ({
    schema: file.schema,
    "astral-calculation": file["astral-calculation"],
    "astral-chart": file["astral-chart"],
    crc: file.crc,
});
export const sign = async (file, issuer, keys, generatedAt) => {
    const bytes = canonicalBytes(signable(file));
    const publicRaw = unbase64url(keys.publicRaw);
    const privateKey = await crypto.subtle.importKey("pkcs8", ownedBuffer(unbase64url(keys.privatePkcs8)), { name: "Ed25519" }, false, ["sign"]);
    const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, ownedBuffer(bytes)));
    const authority = {
        schema: "astral-authority/1.0.0",
        algorithm: "Ed25519",
        canonicalisation: "RFC8785",
        encoding: "utf-8",
        scope: ["schema", "astral-calculation", "astral-chart", "crc"],
        issuer,
        keyId: `sha256:${await digest("SHA-256", publicRaw)}`,
        publicKey: `base64url:${base64url(publicRaw)}`,
        signature: `base64url:${base64url(signature)}`,
        signedSha256: `sha256:${await digest("SHA-256", bytes)}`,
        generatedAt,
    };
    return { ...file, authority };
};
export const signatureValid = async (file) => {
    if (!file.authority)
        return false;
    const bytes = canonicalBytes(signable(file));
    const publicRaw = unbase64url(file.authority.publicKey);
    const expectedKeyId = `sha256:${await digest("SHA-256", publicRaw)}`;
    if (file.authority.keyId !== expectedKeyId)
        return false;
    const publicKey = await crypto.subtle.importKey("raw", ownedBuffer(publicRaw), { name: "Ed25519" }, false, ["verify"]);
    const digestValue = `sha256:${await digest("SHA-256", bytes)}`;
    if (digestValue !== file.authority.signedSha256)
        return false;
    return crypto.subtle.verify("Ed25519", publicKey, ownedBuffer(unbase64url(file.authority.signature)), ownedBuffer(bytes));
};
//# sourceMappingURL=authority.js.map