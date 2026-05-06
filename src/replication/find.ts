import { ValtheraRemote } from "@wxn0brp/db-client";
import { Data } from "@wxn0brp/db-core/types/data";
import { VQueryT } from "@wxn0brp/db-core/types/query";
import { fullScanReq } from "../router/fullScan";
import { Squirrel } from "../squirrel";
import { getReplicaServers } from "./utils";
import { squirrelTimeKey } from "./vars";

export async function replicationFind(squirrel: Squirrel, id: string, data: VQueryT.Find): Promise<Data[]> {
    console.log(`[V-SQR-10-01] replicationFind, id: ${id}`);
    const results = await findGetData(squirrel, data, id);

    if (!results.length) return [];

    const output: Data[] = [];

    const withId = results.filter(d => d._id != null);
    const withoutId = results.filter(d => d._id == null);
    console.log(`[V-SQR-10-02] withId: ${withId.length}, withoutId: ${withoutId.length}`);

    const grouped = new Map<string, Data[]>();
    for (const entry of withId) {
        const key = entry._id;
        if (!grouped.has(key))
            grouped.set(key, []);
        grouped.get(key).push(entry);
    }
    console.log(`[V-SQR-10-03] grouped into ${grouped.size} groups`);

    for (const entries of grouped.values()) {
        const groupHasTimestamps = entries.some(d => squirrelTimeKey in d);

        let best: Data;
        if (!groupHasTimestamps) {
            best = entries[0];
        } else {
            best = entries.reduce((a, b) => {
                const timeA = a[squirrelTimeKey] || 0;
                const timeB = b[squirrelTimeKey] || 0;
                return timeB > timeA ? b : a;
            });
        }

        delete best[squirrelTimeKey];
        output.push(best);
    }

    for (const entry of withoutId) {
        delete entry[squirrelTimeKey];
        output.push(entry);
    }

    return output;
}

export async function replicationFindOne(squirrel: Squirrel, id: string, query: VQueryT.FindOne): Promise<Data | null> {
    console.log(`[V-SQR-11-01] replicationFindOne, id: ${id}`);
    let data = await findGetData(squirrel, {
        ...query,
        dbFindOpts: {
            limit: 1
        }
    }, id);

    if (!data.length) return null;

    const squirrelTimeData = data.filter(d => squirrelTimeKey in d);
    console.log(`[V-SQR-11-02] squirrelTimeData count: ${squirrelTimeData.length}`);

    if (!squirrelTimeData.length) {
        console.log(`[V-SQR-11-03] no timestamps, returning first result`);
        return data[0];
    }

    squirrelTimeData.sort((a, b) => b[squirrelTimeKey] - a[squirrelTimeKey]);
    const first = squirrelTimeData[0];
    delete first[squirrelTimeKey];
    console.log(`[V-SQR-11-04] returning latest result with timestamp`);

    return first;
}

async function findGetData(squirrel: Squirrel, query: VQueryT.Find, id: string) {
    console.log(`[V-SQR-12-01] findGetData, id: ${id}`);
    if (id) {
        const replicas = getReplicaServers(squirrel, id);
        console.log(`[V-SQR-12-02] replicas count: ${replicas.length}`);
        if (!replicas.length) return [];

        const responses: Data[] = [];
        for (const server of replicas) {
            try {
                const client = new ValtheraRemote({
                    ...squirrel.authConfig,
                    url: server.host
                });

                const res = await client.find(query);
                if (res.length) responses.push(...res);
            } catch (e) {
                console.log(`[V-SQR-12-03] error querying ${server.host}: ${e.message}`);
            }
        }

        console.log(`[V-SQR-12-04] total responses: ${responses.length}`);
        return responses;
    } else {
        console.log(`[V-SQR-12-05] no id, using fullScanReq`);
        let data: Data[] = await fullScanReq(squirrel, query, "find", false);
        data = data.flat();
        console.log(`[V-SQR-12-06] fullScan returned ${data.length} results`);
        return data;
    }
}
