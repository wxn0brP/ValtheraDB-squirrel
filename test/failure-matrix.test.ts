import { describe, expect, test } from "bun:test";
import { replicationFind, replicationFindOne } from "../src/replication/find";
import { replicationOther } from "../src/replication/other";
import { getReplicaServers } from "../src/replication/utils";
import { useCatchupServerLogic } from "../src/router/catchup";
import { fullScanReq } from "../src/router/fullScan";
import { welcomeBack } from "../src/router/getData";
import { useDbOp } from "../src/router/op";
import { createMemoryCluster, createResponse } from "./helpers/memory-squirrel";

describe("failure routing", () => {
    test("1. rejects find through catchup when the primary server is down", async () => {
        const cluster = createMemoryCluster(["a", "b"], {
            allowCatchupServer: true,
            replicationEnabled: false,
        });
        const id = cluster.findIdForIndex(0);
        cluster.setUp("a", false);
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "find" }, body: {} } as any,
            res as any,
            { collection: "items", search: { _id: id } },
            "find"
        );

        expect(res.body).toEqual({ err: true, msg: "Catchup server does not support find" });
        expect(await cluster.catchupRows()).toEqual([]);
    });

    test("2. returns 503 when every catchup candidate is down", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            allowCatchupServer: true,
            replicationEnabled: false,
        });
        const id = cluster.findIdForIndex(0);
        cluster.setUp("a", false);
        cluster.setUp("b", false);
        cluster.setUp("c", false);
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "add" }, body: {} } as any,
            res as any,
            { collection: "items", data: { _id: id, value: "lost" } },
            "add"
        );

        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({ err: true, msg: "No catchup server available" });
    });
});

describe("failure replication writes", () => {
    test("1. queues catchup for one failed replica while live replicas accept the write", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            replicationEnabled: true,
            replicationFactor: 3,
        });
        const id = cluster.findIdForIndex(0);
        cluster.failOp("b", "add");

        const result = await replicationOther(cluster.squirrel, "add", id, {
            collection: "items",
            data: { _id: id, value: "partial" },
        });

        expect(result).toEqual(expect.objectContaining({ _id: id, value: "partial" }));
        expect(await cluster.serverRows("a", "items")).toHaveLength(1);
        expect(await cluster.serverRows("b", "items")).toHaveLength(0);
        expect(await cluster.serverRows("c", "items")).toHaveLength(1);
        expect(await cluster.catchupRows("b")).toEqual([
            expect.objectContaining({ to: "b", op: "add" }),
        ]);
    });

    test("2. returns an empty result when all replicas and catchup writes fail", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            replicationEnabled: true,
            replicationFactor: 3,
        });
        const id = cluster.findIdForIndex(0);
        cluster.failOp("a", "add");
        cluster.failOp("b", "add");
        cluster.failOp("c", "add");

        const result = await replicationOther(cluster.squirrel, "add", id, {
            collection: "items",
            data: { _id: id, value: "unavailable" },
        });

        expect(result).toEqual([]);
        expect(await cluster.allRows("items")).toEqual([]);
        expect(await cluster.catchupRows()).toEqual([]);
    });

    test("3. useCatchupServerLogic returns an error when the catchup target write fails", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        cluster.failOp("b", "add", new Error("catchup store failed"));

        const result = await useCatchupServerLogic(
            cluster.squirrel,
            { collection: "items", data: { _id: "0-1" } },
            "add",
            "a",
            { start: 0, serverIds: ["a", "b"] }
        );

        expect(result).toEqual({ err: true, msg: "catchup store failed" });
        expect(await cluster.catchupRows()).toEqual([]);
    });
});

describe("failure reads", () => {
    test("1. replicationFind skips one replica that throws and returns data from healthy replicas", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            replicationEnabled: true,
            replicationFactor: 3,
        });
        const id = cluster.findIdForIndex(0);
        await cluster.servers.get("a").db.add({ collection: "items", data: { _id: id, value: "a" } });
        await cluster.servers.get("c").db.add({ collection: "items", data: { _id: id, value: "c" } });
        cluster.failOp("b", "find");

        const result = await replicationFind(cluster.squirrel, id, {
            collection: "items",
            search: { _id: id },
        });

        expect(result).toHaveLength(1);
        expect(["a", "c"]).toContain(result[0].value);
    });

    test("2. replicationFindOne returns null when every replica read fails", async () => {
        const cluster = createMemoryCluster(["a", "b"], {
            replicationEnabled: true,
            replicationFactor: 2,
        });
        const id = cluster.findIdForIndex(0);
        cluster.failOp("a", "find");
        cluster.failOp("b", "find");

        expect(await replicationFindOne(cluster.squirrel, id, {
            collection: "items",
            search: { _id: id },
        })).toBeNull();
    });

    test("3. fullScanReq skips down servers and returns rows from available servers", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"]);
        await cluster.servers.get("a").db.add({ collection: "items", data: { _id: "a", value: 1 } });
        await cluster.servers.get("b").db.add({ collection: "items", data: { _id: "b", value: 2 } });
        await cluster.servers.get("c").db.add({ collection: "items", data: { _id: "c", value: 3 } });
        cluster.setUp("b", false);

        const result = await fullScanReq(cluster.squirrel, {
            collection: "items",
            search: {},
        }, "find");

        expect(result.map(row => row._id).sort()).toEqual(["a", "c"]);
    });

    test("4. fullScanReq returns an empty result when all servers are down", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        cluster.setUp("a", false);
        cluster.setUp("b", false);

        expect(await fullScanReq(cluster.squirrel, {
            collection: "items",
            search: {},
        }, "find")).toEqual([]);
    });
});

