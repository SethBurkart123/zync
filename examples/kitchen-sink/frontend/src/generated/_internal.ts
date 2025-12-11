// Internal bridge utilities - do not modify
let _baseUrl: string | null = null;

export interface BridgeError {
    code: string;
    message: string;
    details?: unknown;
}

export class BridgeRequestError extends Error {
    code: string;
    details?: unknown;
    
    constructor(error: BridgeError) {
        super(error.message);
        this.name = "BridgeRequestError";
        this.code = error.code;
        this.details = error.details;
    }
}

export interface BridgeChannel<T> {
    subscribe(callback: (data: T) => void): void;
    onError(callback: (error: BridgeError) => void): void;
    onClose(callback: () => void): void;
    close(): void;
}

export function initBridge(baseUrl: string): void {
    _baseUrl = baseUrl.replace(/\/$/, "");
    console.log(`[PyBridge] Initialized with base URL: ${_baseUrl}`);
}

export function getBaseUrl(): string {
    if (!_baseUrl) {
        throw new Error(
            "[PyBridge] Bridge not initialized. Call initBridge(url) first."
        );
    }
    return _baseUrl;
}

function convertKeysToSnakeCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
            result[snakeKey] = convertKeysToSnakeCase(value);
        }
        return result;
    }
    return obj;
}

function convertKeysToCamelCase(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
            result[camelKey] = convertKeysToCamelCase(value);
        }
        return result;
    }
    return obj;
}

export async function request<T>(command: string, args: unknown): Promise<T> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/command/${command}`;
    
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(convertKeysToSnakeCase(args)),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new BridgeRequestError({
            code: data.code || "UNKNOWN_ERROR",
            message: data.message || "An unknown error occurred",
            details: data.details,
        });
    }
    
    return convertKeysToCamelCase(data.result) as T;
}

export function createChannel<T>(command: string, args: unknown): BridgeChannel<T> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/channel/${command}`;
    
    let eventSource: EventSource | null = null;
    let messageCallback: ((data: T) => void) | null = null;
    let errorCallback: ((error: BridgeError) => void) | null = null;
    let closeCallback: (() => void) | null = null;
    
    // Start the SSE connection
    const startConnection = async () => {
        // First, initiate the channel via POST
        const initResponse = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(convertKeysToSnakeCase(args)),
        });
        
        if (!initResponse.ok) {
            const data = await initResponse.json();
            if (errorCallback) {
                errorCallback({
                    code: data.code || "CHANNEL_INIT_ERROR",
                    message: data.message || "Failed to initialize channel",
                    details: data.details,
                });
            }
            return;
        }
        
        const { channelId } = await initResponse.json();
        
        // Now connect to SSE endpoint
        eventSource = new EventSource(`${baseUrl}/channel/stream/${channelId}`);
        
        eventSource.addEventListener("message", (event) => {
            if (messageCallback) {
                const data = JSON.parse(event.data);
                messageCallback(convertKeysToCamelCase(data) as T);
            }
        });
        
        eventSource.addEventListener("error", (event) => {
            if (errorCallback) {
                errorCallback({
                    code: "CHANNEL_ERROR",
                    message: "Channel connection error",
                });
            }
        });
        
        eventSource.addEventListener("close", () => {
            if (closeCallback) {
                closeCallback();
            }
            eventSource?.close();
        });
    };
    
    // Start connection immediately
    startConnection();
    
    return {
        subscribe(callback: (data: T) => void): void {
            messageCallback = callback;
        },
        onError(callback: (error: BridgeError) => void): void {
            errorCallback = callback;
        },
        onClose(callback: () => void): void {
            closeCallback = callback;
        },
        close(): void {
            eventSource?.close();
            if (closeCallback) {
                closeCallback();
            }
        },
    };
}
