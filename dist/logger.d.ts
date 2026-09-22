export type LogLevel = "debug" | "info" | "warn" | "error";
export declare const logger: {
    debug: (category: string, ...args: any[]) => void;
    info: (category: string, ...args: any[]) => void;
    warn: (category: string, ...args: any[]) => void;
    error: (category: string, ...args: any[]) => void;
};
