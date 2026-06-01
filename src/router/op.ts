import type { VQuery } from "@wxn0brp/db-core/types/query";
import { FFRequest, FFResponse } from "@wxn0brp/falcon-frame";
import { logger } from "../logger";
import { replicationFind, replicationFindOne } from "../replication/find";
import { replicationOther } from "../replication/other";
import { Squirrel } from "../squirrel";
import { HTTP_STATUS } from "../vars";
import { useCatchupServer } from "./catchup";
import { fullScanReq } from "./fullScan";

function getQuery(req: FFRequest): VQuery {
    return req.body.query || req.body.params?.[0];
}

export function registerDbOp(squirrel: Squirrel) {
    const createHandler =
        (op: (req: FFRequest) => string) =>
            (req: FFRequest, res: FFResponse) =>
                useDbOp(squirrel, req, res, getQuery(req), op(req));

    const { app } = squirrel;

    app.post("/db/:op", createHandler(req => req.params.op));
    app.post("/db/:db/:op", createHandler(req => req.params.op));
    app.post("/", createHandler(req => req.body.op));
}

async function useDbOp(squirrel: Squirrel, req: FFRequest, res: FFResponse, data: VQuery, op: string) {
    if (!op)
        return res.json({ err: true, msg: "No op specified" });

    if (!data || typeof data !== "object" || Array.isArray(data))
        return res.json({ err: true, msg: "VQuery is not an object" });

    if (typeof data.search === "function")
        return res.status(400).json({ err: true, msg: "Search function is not supported" });

    const id = data.data?._id || data.search?._id;
    logger.debug("ROUTER", "[V-SQR-06-01] id:", id);

    if (squirrel.config.replicationEnabled) {
        switch (req.params.op) {
            case "findOne":
                return {
                    err: false,
                    result: await replicationFindOne(squirrel, id, data as any)
                }
            case "find":
                return {
                    err: false,
                    result: await replicationFind(squirrel, id, data as any)
                }
            case "issetCollection":
            case "getCollections":
            case "ensureCollection":
            case "removeCollection":
                break;
            default:
                return {
                    err: false,
                    result: await replicationOther(squirrel, req.params.op, id, data as any)
                }
        }
    }

    if (!id) {
        logger.debug("ROUTER", "[V-SQR-06-02] No id in query, checking full scan");

        if (squirrel.config.allowFullScan) {
            logger.debug("ROUTER", "[V-SQR-06-03] Starting full scan");

            return {
                err: false,
                result: await fullScanReq(
                    squirrel,
                    data as any,
                    op
                )
            }
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
        } else {
            return res.status(503).json({
                err: true,
                msg: "No catchup server available"
            });
        }
    }

    const host = target.server.host;
    const redirectUrl = `${host.endsWith("/") ? host : host + "/"}db/${op}`;
    logger.debug("ROUTER", "[V-SQR-06-09] redirect:", redirectUrl);
    res.redirect(redirectUrl, HTTP_STATUS.TEMPORARY_REDIRECT);
}
