# Squirrel

Sharding and routing layer for the ValtheraDB ecosystem.

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