describe("failure catchup replay", () => {
    test("1. preserves failed and unreplayed rows when welcomeBack stops on a replay error", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        await cluster.servers.get("b").db.add({
            collection: "__squirrel_catchup",
            data: {
                to: "a",
                op: "add",
                v: { collection: "items", data: { _id: "0-ok", value: "ok" } },
                time: 100,
            },
        });
        await cluster.servers.get("b").db.add({
            collection: "__squirrel_catchup",
            data: {
                to: "a",
                op: "updateOne",
                v: { collection: "items", search: { _id: "missing" }, updater: { value: "fail" } },
                time: 200,
            },
        });
        await cluster.servers.get("b").db.add({
            collection: "__squirrel_catchup",
            data: {
                to: "a",
                op: "add",
                v: { collection: "items", data: { _id: "0-later", value: "later" } },
                time: 300,
            },
        });
        cluster.failOnce("a", "updateOne", new Error("replay failed"));

        const result = await welcomeBack(cluster.squirrel, "a");

        expect(result).toEqual({ err: true, msg: "replay failed" });
        expect(await cluster.serverRows("a", "items")).toEqual([
            expect.objectContaining({ _id: "0-ok", value: "ok" }),
        ]);
        expect((await cluster.catchupRows("a")).map(row => row.time)).toEqual([200, 300]);
    });

    test("2. welcomeBack is a no-op after the catchup queue has been drained", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        await cluster.servers.get("b").db.add({
            collection: "__squirrel_catchup",
            data: {
                to: "a",
                op: "add",
                v: { collection: "items", data: { _id: "0-one", value: "one" } },
                time: 100,
            },
        });

        expect(await welcomeBack(cluster.squirrel, "a")).toEqual({ err: false });
        expect(await welcomeBack(cluster.squirrel, "a")).toEqual({ err: false });
        expect(await cluster.catchupRows("a")).toEqual([]);
        expect(await cluster.serverRows("a", "items")).toHaveLength(1);
    });
});

describe("failure topology drift", () => {
    test("1. getReplicaServers filters server ids that disappeared from topology", () => {
        const cluster = createMemoryCluster(["a", "b"], { replicationFactor: 3 });
        cluster.squirrel.topology.epochs = [{ start: 0, serverIds: ["a", "missing", "b"] }];

        expect(getReplicaServers(cluster.squirrel, cluster.findIdForIndex(0))).toEqual([
            { id: "a", host: "http://a.local/" },
            { id: "b", host: "http://b.local/" },
        ]);
    });

    test("2. getReplicaServers returns empty when the current epoch has no servers", () => {
        const cluster = createMemoryCluster(["a"], { replicationFactor: 3 });
        cluster.squirrel.topology.epochs = [{ start: 0, serverIds: [] }];

        expect(getReplicaServers(cluster.squirrel, "0-any")).toEqual([]);
    });
});

describe("failure flapping and idempotency", () => {
    test("1. failOnce queues one catchup row and later writes succeed normally", async () => {
        const cluster = createMemoryCluster(["a", "b"], {
            replicationEnabled: true,
            replicationFactor: 2,
        });
        const id = cluster.findIdForIndex(0);
        cluster.failOnce("b", "add");

        await replicationOther(cluster.squirrel, "add", id, {
            collection: "items",
            data: { _id: id, value: "first" },
        });
        await replicationOther(cluster.squirrel, "add", "0-later", {
            collection: "items",
            data: { _id: "0-later", value: "second" },
        });

        expect(await cluster.catchupRows("b")).toHaveLength(1);
        expect(await cluster.serverRows("b", "items")).toContainEqual(
            expect.objectContaining({ _id: "0-later", value: "second" })
        );
    });

    test("2. duplicate updateOne catchup rows replay deterministically", async () => {
        const cluster = createMemoryCluster(["a", "b"]);
        await cluster.servers.get("a").db.add({
            collection: "items",
            data: { _id: "0-target", value: "initial" },
        });
        for (const time of [100, 200]) {
            await cluster.servers.get("b").db.add({
                collection: "__squirrel_catchup",
                data: {
                    to: "a",
                    op: "updateOne",
                    v: { collection: "items", search: { _id: "0-target" }, updater: { value: `v-${time}` } },
                    time,
                },
            });
        }

        expect(await welcomeBack(cluster.squirrel, "a")).toEqual({ err: false });
        expect(await cluster.servers.get("a").db.findOne({
            collection: "items",
            search: { _id: "0-target" },
        })).toEqual(expect.objectContaining({ _id: "0-target", value: "v-200" }));
        expect(await cluster.catchupRows("a")).toEqual([]);
    });
});
