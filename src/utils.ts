import { ServerInfo } from "./types";

export function parseServerInfo(url: string): ServerInfo {
    const u = new URL(url);
    const id = u.username;
    u.username = "";
    u.password = "";

    return {
        id: id,
        host: u.toString()
    };
}
