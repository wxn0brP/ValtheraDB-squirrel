export function parseServerInfo(url) {
    const u = new URL(url);
    const id = u.username;
    const password = u.password;
    u.username = "";
    u.password = "";
    const info = {
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
