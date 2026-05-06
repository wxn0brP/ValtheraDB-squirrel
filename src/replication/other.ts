import { ValtheraRemote } from "@wxn0brp/db-client";
import { VQuery } from "@wxn0brp/db-core/types/query";
import { Squirrel } from "../squirrel";
import { ServerInfo } from "../types";
import { getReplicaServers } from "./utils";
import { squirrelTimeKey } from "./vars";
import { Data } from "@wxn0brp/db-core/types/data";

export async function replicationOther(squirrel: Squirrel, op: string, id: string, data: VQuery) {
    console.log(`[V-SQR-13-01] replicationOther, op: ${op}, id: ${id}`);
    let servers: ServerInfo[] = [];
    if (id) {
        servers = getReplicaServers(squirrel, id);
        console.log(`[V-SQR-13-02] replicas count: ${servers.length}`);
        if (!servers.length) return [];
    } else {
        servers = [...squirrel.topology.servers.values()];
        console.log(`[V-SQR-13-03] total servers: ${servers.length}`);
    }

    if (!servers.length) return [];

    if (data.updater) data.updater[squirrelTimeKey] = Date.now();
    if (data.data) data.data[squirrelTimeKey] = Date.now();
    console.log(`[V-SQR-13-04] added ${squirrelTimeKey} to data/updater`);

    let responses: Data[] = [];
    for (const server of servers) {
        const client = new ValtheraRemote({
            ...squirrel.authConfig,
            url: server.host
        });
        console.log(`[V-SQR-13-05] calling ${op} on ${server.host}`);
        responses.push(await client[op](data));
    }
    responses = responses.flat();

    console.log(`[V-SQR-13-06] returning ${responses.length} responses`);

    if (op.includes("One") || op === "add") {
        delete responses[0][squirrelTimeKey];
        return responses[0];
    }
    else
        return responses.map(d => {
            delete d[squirrelTimeKey];
            return d;
        });
}
