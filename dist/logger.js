const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
function shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}
function log(level, category, ...args) {
    if (!shouldLog(level))
        return;
    const prefix = `[${level.toUpperCase()}] [${category}]`;
    if (level === "error") {
        console.error(prefix, ...args);
    }
    else {
        console.log(prefix, ...args);
    }
}
export const logger = {
    debug: (category, ...args) => log("debug", category, ...args),
    info: (category, ...args) => log("info", category, ...args),
    warn: (category, ...args) => log("warn", category, ...args),
    error: (category, ...args) => log("error", category, ...args),
};
