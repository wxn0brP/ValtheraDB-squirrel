import { describe, expect, test } from "bun:test";
import { TopologyManager } from "../src/topology";

function createTopology() {
    return new TopologyManager({} as any);
}

describe("TopologyManager", () => {
    test("1. addServer ignores duplicate server ids", () => {
        const topology = createTopology();

        topology.addServer({ id: "a", host: "http://a.local/" });
        topology.addServer({ id: "a", host: "http://changed.local/" });

        expect(topology.servers.size).toBe(1);
        expect(topology.servers.get("a")).toEqual({ id: "a", host: "http://a.local/" });
    });

    test("2. getEpoch returns the epoch active for a timestamp", () => {
        const topology = createTopology();
        topology.epochs = [
            { start: 100, serverIds: ["a"] },
            { start: 200, serverIds: ["b"] },
            { start: 300, serverIds: ["c"] },
        ];

        expect(topology.getEpoch(99)).toBeNull();
        expect(topology.getEpoch(100)).toEqual({ start: 100, serverIds: ["a"] });
        expect(topology.getEpoch(250)).toEqual({ start: 200, serverIds: ["b"] });
        expect(topology.getEpoch(300)).toEqual({ start: 300, serverIds: ["c"] });
        expect(topology.getEpoch(999)).toEqual({ start: 300, serverIds: ["c"] });
    });

    test("3. _hash is deterministic and non-negative", () => {
        const topology = createTopology();

        expect(topology._hash("document-id")).toBe(topology._hash("document-id"));
        expect(topology._hash("document-id")).toBeGreaterThanOrEqual(0);
    });
});
