import { describe, expect, test } from "bun:test";
import { useCatchupServerLogic } from "../src/router/catchup";
import { fullScanReq } from "../src/router/fullScan";
import { welcomeBack } from "../src/router/getData";
import { createMemoryCluster, findAll } from "./helpers/memory-squirrel";

describe("memory catchup", () => {
    test("1. welcomeBack replays queued operations in time order and removes queue rows", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"]);
        const target = cluster.servers.get("a");
        await cluster.servers.get("b").db.add({
            collection: "__squirrel_catchup",
            data: {
                to: "a",
                op: "add",
                v: { collection: "items", data: { _id: "0-old", value: "old" } },
                time: 200,
            },
        });
        await cluster.servers.get("c").db.add({
            collection: "__squirrel_catchup",
            data: {
                to: "a",
                op: "add",
                v: { collection: "items", data: { _id: "0-new", value: "new" } },
                time: 100,
            },
        });

        const result = await welcomeBack(cluster.squirrel, "a");

        expect(result).toEqual({ err: false });
        expect(await findAll(target, "items")).toEqual([
            expect.objectContaining({ _id: "0-new", value: "new" }),
            expect.objectContaining({ _id: "0-old", value: "old" }),
        ]);
        expect(await fullScanReq(cluster.squirrel, {
            collection: "__squirrel_catchup",
            search: { to: "a" },
        }, "find")).toEqual([]);
    });

    test("2. welcomeBack refuses to replay when the returning server is still down", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        cluster.setUp("a", false);

        expect(await welcomeBack(cluster.squirrel, "a")).toEqual({ err: true, msg: "Server down" });
    });

    test("3. welcomeBack returns an error for an unknown server", async () => {
        const cluster = createMemoryCluster(["a"]);

        expect(await welcomeBack(cluster.squirrel, "missing")).toEqual({ err: true, msg: "Server not found" });
    });

    test("4. useCatchupServerLogic returns an error when no alternative server is up", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        cluster.setUp("b", false);

        const result = await useCatchupServerLogic(
            cluster.squirrel,
            { collection: "items", data: { _id: "0-1" } },
            "add",
            "a",
            { start: 0, serverIds: ["a", "b"] }
        );

        expect(result).toEqual({ err: true, msg: "No catchup server available" });
    });

    test("5. getCatchupServer skips epoch ids missing from topology", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        cluster.squirrel.topology.epochs = [{ start: 0, serverIds: ["a", "missing", "b"] }];

        const catchup = await cluster.squirrel.topology.getCatchupServer("a", {
            start: 0,
            serverIds: ["a", "missing", "b"],
        });

        expect(catchup).toEqual({ id: "b", host: "http://b.local/" });
    });
});
