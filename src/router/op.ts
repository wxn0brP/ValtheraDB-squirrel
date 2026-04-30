import type { VQuery } from "@wxn0brp/db-core/types/query";
import { Squirrel } from "../squirrel";
import { useBackupServer } from "./backup";
import { fullScanReq } from "./fullScan";

export function registerDbOp(squirrel: Squirrel) {
    squirrel.app.post("/db/:op", async (req, res) => {
        const { params } = req.body as { params: [VQuery] };
        if (!Array.isArray(params))
            return res.json({ err: true, msg: "Params must be array" });

        const data = params[0];
        if (typeof data !== "object" || Array.isArray(data))
            return res.json({ err: true, msg: "VQuery is not an object" });

        if (typeof data.search === "function")
            return res.status(400).json({ err: true, msg: "Search is not supported" });

        const id = data.data?._id || data.search?._id;
        console.log("[V-SQR-06-01] id:", id);

        if (!id) {
            console.log("[V-SQR-06-02] No id in query, checking full scan");
            if (squirrel.config.allowFullScan) {
                console.log("[V-SQR-06-03] Starting full scan");
                return fullScanReq(
                    squirrel,
                    data as any,
                    req.params.op as any,
                    res
                );
            }
            console.log("[V-SQR-06-04] Full scan not allowed");
            return res.status(400).json({ err: true, msg: "Missing id" });
        }

        const target = squirrel.topology.getServerForId(id);
        if (!target) {
            console.log("[V-SQR-06-05] No server found for id:", id);
            return res.status(503).json({ err: true, msg: "No server for epoch" });
        }

        console.log("[V-SQR-06-06] target:", target);
        const isUp = await squirrel.topology.isServerUp(target.server.host);
        console.log("[V-SQR-06-07] isUp:", isUp);

        if (!isUp) {
            console.log("[V-SQR-06-08] Primary server down, using backup");
            if (squirrel.config.allowBackupServer) {
                return useBackupServer({
                    squirrel,
                    data,
                    req,
                    res,
                    target
                });
            } else {
                return res.status(503).json({
                    err: true,
                    msg: "No backup server available"
                });
            }
        }

        const host = target.server.host;
        const redirectUrl = `${host.endsWith("/") ? host : host + "/"}db/${req.params.op}`;
        console.log("[V-SQR-06-09] redirect:", redirectUrl);
        res.redirect(redirectUrl, 307);
    });
}
