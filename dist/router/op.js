import { logger } from "../logger.js";
import { replicationFind, replicationFindOne } from "../replication/find.js";
import { replicationOther } from "../replication/other.js";
import { HTTP_STATUS } from "../vars.js";
import { useCatchupServer } from "./catchup.js";
import { fullScanReq } from "./fullScan.js";
function getQuery(req) {
    return req.body.query || req.body.params?.[0];
}
export function registerDbOp(squirrel) {
    const createHandler = (op) => (req, res) => useDbOp(squirrel, req, res, getQuery(req), op(req));
    const { app } = squirrel;
    app.post("/db/:op", createHandler(req => req.params.op));
    app.post("/db/:db/:op", createHandler(req => req.params.op));
    app.post("/", createHandler(req => req.body.op));
}
export async function useDbOp(squirrel, req, res, data, op) {
    if (!op)
        return res.json({ err: true, msg: "No op specified" });
    if (!data || typeof data !== "object" || Array.isArray(data))
        return res.json({ err: true, msg: "VQuery is not an object" });
    if (typeof data.search === "function")
        return res.status(400).json({ err: true, msg: "Search function is not supported" });
    const id = data.data?._id || data.search?._id;
    logger.debug("ROUTER", "[V-SQR-06-01] id:", id);
    if (squirrel.config.replicationEnabled) {
        switch (op) {
            case "findOne":
                return {
                    err: false,
                    result: await replicationFindOne(squirrel, id, data)
                };
            case "find":
                return {
                    err: false,
                    result: await replicationFind(squirrel, id, data)
                };
            case "issetCollection":
            case "getCollections":
            case "ensureCollection":
            case "removeCollection":
                break;
            default:
                return {
                    err: false,
                    result: await replicationOther(squirrel, op, id, data)
                };
        }
    }
    if (!id) {
        logger.debug("ROUTER", "[V-SQR-06-02] No id in query, checking full scan");
        if (squirrel.config.allowFullScan) {
            logger.debug("ROUTER", "[V-SQR-06-03] Starting full scan");
            return {
                err: false,
                result: await fullScanReq(squirrel, data, op)
            };
        }
        logger.warn("ROUTER", "[V-SQR-06-04] Full scan not allowed");
        return res.status(400).json({ err: true, msg: "Missing id" });
    }
    const target = squirrel.topology.getServerForId(id);
    if (!target) {
        logger.error("ROUTER", "[V-SQR-06-05] No server found for id:", id);
        return res.status(503).json({ err: true, msg: "No server for epoch" });
    }
    logger.debug("ROUTER", "[V-SQR-06-06] target:", target);
    const isUp = await squirrel.topology.isServerUp(target.server.host);
    logger.debug("ROUTER", "[V-SQR-06-07] isUp:", isUp);
    if (!isUp) {
        logger.warn("ROUTER", "[V-SQR-06-08] Primary server down, using catchup");
        if (squirrel.config.allowCatchupServer) {
            return useCatchupServer({
                squirrel,
                data,
                req,
                res,
                target
            });
        }
        else {
            return res.status(503).json({
                err: true,
                msg: "No catchup server available"
            });
        }
    }
    const host = target.server.redirectHost || target.server.host;
    const redirectUrl = `${host.endsWith("/") ? host : host + "/"}db/${op}`;
    logger.debug("ROUTER", "[V-SQR-06-09] redirect:", redirectUrl);
    res.redirect(redirectUrl, HTTP_STATUS.TEMPORARY_REDIRECT);
}
