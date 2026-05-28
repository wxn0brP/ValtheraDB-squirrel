import { VQuery } from "@wxn0brp/db-core/types/query";
import { FFRequest, FFResponse } from "@wxn0brp/falcon-frame";
import { Squirrel } from "../squirrel.js";
import { CatchupEntry, Epoch, ServerEpochInfo } from "../types.js";
export interface CatchupServerOpts {
    squirrel: Squirrel;
    data: VQuery;
    req: FFRequest;
    res: FFResponse;
    target: ServerEpochInfo;
}
export declare function useCatchupServer({ squirrel, data, req, res, target }: CatchupServerOpts): Promise<void>;
export declare function useCatchupServerLogic(squirrel: Squirrel, data: VQuery, op: string, serverId: string, epoch: Epoch): Promise<CatchupEntry | {
    err: boolean;
    msg: string;
}>;
