import { Router } from "@wxn0brp/falcon-frame";
import { TopologyManager } from "./topology";
import { AuthConfig, SquirrelConfig } from "./types";
import { registerDbOp } from "./router/op";

export class Squirrel {
    topology = new TopologyManager();

    constructor(
        public app: Router,
        public authConfig: AuthConfig,
        public config: SquirrelConfig
    ) {
        this.setupRoutes();
        this.config = {
            allowBackupServer: true,
            allowFullScan: true,
            ...this.config
        }
    }

    async init(seeds: string[]) {
        await this.topology.init(seeds, this.authConfig);
    }

    setupRoutes() {
        registerDbOp(this);
    }
}
