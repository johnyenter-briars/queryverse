import { invoke } from "@tauri-apps/api/core";

type FrontendLogLevel = "error" | "warn" | "information" | "debug" | "trace";

interface FrontendLogRequest {
    level: FrontendLogLevel;
    message: string;
    source?: string;
}

const DEFAULT_SOURCE = "queryverse::frontend";

const serializeContext = (context: unknown): string => {
    if (context instanceof Error) {
        return context.stack || context.message;
    }

    if (typeof context === "string") {
        return context;
    }

    if (typeof context === "undefined") {
        return "undefined";
    }

    try {
        const serialized = JSON.stringify(context);
        return typeof serialized === "undefined" ? String(context) : serialized;
    } catch {
        return String(context);
    }
};

const logToBackend = (
    level: FrontendLogLevel,
    message: string,
    context?: unknown,
    source: string = DEFAULT_SOURCE
): void => {
    const payload = context === undefined
        ? message
        : `${message} | ${serializeContext(context)}`;

    void invoke("log_frontend", {
        request: {
            level,
            message: payload,
            source,
        } satisfies FrontendLogRequest,
    }).catch(() => {
        // Ignore frontend log transport errors (e.g. non-Tauri browser runtime).
    });
};

export const logError = (message: string, context?: unknown, source?: string): void => {
    logToBackend("error", message, context, source);
};

export const logWarn = (message: string, context?: unknown, source?: string): void => {
    logToBackend("warn", message, context, source);
};

export const logInfo = (message: string, context?: unknown, source?: string): void => {
    logToBackend("information", message, context, source);
};

export const logDebug = (message: string, context?: unknown, source?: string): void => {
    logToBackend("debug", message, context, source);
};

export const logTrace = (message: string, context?: unknown, source?: string): void => {
    logToBackend("trace", message, context, source);
};
