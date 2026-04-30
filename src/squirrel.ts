import { Router } from "@wxn0brp/falcon-frame";
import { registerDbOp } from "./router/op";
import { TopologyManager } from "./topology";
import { AuthConfig, SquirrelConfig } from "./types";

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
        console.log("[V-SQR-09-01] Initializing Squirrel with seeds:", seeds.length);
        await this.topology.init(seeds, this.authConfig);
        console.log("[V-SQR-09-02] Squirrel initialized, servers:", this.topology.servers.size, "epochs:", this.topology.epochs.length);
    }

    setupRoutes() {
        registerDbOp(this);
        console.log("[V-SQR-10-01] Routes registered");
    }
}
