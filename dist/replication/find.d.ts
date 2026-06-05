import { Data } from "@wxn0brp/db-core/types/data";
import { VQueryT } from "@wxn0brp/db-core/types/query";
import { Squirrel } from "../squirrel.js";
export declare function replicationFind(squirrel: Squirrel, id: string, data: VQueryT.Find): Promise<Data[]>;
export declare function replicationFindOne(squirrel: Squirrel, id: string, query: VQueryT.FindOne): Promise<Data | null>;
