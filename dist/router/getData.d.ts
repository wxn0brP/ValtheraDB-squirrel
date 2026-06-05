import { Squirrel } from "../squirrel.js";
export declare function registerGetData(squirrel: Squirrel): void;
export declare function welcomeBack(squirrel: Squirrel, _id: string): Promise<{
    err: boolean;
    msg: any;
} | {
    err: boolean;
    msg?: undefined;
}>;
