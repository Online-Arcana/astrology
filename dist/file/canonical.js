const fail = (kind) => {
    throw new TypeError(`Value is not canonical JSON: ${kind}`);
};
const object = (value) => {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
        return fail("non-plain object");
    const record = value;
    return `{${Object.keys(record)
        .sort()
        .map((key) => {
        const item = record[key];
        if (item === undefined)
            return fail("undefined property");
        return `${JSON.stringify(key)}:${write(item)}`;
    })
        .join(",")}}`;
};
const write = (value) => {
    if (value === null)
        return "null";
    if (typeof value === "boolean" || typeof value === "string")
        return JSON.stringify(value);
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            return fail("non-finite number");
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map(write).join(",")}]`;
    if (typeof value === "object")
        return object(value);
    return fail(typeof value);
};
export const canonicalise = (value) => write(value);
export const canonicalBytes = (value) => new TextEncoder().encode(canonicalise(value));
//# sourceMappingURL=canonical.js.map