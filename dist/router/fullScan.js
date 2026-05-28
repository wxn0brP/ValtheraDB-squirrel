import { ValtheraRemote } from "@wxn0brp/db-client";
import { logger } from "../logger.js";
export async function fullScanReq(squirrel, data, op, res) {
    const servers = [...squirrel.topology.servers.entries()];
    servers.sort((a, b) => a[0].localeCompare(b[0]));
    const findResult = [];
    for (const [serverId, server] of servers) {
        const isUp = await squirrel.topology.isServerUp(server.host);
        if (!isUp) {
            logger.warn("FULLSCAN", "[V-SQR-07-01] Server down, skipping:", serverId);
            continue;
        }
        const client = new ValtheraRemote({
            ...squirrel.authConfig,
            url: server.host
        });
        logger.debug("FULLSCAN", "[V-SQR-07-02] Querying server:", serverId, "op:", op);
        if (op.includes("One")) {
            const opResult = await client[op](data);
            if (opResult) {
                findResult.push(opResult);
                logger.debug("FULLSCAN", "[V-SQR-07-03] Found result on server:", serverId);
                break;
            }
        }
        else {
            const opResult = await client[op](data);
            findResult.push(...opResult);
            logger.debug("FULLSCAN", "[V-SQR-07-04] Found results on server:", serverId, "count:", opResult.length);
        }
    }
    logger.info("FULLSCAN", "[V-SQR-07-05] Full scan completed, total results:", findResult.length);
    const responseData = op === "find" ?
        findResult : findResult[0] ?
        findResult[0] : null;
    if (!res)
        return responseData;
    res.json({
        err: false,
        result: responseData
    });
}
