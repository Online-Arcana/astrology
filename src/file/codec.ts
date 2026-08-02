const strip = (value: string, prefix: string): string => value.startsWith(prefix) ? value.slice(prefix.length) : value;

export const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const ownedBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

export const base64url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

export const unbase64url = (value: string): Uint8Array => {
  const raw = strip(value, "base64url:").replaceAll("-", "+").replaceAll("_", "/");
  const padded = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
