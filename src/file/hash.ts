import { hex } from "./codec.js";

export const digest = async (algorithm: "SHA-256" | "SHA-512", bytes: Uint8Array): Promise<string> => {
  const result = await crypto.subtle.digest(algorithm, bytes);
  return hex(new Uint8Array(result));
};
