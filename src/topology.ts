import { ValtheraRemote } from "@wxn0brp/db-client";
import { convertIdToUnix } from "@wxn0brp/db-core/utils/id";
import { AuthConfig, Epoch, ServerEpochInfo, ServerInfo, SquirrelConfigDbEntry } from "./types";
import { parseServerInfo } from "./utils";

export class TopologyManager {
    epochs: Epoch[] = [];
    servers = new Map<string, ServerInfo>();

    async init(seeds: string[], cfg: AuthConfig) {
        if (seeds.length === 0)
            throw new Error("[V-SQR-01-01] No seeds provided");

        let failed = 0;
        for (const seed of seeds) {
            const server = parseServerInfo(seed);
            if (server.id) {
                console.log("[V-SQR-01-02] Seed parsed, adding server:", server.id);
                this.addServer(server);
            }

            console.log("[V-SQR-01-03] Checking server availability:", seed);
            const isUp = await this.isServerUp(server.host);
            if (!isUp) {
                console.log("[V-SQR-01-04] Server is down:", seed);
                failed++;
                continue;
            }
            console.log("[V-SQR-01-05] Server is up:", seed);
            await this._getConfig(server.host, cfg);
            console.log("[V-SQR-01-06] Successfully fetched config from:", seed);
        }

        if (failed === seeds.length)
            throw new Error("[V-SQR-01-07] No servers available");

        if (this.servers.size === 0)
            throw new Error("[V-SQR-01-08] No servers found");

        if (this.epochs.length)
            this.epochs.sort((a, b) => a.start - b.start);
        else {
            console.log("[V-SQR-01-09] New epoch required. No epochs found");
            await this.initNewEpoch(cfg);
            console.log("[V-SQR-01-10] New epoch initialized. Servers:", this.epochs[this.epochs.length - 1].serverIds);
        }

        const epochsServers = this.epochs[this.epochs.length - 1].serverIds;
        const allServers = [...this.servers.keys()];
        const notChanged = allServers.every(s => epochsServers.includes(s));

        if (!notChanged) {
            console.log("[V-SQR-01-11] New epoch required. Servers list changed");
            await this.initNewEpoch(cfg);
            console.log("[V-SQR-01-12] New epoch initialized. Servers:", this.epochs[this.epochs.length - 1].serverIds);
        }
    }

    addServer(server: ServerInfo) {
        if (this.servers.has(server.id)) return;
        console.log("[V-SQR-02-01] Adding server to topology:", server.id, server.host);
        this.servers.set(server.id, server);
    }

    async _getConfig(url: string, cfg: AuthConfig) {
        try {
            const client = new ValtheraRemote({
                ...cfg,
                url
            });

            const config: SquirrelConfigDbEntry[] = await client.find({
                collection: "__squirrel",
                search: {}
            });

            if (config.length === 0) return;

            const servers = config.filter(d => d._id === "server");
            servers.forEach(d => this.addServer(parseServerInfo(d.v)));

            const epochs = config.filter(d => d._id === "epoch");
            epochs.forEach(d => {
                const data = d.v.split(",");
                const start = +data.shift();
                if (this.epochs.find(e => e.start === start))
                    return;
                this.epochs.push({
                    start,
                    serverIds: data
                });
            });
        } catch { }
    }

    getServerForId(id: string): ServerEpochInfo {
        const epoch = this.getEpoch(convertIdToUnix(id));
        if (!epoch || epoch.serverIds.length === 0) {
            console.log("[V-SQR-03-01] No epoch or empty serverIds for id:", id);
            return null;
        }

        const idx = this._hash(id) % epoch.serverIds.length;
        const targetId = epoch.serverIds[idx];
        console.log("[V-SQR-03-02] Resolving server for id:", id, "hash:", idx, "target:", targetId);
        const server = this.servers.get(targetId);
        if (!server) {
            console.log("[V-SQR-03-03] Server not found for id:", id, "target:", targetId);
            return null;
        }

        return { server, epoch };
    }

    async getCatchupServer(excludedId: string, epoch: Epoch) {
        console.log("[V-SQR-04-01] Searching for catchup server, excluding:", excludedId);
        for (let i = 1; i < epoch.serverIds.length; i++) {
            const idx = (this._hash(excludedId) + i) % epoch.serverIds.length;
            const catchupId = epoch.serverIds[idx];
            if (catchupId !== excludedId) {
                const catchup = this.servers.get(catchupId);
                console.log("[V-SQR-04-02] Checking catchup candidate:", catchupId);
                const isUp = await this.isServerUp(catchup.host);
                if (isUp) {
                    console.log("[V-SQR-04-03] Found catchup server:", catchupId);
                    return catchup;
                }
            }
        }
        console.log("[V-SQR-04-04] No catchup server found for excluded:", excludedId);
        return null;
    }

    async isServerUp(host: string) {
        try {
            const res = await fetch(host, {
                method: "GET",
                signal: AbortSignal.timeout(1500)
            });
            return !!res.status;
        } catch {
            return false;
        }
    }

    getEpoch(timestamp: number) {
        for (let i = this.epochs.length - 1; i >= 0; i--) {
            const e = this.epochs[i];
            const next = this.epochs[i + 1];
            if (e.start <= timestamp && (!next || next.start > timestamp))
                return e;
        }
        return null;
    }

    _hash(key: string) {
        let h = 0;
        for (let i = 0; i < key.length; i++)
            h = (h * 31 + key.charCodeAt(i)) | 0;
        return Math.abs(h);
    }

    async initNewEpoch(cfg: AuthConfig) {
        const now = Date.now();
        console.log("[V-SQR-05-01] Creating new epoch at:", now);

        const servers = [...this.servers.keys()];
        if (servers.length === 0)
            throw new Error("[V-SQR-05-02] No servers found");
        servers.sort((a, b) => a.localeCompare(b));
        console.log("[V-SQR-05-03] Servers in new epoch:", servers);

        const newEpoch: Epoch = {
            start: now,
            serverIds: servers
        };
        this.epochs.push(newEpoch);

        let failed = 0;
        for (const server of servers) {
            const client = new ValtheraRemote({
                ...cfg,
                url: this.servers.get(server).host
            })
            try {
                await client.add({
                    collection: "__squirrel",
                    data: {
                        _id: "epoch",
                        v: newEpoch.start + "," + newEpoch.serverIds.join(",")
                    }
                });
                console.log("[V-SQR-05-04] Epoch added to server:", server);
            } catch (e) {
                console.error(e);
                console.log("[V-SQR-05-05] Failed to add epoch to server:", server);
                failed++;
            }
        }
        if (failed === servers.length)
            return console.log("[V-SQR-05-06] Failed to add epoch to all servers");
        console.log("[V-SQR-05-07] Epoch created successfully:", newEpoch.start, "servers:", newEpoch.serverIds.length);
    }
}
