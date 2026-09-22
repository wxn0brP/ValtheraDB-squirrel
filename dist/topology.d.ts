import { Squirrel } from "./squirrel.js";
import { Epoch, ServerEpochInfo, ServerInfo } from "./types.js";
export declare class TopologyManager {
    squirrel: Squirrel;
    epochs: Epoch[];
    servers: Map<string, ServerInfo>;
    constructor(squirrel: Squirrel);
    init(seeds: string[]): Promise<void>;
    addServer(server: ServerInfo): void;
    _getConfig(url: string): Promise<void>;
    getServerForId(id: string): ServerEpochInfo;
    getCatchupServer(excludedId: string, epoch: Epoch): Promise<ServerInfo>;
    isServerUp(host: string): Promise<boolean>;
    getEpoch(timestamp: number): Epoch;
    _hash(key: string): number;
    initNewEpoch(): Promise<void>;
}
