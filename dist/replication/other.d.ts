import { Data } from "@wxn0brp/db-core/types/data";
import { VQuery } from "@wxn0brp/db-core/types/query";
import { Squirrel } from "../squirrel.js";
export declare function replicationOther(squirrel: Squirrel, op: string, id: string, data: VQuery): Promise<Data | Data[]>;
