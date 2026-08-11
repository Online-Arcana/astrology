const table = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1)
        crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    table[i] = crc >>> 0;
}
export const crc32c = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes)
        crc = (crc >>> 8) ^ (table[(crc ^ byte) & 0xff] ?? 0);
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
};
//# sourceMappingURL=crc32c.js.map