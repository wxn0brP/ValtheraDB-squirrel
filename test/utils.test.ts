import { describe, expect, test } from "bun:test";
import { parseServerInfo } from "../src/utils";

describe("parseServerInfo", () => {
    test("1. uses URL username as server id and stores password as redirectHost", () => {
        expect(parseServerInfo("http://node-a:secret@example.com:14415/db?x=1#top")).toEqual({
            id: "node-a",
            host: "http://example.com:14415/db?x=1#top",
            redirectHost: "secret",
        });
    });

    test("2. keeps host unchanged when server id is missing", () => {
        expect(parseServerInfo("https://example.com:14415")).toEqual({
            id: "",
            host: "https://example.com:14415/",
        });
    });

    test("3. extracts password as redirectHost when present", () => {
        expect(parseServerInfo("http://a:https%3A%2F%2Fdomain.com@localhost:18881")).toEqual({
            id: "a",
            host: "http://localhost:18881/",
            redirectHost: "https://domain.com",
        });
    });

    test("4. no redirectHost when password is absent", () => {
        expect(parseServerInfo("http://a@localhost:18881")).toEqual({
            id: "a",
            host: "http://localhost:18881/",
        });
    });
});
