import { ValtheraRemote } from "@wxn0brp/db-client";
import { VQuery } from "@wxn0brp/db-core/types/query";
import { FFRequest, FFResponse } from "@wxn0brp/falcon-frame";
import { Squirrel } from "../squirrel";
import { ServerEpochInfo } from "../types";

export interface BackupServerOpts {
    squirrel: Squirrel;
    data: VQuery;
    req: FFRequest;
    res: FFResponse;
    target: ServerEpochInfo;
}

export async function useBackupServer({ squirrel, data, req, res, target }: BackupServerOpts) {
    switch (req.params.op) {
        case "find":
        case "findOne":
        case "issetCollection":
        case "getCollections":
            return res.json({ err: true, msg: "Backup server does not support find" });
    }

    const backup = await squirrel.topology.getBackupServer(target.server.id, target.epoch);
    if (!backup)
        return res.status(503).json({ err: true, msg: "No backup server available" });

    const client = new ValtheraRemote({
        ...squirrel.authConfig,
        url: backup.host
    });

    const addResult = await client.add({
        collection: "__squirrel_back",
        data: {
            to: target.server.id,
            data
        }
    });

    console.log("[V-SQR-06-01] Successfully added to backup server:", target.server.id, addResult);

    res.status(207).json({
        err: true,
        msg: "Successfully added to backup server",
        result: addResult
    });
}
