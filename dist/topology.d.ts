import { AuthConfig, Epoch, ServerEpochInfo, ServerInfo } from "./types.js";
export declare class TopologyManager {
    epochs: Epoch[];
    servers: Map<string, ServerInfo>;
    init(seeds: string[], cfg: AuthConfig): Promise<void>;
    addServer(server: ServerInfo): void;
    _getConfig(url: string, cfg: AuthConfig): Promise<void>;
    getServerForId(id: string): ServerEpochInfo;
    getCatchupServer(excludedId: string, epoch: Epoch): Promise<ServerInfo>;
    isServerUp(host: string): Promise<boolean>;
    getEpoch(timestamp: number): Epoch;
    _hash(key: string): number;
    initNewEpoch(cfg: AuthConfig): Promise<void>;
}
