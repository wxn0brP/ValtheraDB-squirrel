import { Router } from "@wxn0brp/falcon-frame";
import { TopologyManager } from "./topology.js";
import { AuthConfig, SquirrelConfig } from "./types.js";
export declare class Squirrel {
    app: Router;
    authConfig: AuthConfig;
    config: SquirrelConfig;
    topology: TopologyManager;
    _ready: boolean;
    constructor(app: Router, authConfig: AuthConfig, config: SquirrelConfig);
    init(seeds: string[]): Promise<void>;
    setupRoutes(): void;
}
