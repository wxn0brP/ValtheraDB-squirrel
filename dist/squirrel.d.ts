import type { ValtheraCompatible } from "@wxn0brp/db-core/types/valthera";
import { Router } from "@wxn0brp/falcon-frame";
import { TopologyManager } from "./topology.js";
import { AuthConfig, SquirrelConfig } from "./types.js";
export type SquirrelClientProvider = (host: string, authConfig: AuthConfig) => ValtheraCompatible;
export declare class Squirrel {
    app: Router;
    authConfig: AuthConfig;
    config: SquirrelConfig;
    clientProvider: SquirrelClientProvider;
    topology: TopologyManager;
    _ready: boolean;
    clients: Map<string, ValtheraCompatible>;
    constructor(app: Router, authConfig: AuthConfig, config: SquirrelConfig, clientProvider?: SquirrelClientProvider);
    getClient(host: string): ValtheraCompatible;
    init(seeds: string[]): Promise<void>;
    setupRoutes(): void;
}
