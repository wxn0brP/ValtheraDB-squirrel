FROM oven/bun:latest

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN bun install --production --force

EXPOSE 14415

CMD ["bun", "run", "src/index.ts"]
