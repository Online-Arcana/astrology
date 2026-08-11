import { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { type ApiRuntime } from "./api.js";
export interface HttpServerOptions {
    host: string;
    port: number;
    bodyLimitBytes: number;
}
export declare const createAstralServer: (runtime: ApiRuntime, input?: Partial<HttpServerOptions>) => {
    server: Server;
    options: HttpServerOptions;
};
export declare const listenAstralServer: (runtime: ApiRuntime, input?: Partial<HttpServerOptions>) => Promise<{
    server: Server;
    address: AddressInfo;
}>;
//# sourceMappingURL=server.d.ts.map