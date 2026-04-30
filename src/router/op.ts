import type { VQuery } from "@wxn0brp/db-core/types/query";
import { Squirrel } from "../squirrel";
import { fullScanReq } from "./fullScan";
import { useBackupServer } from "./backup";

export function registerDbOp(squirrel: Squirrel) {
    squirrel.app.post("/db/:op", async (req, res) => {
        const { params } = req.body as { params: [VQuery] };
        const data = params[0];

        if (typeof data.search === "function")
            return res.status(400).json({ err: true, msg: "Search is not supported" });

        const id = data.data?._id || data.search?._id;
        console.log("[V-SQR-04-01] id:", id);

        if (!id) {
            if (squirrel.config.allowFullScan)
                return fullScanReq(
                    squirrel,
                    data as any,
                    req.params.op as any,
                    res
                );
            return res.status(400).json({ err: true, msg: "Missing id" });
        }

        const target = squirrel.topology.getServerForId(id);
        if (!target)
            return res.status(503).json({ err: true, msg: "No server for epoch" });

        console.log("[V-SQR-04-02] target:", target);
        const isUp = await squirrel.topology.isServerUp(target.server.host);
        console.log("[V-SQR-04-03] isUp:", isUp);

        if (!isUp) {
            if (squirrel.config.allowFullScan) {
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

        const redirectUrl = `${target.server.host}db/${req.params.op}`;
        console.log("[V-SQR-04-04] redirect:", redirectUrl);
        res.redirect(redirectUrl, 307);
    });
}
