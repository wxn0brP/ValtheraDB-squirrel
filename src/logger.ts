export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function log(level: LogLevel, category: string, ...args: any[]) {
	if (!shouldLog(level)) return;
	const prefix = `[${level.toUpperCase()}] [${category}]`;
	if (level === "error") {
		console.error(prefix, ...args);
	} else {
		console.log(prefix, ...args);
	}
}

export const logger = {
	debug: (category: string, ...args: any[]) => log("debug", category, ...args),
	info: (category: string, ...args: any[]) => log("info", category, ...args),
	warn: (category: string, ...args: any[]) => log("warn", category, ...args),
	error: (category: string, ...args: any[]) => log("error", category, ...args),
};
