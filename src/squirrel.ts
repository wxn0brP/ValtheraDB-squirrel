import { Router } from "@wxn0brp/falcon-frame";
import { registerGetData } from "./router/getData";
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
            allowCatchupServer: true,
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
        this.app.use((req, res, next) => {
            const { auth, db } = req.body;
            const authHeader = req.headers.authorization;

            if (!db)
                return res.status(400).json({ err: true, msg: "Missing db" });

            const authToken = auth || authHeader?.replace("Bearer ", "");

            if (!authToken)
                return res.status(401).json({ err: true, msg: "Missing auth" });

            if (db !== this.authConfig.name)
                return res.status(400).json({ err: true, msg: "Unauthorized" });

            if (authToken !== this.authConfig.auth)
                return res.status(401).json({ err: true, msg: "Unauthorized" });
        });

        registerDbOp(this);
        registerGetData(this);
        console.log("[V-SQR-10-01] Routes registered");
    }
}
