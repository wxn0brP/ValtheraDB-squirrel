# Squirrel

ValtheraDB-Squirrel is an AP routing layer over low unreliable storage nodes, with no consistency or durability guarantees.

## How it works

### Routing

Fully compatible with the ValtheraDB server API. Squirrel sits between the client and storage nodes, resolving the target server for each request and responding with a `307` redirect to the correct node.

```
client -> Squirrel (hash _id -> server) -> 307 redirect -> ValtheraDB node
```

### Epochs

Timestamped snapshots of the cluster's server list. Documents are routed based on which epoch was active when their `_id` was generated. New epochs are created on first start or when the server list changes.

### AP over CA

When the primary server is down, writes are queued on a backup node in `__squirrel_back`. The original server retrieves them via `POST /__squirrel/get-data` and acknowledges removal via `POST /__squirrel/get-data-ack`.

### Full Scan

When no `_id` is present and `SQUIRREL_ALLOW_FULL_SCAN=true`, Squirrel broadcasts the operation to all servers.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SQUIRREL_DB` | Yes | - | Database name |
| `SQUIRREL_AUTH` | Yes | - | Auth token |
| `SQUIRREL_SEEDS` | Yes | - | Space-separated seed URLs (`http://<server-id>@<host>:<port>`) |
| `SQUIRREL_ALLOW_FULL_SCAN` | No | `false` | Query without `_id`, broadcast to all servers |
| `SQUIRREL_ALLOW_BACKUP_SERVER` | No | `false` | Queue writes on backup when primary is down |

## Usage

1. `cp .env.example .env`

2. Edit .env

3. With Node
    ```bash
    npm install
    npm run build
    npm start
    ```

3. With Bun
    ```bash
    bun install
    bun run src/index.ts
    ```

## License

MIT
