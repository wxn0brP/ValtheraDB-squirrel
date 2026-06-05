import { describe, expect, test } from "bun:test";
import { getReplicaServers } from "../src/replication/utils";
import { ServerInfo } from "../src/types";

function createSquirrel(serverIds: string[], idx: number, replicationFactor: number) {
    const servers = new Map<string, ServerInfo>(
        serverIds.map(id => [id, { id, host: `http://${id}.local/` }])
    );

    return {
        config: { replicationFactor },
        topology: {
            servers,
            getServerForId: () => ({
                epoch: { start: 0, serverIds },
                idx,
                server: servers.get(serverIds[idx]),
            }),
        },
    } as any;
}

describe("getReplicaServers", () => {
    test("1. selects replicas starting from the owning server", () => {
        const squirrel = createSquirrel(["a", "b", "c", "d"], 1, 3);

        expect(getReplicaServers(squirrel, "doc-1")).toEqual([
            { id: "b", host: "http://b.local/" },
            { id: "c", host: "http://c.local/" },
            { id: "d", host: "http://d.local/" },
        ]);
    });

    test("2. wraps around the server list", () => {
        const squirrel = createSquirrel(["a", "b", "c"], 2, 2);

        expect(getReplicaServers(squirrel, "doc-1").map(server => server.id)).toEqual(["c", "a"]);
    });

    test("3. caps replicas at the number of available servers", () => {
        const squirrel = createSquirrel(["a", "b"], 0, 5);

        expect(getReplicaServers(squirrel, "doc-1").map(server => server.id)).toEqual(["a", "b"]);
    });

    test("4. returns no replicas when replication factor is not positive", () => {
        const squirrel = createSquirrel(["a", "b"], 0, 0);

        expect(getReplicaServers(squirrel, "doc-1")).toEqual([]);
    });
});
