export interface ServerInfo {
    id: string;
    host: string;
}

export interface Epoch {
    start: number;
    serverIds: string[];
}

export interface SquirrelConfigDbEntry {
    _id: "server" | "epoch";
    v: string;
}

export interface AuthConfig {
    name: string;
    auth: string;
}

export interface SquirrelConfig {
    allowFullScan?: boolean;
    allowCatchupServer?: boolean;
}

export interface ServerEpochInfo {
    server: ServerInfo;
    epoch: Epoch;
}

export interface CatchupEntry {
    to: string;
    v: any;
    time: number;
    op: string;
}
