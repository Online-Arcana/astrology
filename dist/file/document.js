import { sign } from "./authority.js";
import { assembleUnsigned } from "./integrity.js";
export const assembleAstralFile = async (calculation, chart, authority = null) => {
    const unsigned = await assembleUnsigned(calculation, chart);
    return authority === null
        ? unsigned
        : sign(unsigned, authority.issuer, authority.keys, authority.generatedAt);
};
//# sourceMappingURL=document.js.map