import { describe, expect, test } from "bun:test";
import { parseServerInfo } from "../src/utils";

describe("parseServerInfo", () => {
    test("1. uses URL username as server id and strips credentials from host", () => {
        expect(parseServerInfo("http://node-a:secret@example.com:14415/db?x=1#top")).toEqual({
            id: "node-a",
            host: "http://example.com:14415/db?x=1#top",
        });
    });

    test("2. keeps host unchanged when server id is missing", () => {
        expect(parseServerInfo("https://example.com:14415")).toEqual({
            id: "",
            host: "https://example.com:14415/",
        });
    });
});
