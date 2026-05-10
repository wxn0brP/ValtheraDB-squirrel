import { Squirrel } from "../squirrel";
import { logger } from "../logger";

export function getReplicaServers(squirrel: Squirrel, id: string) {
    const { epoch, idx } = squirrel.topology.getServerForId(id);
    const serversIds = selectServers(epoch.serverIds, idx, squirrel.config.replicationFactor);
    return serversIds.map(id => squirrel.topology.servers.get(id));
}

function selectServers(servers: string[], idx: number, required: number): string[] {
    logger.debug("REPLICATION", "[V-SQR-14-01] selectServers, total servers:", servers.length, "idx:", idx, "required:", required);
    const n = servers.length;
    if (n === 0 || required <= 0) {
        logger.warn("REPLICATION", "[V-SQR-14-02] no servers or required <=0, returning empty");
        return [];
    }

    const result: string[] = [];
    let currentIndex = idx % n;

    for (let i = 0; i < Math.min(required, n); i++) {
        result.push(servers[currentIndex]);
        currentIndex = (currentIndex + 1) % n;
    }

    logger.debug("REPLICATION", "[V-SQR-14-03] selected", result.length, "servers");
    return result;
}
