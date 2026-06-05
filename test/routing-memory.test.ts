import { describe, expect, test } from "bun:test";
import { useDbOp } from "../src/router/op";
import { HTTP_STATUS } from "../src/vars";
import { createMemoryCluster, createResponse, findAll } from "./helpers/memory-squirrel";

describe("memory routing", () => {
    test("1. redirects an id based write to the owning server when primary is up", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], { replicationEnabled: false });
        const id = cluster.findIdForIndex(1);
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "add" }, body: {} } as any,
            res as any,
            { collection: "items", data: { _id: id, value: "ok" } },
            "add"
        );

        expect(res.statusCode).toBe(HTTP_STATUS.TEMPORARY_REDIRECT);
        expect(res.redirectUrl).toBe("http://b.local/db/add");
    });

    test("2. stores a write on a catchup server when the primary is down", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], {
            allowCatchupServer: true,
            replicationEnabled: false,
        });
        const id = cluster.findIdForIndex(0);
        cluster.setUp("a", false);
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "add" }, body: {} } as any,
            res as any,
            { collection: "items", data: { _id: id, value: "queued" } },
            "add"
        );

        const catchupRows = [
            ...await findAll(cluster.servers.get("b"), "__squirrel_catchup"),
            ...await findAll(cluster.servers.get("c"), "__squirrel_catchup"),
        ];

        expect(res.statusCode).toBe(HTTP_STATUS.MULTI_STATUS);
        expect(catchupRows).toHaveLength(1);
        expect(catchupRows[0]).toEqual(expect.objectContaining({
            to: "a",
            op: "add",
            v: expect.objectContaining({ collection: "items" }),
        }));
    });

    test("3. returns 503 when primary is down and catchup is disabled", async () => {
        const cluster = createMemoryCluster(["a", "b"], {
            allowCatchupServer: false,
            replicationEnabled: false,
        });
        const id = cluster.findIdForIndex(0);
        cluster.setUp("a", false);
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "add" }, body: {} } as any,
            res as any,
            { collection: "items", data: { _id: id } },
            "add"
        );

        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({ err: true, msg: "No catchup server available" });
    });

    test("4. rejects missing ids when full scan is disabled", async () => {
        const cluster = createMemoryCluster(["a"], { allowFullScan: false });
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "find" }, body: {} } as any,
            res as any,
            { collection: "items", search: {} },
            "find"
        );

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ err: true, msg: "Missing id" });
    });

    test("5. rejects search functions before routing", async () => {
        const cluster = createMemoryCluster(["a"], { allowFullScan: true });
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "find" }, body: {} } as any,
            res as any,
            { collection: "items", search: () => true } as any,
            "find"
        );

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ err: true, msg: "Search function is not supported" });
    });

    test("6. uses redirectHost for redirect when set", async () => {
        const cluster = createMemoryCluster(["a", "b", "c"], { replicationEnabled: false });
        const id = cluster.findIdForIndex(1);
        const server = cluster.squirrel.topology.servers.get("b");
        server.redirectHost = "https://domain.com";
        const res = createResponse();

        await useDbOp(
            cluster.squirrel,
            { params: { op: "add" }, body: {} } as any,
            res as any,
            { collection: "items", data: { _id: id, value: "ok" } },
            "add"
        );

        expect(res.statusCode).toBe(HTTP_STATUS.TEMPORARY_REDIRECT);
        expect(res.redirectUrl).toBe("https://domain.com/db/add");
    });

    test("7. uses body op in replication mode when route params are empty", async () => {
        const cluster = createMemoryCluster(["a", "b"], {
            replicationEnabled: true,
            replicationFactor: 2,
        });
        const id = cluster.findIdForIndex(0);

        const result = await useDbOp(
            cluster.squirrel,
            { params: {}, body: { op: "add" } } as any,
            createResponse() as any,
            { collection: "items", data: { _id: id, value: "from-body" } },
            "add"
        );

        expect(result.err).toBe(false);
        expect(await cluster.servers.get("a").db.findOne({ collection: "items", search: { _id: id } })).toBeTruthy();
        expect(await cluster.servers.get("b").db.findOne({ collection: "items", search: { _id: id } })).toBeTruthy();
    });
});
