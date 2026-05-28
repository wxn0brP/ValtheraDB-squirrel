import { ValtheraRemote } from "@wxn0brp/db-client";
import { Squirrel } from "../squirrel";
import { fullScanReq } from "./fullScan";
import { CatchupEntry } from "../types";
import { logger } from "../logger";

export function registerGetData(squirrel: Squirrel) {
    if (!squirrel.config.allowCatchupServer) {
        logger.info("SYNC", "[V-SQR-16-01] Catchup server disabled, skipping getData routes");
        return;
    }

    squirrel.app.post("/squirrel/welcome-back", async (req, res) => {
        const { _id } = req.body;

        if (!_id)
            return res.json({ err: true, msg: "Missing id" });

        logger.info("SYNC", "[V-SQR-16-07] Welcome-back request for server:", _id);

        const host = squirrel.topology.servers.get(_id)?.host;

        if (!host)
            return res.json({ err: true, msg: "Server not found" });

        const isUp = await squirrel.topology.isServerUp(host);
        if (!isUp) {
            logger.warn("SYNC", "[V-SQR-16-08] Lie. Server down, skipping:", _id);
            return res.json({ err: true, msg: "Server down" });
        }

        const data: CatchupEntry[] = await fullScanReq(squirrel, {
            collection: "__squirrel_catchup",
            search: {
                to: _id
            }
        }, "find", false);

        data.sort((a, b) => a.time - b.time);

        const client = new ValtheraRemote({
            ...squirrel.authConfig,
            url: host
        });

        for (const d of data)
            await client[d.op](d.v);

        await fullScanReq(squirrel, {
            collection: "__squirrel_catchup",
            search: {
                to: _id
            }
        }, "remove", false);

        return res.json({ err: false });
    });
}
