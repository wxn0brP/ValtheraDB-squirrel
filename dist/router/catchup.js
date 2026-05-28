import { ValtheraRemote } from "@wxn0brp/db-client";
import { logger } from "../logger.js";
export async function useCatchupServer({ squirrel, data, req, res, target }) {
    logger.info("CATCHUP", "[V-SQR-08-01] Using catchup server for op:", req.params.op, "target:", target.server.id);
    switch (req.params.op) {
        case "find":
        case "findOne":
        case "issetCollection":
        case "getCollections":
            return res.json({ err: true, msg: "Catchup server does not support find" });
    }
    const addResult = await useCatchupServerLogic(squirrel, data, req.params.op, target.server.id, target.epoch);
    if ("err" in addResult)
        return res.status(503).json(addResult);
    res.status(207).json({
        err: true,
        msg: "Successfully added to catchup server",
        result: addResult
    });
}
export async function useCatchupServerLogic(squirrel, data, op, serverId, epoch) {
    const catchup = await squirrel.topology.getCatchupServer(serverId, epoch);
    if (!catchup) {
        logger.error("CATCHUP", "[V-SQR-15-02] No catchup server available for:", serverId);
        return { err: true, msg: "No catchup server available" };
    }
    logger.debug("CATCHUP", "[V-SQR-15-03] Using catchup server:", catchup.id);
    const client = new ValtheraRemote({
        ...squirrel.authConfig,
        url: catchup.host
    });
    const addResult = await client.add({
        collection: "__squirrel_catchup",
        data: {
            to: serverId,
            op: op,
            v: data,
            time: Date.now()
        }
    });
    logger.info("CATCHUP", "[V-SQR-15-04] Successfully added to catchup server:", serverId, addResult);
    return addResult;
}
