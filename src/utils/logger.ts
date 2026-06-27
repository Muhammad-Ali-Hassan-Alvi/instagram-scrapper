type LogLevel = "info" | "warn" | "error" | "debug";

function formatMessage(level: LogLevel, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  /** Logs an informational message. */
  info(message: string, ...args: unknown[]): void {
    console.log(formatMessage("info", message), ...args);
  },

  /** Logs a warning message. */
  warn(message: string, ...args: unknown[]): void {
    console.warn(formatMessage("warn", message), ...args);
  },

  /** Logs an error message. */
  error(message: string, ...args: unknown[]): void {
    console.error(formatMessage("error", message), ...args);
  },

  /** Logs a debug message. */
  debug(message: string, ...args: unknown[]): void {
    console.debug(formatMessage("debug", message), ...args);
  },
};
