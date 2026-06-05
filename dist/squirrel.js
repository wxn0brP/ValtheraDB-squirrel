import { ValtheraRemote } from "@wxn0brp/db-client";
import { logger } from "./logger.js";
import { registerGetData } from "./router/getData.js";
import { registerDbOp } from "./router/op.js";
import { TopologyManager } from "./topology.js";
export class Squirrel {
    app;
    authConfig;
    config;
    clientProvider;
    topology = new TopologyManager(this);
    _ready = false;
    clients = new Map();
    constructor(app, authConfig, config, clientProvider = (host, authConfig) => new ValtheraRemote({
        ...authConfig,
        url: host
    })) {
        this.app = app;
        this.authConfig = authConfig;
        this.config = config;
        this.clientProvider = clientProvider;
        this.setupRoutes();
        this.config = {
            allowCatchupServer: true,
            allowFullScan: true,
            replicationEnabled: false,
            replicationFactor: 3,
            ...this.config
        };
    }
    getClient(host) {
        if (!this.clients.has(host)) {
            this.clients.set(host, this.clientProvider(host, this.authConfig));
        }
        return this.clients.get(host);
    }
    async init(seeds) {
        logger.info("SYSTEM", "[V-SQR-09-02] Initializing Squirrel with seeds:", seeds.length);
        await this.topology.init(seeds);
        logger.info("SYSTEM", "[V-SQR-09-03] Squirrel initialized, servers:", this.topology.servers.size, "epochs:", this.topology.epochs.length);
        if (this.config.replicationEnabled) {
            logger.info("SYSTEM", "[V-SQR-09-04] Replication enabled. Factor:", this.config.replicationFactor);
        }
        this._ready = true;
    }
    setupRoutes() {
        this.app.use((req, res, next) => {
            if (!this._ready)
                return res.status(503).json({ err: true, msg: "Squirrel not ready" });
            next();
        });
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
