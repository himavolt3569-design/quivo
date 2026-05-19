/**
 * Structured logger.
 *
 * One module for server, edge and client. JSON in production, prettified in
 * development. Per-request context (requestId, userId, shopId) flows through
 * AsyncLocalStorage on Node so downstream calls don't have to thread it.
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

type LogRecord = {
  level: LogLevel;
  time: string;
  msg: string;
  [key: string]: unknown;
};

type ChildBindings = Record<string, unknown>;

const isServer = typeof window === "undefined";
const isEdge = typeof process === "undefined" || (process as { release?: { name?: string } }).release?.name !== "node";
const isProd = (typeof process !== "undefined" && process.env?.NODE_ENV) === "production";
const envLevel = (typeof process !== "undefined" ? process.env?.LOG_LEVEL : undefined) as LogLevel | undefined;
const minLevel: LogLevel = envLevel && envLevel in LEVEL_RANK ? envLevel : isProd ? "info" : "debug";

const SENSITIVE_KEY_RE = /(?:^|_)(?:password|secret|token|api_?key|authorization|cookie|set_cookie|session|refresh_token|access_token|otp|pin|cvv|card_number)$/i;

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[truncated]";
  if (typeof value === "string") return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value as unknown as Record<string, unknown>),
    };
  }
  if (Array.isArray(value)) {
    return value.length > 50
      ? [...value.slice(0, 50).map((v) => redact(v, depth + 1)), `[+${value.length - 50} more]`]
      : value.map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

// AsyncLocalStorage context — only available on Node runtime, not edge or browser.
type RequestContext = { requestId?: string; userId?: string; shopId?: string; [key: string]: unknown };

type AsyncLocalStorageLike<T> = {
  getStore(): T | undefined;
  run<R>(store: T, fn: () => R): R;
};

let als: AsyncLocalStorageLike<RequestContext> | null = null;
let alsAttempted = false;

function tryLoadAls(): AsyncLocalStorageLike<RequestContext> | null {
  if (alsAttempted) return als;
  alsAttempted = true;
  if (!isServer || isEdge) return null;
  try {
    // Dynamic require keeps this out of the edge/browser bundle.
    const dynamicRequire = Function("return require")() as (name: string) => unknown;
    const mod = dynamicRequire("node:async_hooks") as {
      AsyncLocalStorage: new <T>() => AsyncLocalStorageLike<T>;
    };
    als = new mod.AsyncLocalStorage<RequestContext>();
    return als;
  } catch {
    return null;
  }
}

export function getRequestContext(): RequestContext | undefined {
  return tryLoadAls()?.getStore();
}

export function runWithRequestContext<R>(ctx: RequestContext, fn: () => R): R {
  const storage = tryLoadAls();
  return storage ? storage.run(ctx, fn) : fn();
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function emit(level: LogLevel, bindings: ChildBindings, msgOrObj: unknown, extra?: unknown) {
  if (!shouldEmit(level)) return;

  let msg = "";
  let data: Record<string, unknown> = {};
  if (typeof msgOrObj === "string") {
    msg = msgOrObj;
    if (extra && typeof extra === "object") {
      data = extra as Record<string, unknown>;
    } else if (extra !== undefined) {
      data = { extra };
    }
  } else if (msgOrObj instanceof Error) {
    msg = msgOrObj.message;
    data = { err: msgOrObj };
  } else if (msgOrObj && typeof msgOrObj === "object") {
    const obj = msgOrObj as Record<string, unknown>;
    const { msg: m, ...rest } = obj;
    msg = typeof m === "string" ? m : "";
    data = rest;
  } else {
    msg = String(msgOrObj ?? "");
  }

  const record: LogRecord = {
    level,
    time: new Date().toISOString(),
    msg,
    ...bindings,
    ...(getRequestContext() ?? {}),
    ...(redact(data) as Record<string, unknown>),
  };

  if (isProd || !isServer) {
    // Always JSON in prod and in the browser (devtools renders JSON well).
    const line = JSON.stringify(record);
    const fn = level === "error" || level === "fatal" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.log;
    fn(line);
    return;
  }

  // Server dev: pretty single-line.
  const palette: Record<LogLevel, string> = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    fatal: "\x1b[35m",
  };
  const reset = "\x1b[0m";
  const ts = record.time.slice(11, 23);
  const ctx = bindings.requestId || record.requestId ? `[${(bindings.requestId ?? record.requestId) as string}]` : "";
  const tail = Object.keys(data).length > 0 ? ` ${JSON.stringify(redact(data))}` : "";
  const stream = level === "error" || level === "fatal" ? console.error : level === "warn" ? console.warn : console.log;
  stream(`${palette[level]}${level.toUpperCase().padEnd(5)}${reset} ${ts} ${ctx} ${msg}${tail}`);
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  debug(obj: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  info(obj: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  warn(obj: Record<string, unknown>): void;
  warn(err: Error, msg?: string): void;
  error(msg: string, data?: Record<string, unknown>): void;
  error(obj: Record<string, unknown>): void;
  error(err: Error, msg?: string): void;
  fatal(msg: string, data?: Record<string, unknown>): void;
  child(bindings: ChildBindings): Logger;
}

function buildLogger(bindings: ChildBindings): Logger {
  return {
    debug: (a: unknown, b?: unknown) => emit("debug", bindings, a, b),
    info: (a: unknown, b?: unknown) => emit("info", bindings, a, b),
    warn: (a: unknown, b?: unknown) => emit("warn", bindings, a, b),
    error: (a: unknown, b?: unknown) => emit("error", bindings, a, b),
    fatal: (a: unknown, b?: unknown) => emit("fatal", bindings, a, b),
    child: (extra: ChildBindings) => buildLogger({ ...bindings, ...extra }),
  };
}

export const log: Logger = buildLogger({});
