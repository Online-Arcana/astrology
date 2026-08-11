import { hex, ownedBuffer } from "./codec.js";
export const digest = async (algorithm, bytes) => {
    const result = await crypto.subtle.digest(algorithm, ownedBuffer(bytes));
    return hex(new Uint8Array(result));
};
//# sourceMappingURL=hash.js.map