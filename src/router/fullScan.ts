import { VQueryT } from "@wxn0brp/db-core/types/query";
import { Squirrel } from "../squirrel";
import { FFResponse } from "@wxn0brp/falcon-frame";
import { ValtheraRemote } from "@wxn0brp/db-client";

export async function fullScanReq(squirrel: Squirrel, data: VQueryT.FindOne, op: "find" | "findOne", res: FFResponse) {
    const servers = [...squirrel.topology.servers.entries()];
    servers.sort((a, b) => a[0].localeCompare(b[0]));

    const findResult = [];

    for (const [serverId, server] of servers) {
        const client = new ValtheraRemote({
            ...squirrel.authConfig,
            url: server.host
        });

        console.log("[V-SQR-05-01] Querying server:", serverId);

        if (op === "find") {
            const searchResult = await client.find(data);
            findResult.push(...searchResult);
        } else {
            const searchResult = await client.findOne(data);
            if (searchResult) {
                findResult.push(searchResult);
                break;
            }
        }
    }

    res.json({
        err: false,
        result: op === "find" ?
            findResult : findResult[0] ?
                findResult[0] : null
    })
}
