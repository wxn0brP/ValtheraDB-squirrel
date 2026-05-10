import { Router } from "@wxn0brp/falcon-frame";
import { registerGetData } from "./router/getData";
import { registerDbOp } from "./router/op";
import { TopologyManager } from "./topology";
import { AuthConfig, SquirrelConfig } from "./types";
import { logger } from "./logger";

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
            replicationEnabled: false,
            replicationFactor: 3,
            ...this.config
        }
    }

    async init(seeds: string[]) {
        logger.info("SYSTEM", "[V-SQR-09-02] Initializing Squirrel with seeds:", seeds.length);
        await this.topology.init(seeds, this.authConfig);
        logger.info("SYSTEM", "[V-SQR-09-03] Squirrel initialized, servers:", this.topology.servers.size, "epochs:", this.topology.epochs.length);

        if (this.config.replicationEnabled) {
            logger.info("SYSTEM", "[V-SQR-09-04] Replication enabled. Factor:", this.config.replicationFactor);
        }
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

            next();
        });

        registerDbOp(this);
        registerGetData(this);
        logger.info("SYSTEM", "[V-SQR-09-01] Routes registered");
    }
}
