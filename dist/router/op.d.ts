import type { VQuery } from "@wxn0brp/db-core/types/query";
import { FFRequest, FFResponse } from "@wxn0brp/falcon-frame";
import { Squirrel } from "../squirrel.js";
export declare function registerDbOp(squirrel: Squirrel): void;
export declare function useDbOp(squirrel: Squirrel, req: FFRequest, res: FFResponse, data: VQuery, op: string): Promise<void | {
    err: boolean;
    result: any;
}>;
