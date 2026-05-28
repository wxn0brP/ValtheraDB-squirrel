import { ValtheraRemote } from "@wxn0brp/db-client";
import { useCatchupServerLogic } from "../router/catchup.js";
import { getReplicaServers } from "./utils.js";
import { squirrelTimeKey } from "./vars.js";
import { logger } from "../logger.js";
export async function replicationOther(squirrel, op, id, data) {
    logger.debug("REPLICATION", "[V-SQR-13-01] replicationOther, op:", op, "id:", id);
    let servers = [];
    if (id) {
        servers = getReplicaServers(squirrel, id);
        logger.debug("REPLICATION", "[V-SQR-13-02] replicas count:", servers.length);
        if (!servers.length)
            return [];
    }
    else {
        servers = [...squirrel.topology.servers.values()];
        logger.debug("REPLICATION", "[V-SQR-13-03] total servers:", servers.length);
    }
    if (!servers.length)
        return [];
    if (data.updater)
        data.updater[squirrelTimeKey] = Date.now();
    if (data.data)
        data.data[squirrelTimeKey] = Date.now();
    logger.debug("REPLICATION", "[V-SQR-13-04] added", squirrelTimeKey, "to data/updater");
    let responses = [];
    let missing = [];
    for (const server of servers) {
        try {
            const client = new ValtheraRemote({
                ...squirrel.authConfig,
                url: server.host
            });
            logger.debug("REPLICATION", "[V-SQR-13-05] calling", op, "on", server.host);
            const res = await client[op](data);
            responses.push(res);
        }
        catch (e) {
            logger.error("REPLICATION", "[V-SQR-13-06] error querying", server.host, ":", e.message);
            missing.push(server);
        }
    }
    responses = responses.flat();
    if (missing.length) {
        const epoch = squirrel.topology.getEpoch(Date.now());
        for (const miss of missing) {
            const result = await useCatchupServerLogic(squirrel, data, op, miss.id, epoch);
            if ("err" in result)
                logger.warn("REPLICATION", "[V-SQR-13-08] catchup failed for", miss.id, ":", result.msg);
        }
    }
    logger.debug("REPLICATION", "[V-SQR-13-07] returning", responses.length, "responses");
    if (!responses.length)
        return op.includes("One") ? undefined : [];
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
