import { Squirrel } from "../squirrel";
import { fullScanReq } from "./fullScan";

export function registerGetData(squirrel: Squirrel) {
    if (!squirrel.config.allowBackupServer) {
        console.log("[V-SQR-11-01] Backup server disabled, skipping getData routes");
        return;
    }

    squirrel.app.post("/__squirrel/get-data", async (req, res) => {
        const { _id } = req.body;
        console.log("[V-SQR-11-03] Get-data request for server:", _id);

        if (!_id)
            return res.json({ err: true, msg: "Missing id" });

        const data = await fullScanReq(squirrel, {
            collection: "__squirrel_back",
            search: {
                to: _id
            }
        }, "find", false);

        console.log("[V-SQR-11-04] Get-data result for server:", _id, "count:", data.length);
        return res.json({ err: true, result: data });
    });

    squirrel.app.post("/__squirrel/get-data-ack", async (req, res) => {
        const { _id } = req.body;
        console.log("[V-SQR-11-05] Get-data-ack request for server:", _id);

        if (!_id)
            return res.json({ err: true, msg: "Missing id" });

        const data = await fullScanReq(squirrel, {
            collection: "__squirrel_back",
            search: {
                to: _id
            }
        }, "remove", false);

        console.log("[V-SQR-11-06] Get-data-ack removed for server:", _id, "count:", data.length);
        return res.json({ err: true, result: data });
    });
}
