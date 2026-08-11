const strip = (value, prefix) => value.startsWith(prefix) ? value.slice(prefix.length) : value;
export const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
export const ownedBuffer = (bytes) => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
};
export const base64url = (bytes) => {
    let binary = "";
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};
export const unbase64url = (value) => {
    const raw = strip(value, "base64url:").replaceAll("-", "+").replaceAll("_", "/");
    const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
//# sourceMappingURL=codec.js.map