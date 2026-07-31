import { redactSensitive, safeSerializeError } from "@forge/security";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  service: string;
  environment: string;
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  requestId?: string;
  eventType?: string;
  durationMs?: number;
}

export interface Logger {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
  child: (context: Partial<LogContext>) => Logger;
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function write(
  minLevel: LogLevel,
  level: LogLevel,
  context: LogContext,
  message: string,
  fields: Record<string, unknown> = {},
): void {
  if (levelOrder[level] < levelOrder[minLevel]) return;

  const payload = redactSensitive({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...fields,
    error: fields.error ? safeSerializeError(fields.error) : undefined,
  });

  const line = JSON.stringify(payload);
  if (level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function createLogger(context: LogContext, options: { level?: LogLevel } = {}): Logger {
  const minLevel = options.level ?? "info";

  const logger: Logger = {
    debug: (message, fields) => write(minLevel, "debug", context, message, fields),
    info: (message, fields) => write(minLevel, "info", context, message, fields),
    warn: (message, fields) => write(minLevel, "warn", context, message, fields),
    error: (message, fields) => write(minLevel, "error", context, message, fields),
    child: (childContext) => createLogger({ ...context, ...childContext }, { level: minLevel }),
  };

  return logger;
}
