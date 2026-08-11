const object = (value, name) => {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error(`${name} must be an object`);
    return value;
};
const string = (value, name) => {
    if (typeof value !== "string" || value.trim().length === 0)
        throw new Error(`${name} must be a non-empty string`);
    return value;
};
const optionalString = (value, name) => {
    if (value === undefined)
        return undefined;
    return string(value, name);
};
const oneOf = (value, name, values) => {
    if (typeof value !== "string" || !values.includes(value))
        throw new Error(`${name} has an unsupported value`);
    return value;
};
const optionalOneOf = (value, name, values) => value === undefined ? undefined : oneOf(value, name, values);
const birth = (value) => {
    const raw = object(value, "birth");
    const timeAccuracy = oneOf(raw["timeAccuracy"], "birth.timeAccuracy", ["exact", "approximate", "unknown"]);
    const timeValue = raw["time"];
    const time = timeValue === null ? null : string(timeValue, "birth.time");
    if (timeAccuracy === "unknown" && time !== null)
        throw new Error("birth.time must be null when birth.timeAccuracy is unknown");
    if (timeAccuracy !== "unknown" && time === null)
        throw new Error("birth.time is required when birth.timeAccuracy is known");
    const result = {
        date: string(raw["date"], "birth.date"),
        time,
        timeAccuracy,
        placeId: string(raw["placeId"], "birth.placeId"),
    };
    const name = optionalString(raw["name"], "birth.name");
    const lang = optionalString(raw["lang"], "birth.lang");
    const preferredGender = optionalOneOf(raw["preferredGender"], "birth.preferredGender", ["male", "female", "non-binary"]);
    if (name !== undefined)
        result.name = name;
    if (lang !== undefined)
        result.lang = lang;
    if (preferredGender !== undefined)
        result.preferredGender = preferredGender;
    return result;
};
const selectedZodiac = (raw, defaults) => {
    const supplied = [];
    for (const [name, value] of [
        ["options.zodiac", raw["zodiac"]],
        ["options.primaryZodiac", raw["primaryZodiac"]],
        ["options.interpretationMode", raw["interpretationMode"]],
    ]) {
        if (value !== undefined)
            supplied.push([name, value]);
    }
    if (supplied.some(([, value]) => value === "both")) {
        throw new Error("A chart cannot contain both zodiac systems; create separate tropical and sidereal charts");
    }
    const first = supplied[0];
    const selected = first === undefined
        ? defaults.primaryZodiac
        : oneOf(first[1], first[0], ["tropical", "sidereal"]);
    for (const [name, value] of supplied.slice(1)) {
        if (oneOf(value, name, ["tropical", "sidereal"]) !== selected) {
            throw new Error("options.zodiac, options.primaryZodiac and options.interpretationMode must select the same zodiac");
        }
    }
    return selected;
};
const options = (value, defaults) => {
    if (value === undefined)
        return defaults;
    const raw = object(value, "options");
    const zodiac = selectedZodiac(raw, defaults);
    const ayanamshaValue = raw["ayanamsha"] ?? raw["siderealAyanamsha"];
    return {
        primaryZodiac: zodiac,
        ayanamsha: ayanamshaValue === undefined
            ? defaults.ayanamsha
            : oneOf(ayanamshaValue, "options.ayanamsha", ["lahiri", "fagan_bradley", "krishnamurti", "raman"]),
        interpretationMode: zodiac,
    };
};
export const parseCalculationRequest = (value, defaults) => {
    const raw = object(value, "request");
    return {
        birth: birth(raw["birth"]),
        options: options(raw["options"], defaults),
    };
};
//# sourceMappingURL=request.js.map