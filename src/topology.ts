import { ValtheraRemote } from "@wxn0brp/db-client";
import { Epoch, AuthConfig, ServerInfo, SquirrelConfigDbEntry, ServerEpochInfo } from "./types";
import { convertIdToUnix } from "@wxn0brp/db-core/utils/id";
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
            if (server.id) this.addServer(server);

            const isUp = await this.isServerUp(server.host);
            if (!isUp) {
                failed++;
                continue;
            }
            await this._getConfig(server.host, cfg);
        }

        if (failed === seeds.length)
            throw new Error("[V-SQR-01-02] No servers available");

        if (this.servers.size === 0)
            throw new Error("[V-SQR-01-03] No servers found");

        if (this.epochs.length)
            this.epochs.sort((a, b) => a.start - b.start);
        else {
            console.log("[V-SQR-02-10] New epoch required. No epochs found");
            await this.initNewEpoch(cfg);
            console.log("[V-SQR-02-11] New epoch initialized. Servers:", this.epochs[this.epochs.length - 1].serverIds);
        }

        const epochsServers = this.epochs[this.epochs.length - 1].serverIds;
        const allServers = [...this.servers.keys()];
        const notChanged = allServers.every(s => epochsServers.includes(s));

        if (!notChanged) {
            console.log("[V-SQR-02-21] New epoch required. Servers list changed");
            await this.initNewEpoch(cfg);
            console.log("[V-SQR-02-22] New epoch initialized. Servers:", this.epochs[this.epochs.length - 1].serverIds);
        }
    }

    addServer(server: ServerInfo) {
        if (this.servers.has(server.id)) return;
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
        if (!epoch || epoch.serverIds.length === 0)
            return null;

        const idx = this._hash(id) % epoch.serverIds.length;
        const targetId = epoch.serverIds[idx];
        const server = this.servers.get(targetId);
        if (!server)
            return null;

        return { server, epoch };
    }

    async getBackupServer(excludedId: string, epoch: Epoch) {
        for (let i = 1; i < epoch.serverIds.length; i++) {
            const idx = (this._hash(excludedId) + i) % epoch.serverIds.length;
            const backupId = epoch.serverIds[idx];
            if (backupId !== excludedId) {
                const backup = this.servers.get(backupId);
                const isUp = await this.isServerUp(backup.host);
                if (isUp)
                    return backup;
            }
        }
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

        const servers = [...this.servers.keys()];
        if (servers.length === 0)
            throw new Error("[V-SQR-03-01] No servers found");
        servers.sort((a, b) => a.localeCompare(b));

        const newEpoch: Epoch = {
            start: now,
            serverIds: servers
        };
        this.epochs.push(newEpoch);

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
            } catch {
                console.log("[V-SQR-03-02] Failed to add epoch to server:", server);
            }
        }
    }
}
