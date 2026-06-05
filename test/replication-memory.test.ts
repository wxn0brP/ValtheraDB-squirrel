import { describe, expect, test } from "bun:test";
import { replicationFind, replicationFindOne } from "../src/replication/find";
import { replicationOther } from "../src/replication/other";
import { getReplicaServers } from "../src/replication/utils";
import { squirrelTimeKey } from "../src/vars";
import { createMemoryCluster, findAll } from "./helpers/memory-squirrel";

describe("memory replication", () => {
    test("1. add writes to the selected replica set only", async () => {
        const cluster = createMemoryCluster(["a", "b", "c", "d"], {
            replicationEnabled: true,
            replicationFactor: 2,
        });
        const id = cluster.findIdForIndex(1);

        const result = await replicationOther(cluster.squirrel, "add", id, {
            collection: "items",
            data: { _id: id, value: "replicated" },
        });

        expect(result).toEqual(expect.objectContaining({ _id: id, value: "replicated" }));
        expect(await findAll(cluster.servers.get("a"), "items")).toHaveLength(0);
        expect(await findAll(cluster.servers.get("b"), "items")).toHaveLength(1);
        expect(await findAll(cluster.servers.get("c"), "items")).toHaveLength(1);
        expect(await findAll(cluster.servers.get("d"), "items")).toHaveLength(0);
    });

    test("2. add queues catchup for a failed replica and still writes live replicas", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            replicationEnabled: true,
            replicationFactor: 3,
        });
        const id = cluster.findIdForIndex(0);
        cluster.setUp("b", false);

        const result = await replicationOther(cluster.squirrel, "add", id, {
            collection: "items",
            data: { _id: id, value: "partially-written" },
        });

        const catchupRows = [
            ...await findAll(cluster.servers.get("a"), "__squirrel_catchup"),
            ...await findAll(cluster.servers.get("c"), "__squirrel_catchup"),
        ];

        expect(result._id).toBe(id);
        expect(await findAll(cluster.servers.get("a"), "items")).toHaveLength(1);
        expect(await findAll(cluster.servers.get("b"), "items")).toHaveLength(0);
        expect(await findAll(cluster.servers.get("c"), "items")).toHaveLength(1);
        expect(catchupRows).toHaveLength(1);
        expect(catchupRows[0]).toEqual(expect.objectContaining({ to: "b", op: "add" }));
    });

    test("3. findOne returns the newest replica by squirrel timestamp and hides metadata", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            replicationEnabled: true,
            replicationFactor: 3,
        });
        const id = cluster.findIdForIndex(0);
        await cluster.servers.get("a").db.add({
            collection: "items",
            data: { _id: id, value: "old", [squirrelTimeKey]: 100 },
        });
        await cluster.servers.get("b").db.add({
            collection: "items",
            data: { _id: id, value: "new", [squirrelTimeKey]: 200 },
        });

        const result = await replicationFindOne(cluster.squirrel, id, {
            collection: "items",
            search: { _id: id },
        });

        expect(result).toEqual({ _id: id, value: "new" });
    });

    test("4. find deduplicates replica results and keeps no-id rows", async () => {
        const cluster = createMemoryCluster(["a", "b"], {
            replicationEnabled: true,
            replicationFactor: 2,
        });
        const id = cluster.findIdForIndex(0);
        await cluster.servers.get("a").db.add({
            collection: "items",
            data: { _id: id, value: "older", [squirrelTimeKey]: 100 },
        });
        await cluster.servers.get("b").db.add({
            collection: "items",
            data: { _id: id, value: "newer", [squirrelTimeKey]: 200 },
        });
        await cluster.servers.get("b").db.add({
            collection: "items",
            data: { value: "without-id", [squirrelTimeKey]: 300 },
            id_gen: false,
        } as any);

        const result = await replicationFind(cluster.squirrel, id, {
            collection: "items",
            search: {},
        });

        expect(result).toContainEqual({ _id: id, value: "newer" });
        expect(result).toContainEqual({ value: "without-id" });
        expect(result).toHaveLength(2);
    });

    test("5. returns an empty replica list when topology cannot resolve the id", () => {
        const cluster = createMemoryCluster(["a"], { replicationFactor: 2 });
        cluster.squirrel.topology.epochs = [];

        expect(getReplicaServers(cluster.squirrel, "0-missing")).toEqual([]);
    });
});
