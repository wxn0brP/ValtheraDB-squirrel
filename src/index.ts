import { Squirrel } from "./squirrel";
import FalconFrame from "@wxn0brp/falcon-frame";

const app = new FalconFrame();
app.l(14415);

const squirrel = new Squirrel(
    app,
    {
        name: process.env.SQUIRREL_DB,
        auth: process.env.SQUIRREL_AUTH
    },
    {
        allowFullScan: process.env.SQUIRREL_ALLOW_FULL_SCAN === "true",
        allowBackupServer: process.env.SQUIRREL_ALLOW_BACKUP === "true"
    }
);

squirrel.init(process.env.SQUIRREL_SEEDS.split(" "));
