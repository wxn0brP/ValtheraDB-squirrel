import { logger } from "../logger.js";
import { COLLECTIONS } from "../vars.js";
import { fullScanReq } from "./fullScan.js";
export function registerGetData(squirrel) {
    if (!squirrel.config.allowCatchupServer) {
        logger.info("SYNC", "[V-SQR-16-01] Catchup server disabled, skipping getData routes");
        return;
    }
    squirrel.app.post("/squirrel/welcome-back", (req, res) => welcomeBack(squirrel, req.body._id));
}
export async function welcomeBack(squirrel, _id) {
    if (!_id)
        return { err: true, msg: "Missing id" };
    logger.info("SYNC", "[V-SQR-16-07] Welcome-back request for server:", _id);
    const host = squirrel.topology.servers.get(_id)?.host;
    if (!host)
        return { err: true, msg: "Server not found" };
    const isUp = await squirrel.topology.isServerUp(host);
    if (!isUp) {
        logger.warn("SYNC", "[V-SQR-16-08] Lie. Server down, skipping:", _id);
        return { err: true, msg: "Server down" };
    }
    const data = await fullScanReq(squirrel, {
        collection: COLLECTIONS.SQUIRREL_CATCHUP,
        search: {
            to: _id
        }
    }, "find");
    data.sort((a, b) => a.time - b.time);
    const client = squirrel.getClient(host);
    const replayed = [];
    for (const d of data) {
        try {
            await client[d.op](d.v);
            replayed.push(d);
        }
        catch (e) {
            await removeCatchupEntries(squirrel, replayed, _id);
            return { err: true, msg: e.message };
        }
    }
    await removeCatchupEntries(squirrel, data, _id);
    return { err: false };
}
async function removeCatchupEntries(squirrel, data, to) {
    const withId = data.filter(d => "_id" in d);
    if (!withId.length)
        return;
    for (const d of withId) {
        await fullScanReq(squirrel, {
            collection: COLLECTIONS.SQUIRREL_CATCHUP,
            search: {
                _id: d._id,
                to,
            }
        }, "remove");
    }
}
