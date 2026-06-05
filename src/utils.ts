import { ServerInfo } from "./types";

export function parseServerInfo(url: string): ServerInfo {
    const u = new URL(url);
    const id = u.username;
    const password = u.password;
    u.username = "";
    u.password = "";

    const info: ServerInfo = {
        id,
        host: u.toString()
    };

    if (password) {
        info.redirectHost = decodeURIComponent(password);
        if (!info.redirectHost.startsWith("http"))
            info.redirectHost = "https://" + info.redirectHost;
    }

    return info;
}
