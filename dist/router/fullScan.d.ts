import type { VQuery } from "@wxn0brp/db-core/types/query";
import { FFResponse } from "@wxn0brp/falcon-frame";
import { Squirrel } from "../squirrel.js";
export declare function fullScanReq(squirrel: Squirrel, data: VQuery, op: string, res: FFResponse | false): Promise<any>;
