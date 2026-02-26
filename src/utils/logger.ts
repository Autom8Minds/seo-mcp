const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    if (shouldLog('debug')) console.error(`[DEBUG] ${msg}`, ...args);
  },
  info(msg: string, ...args: unknown[]): void {
    if (shouldLog('info')) console.error(`[INFO] ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    if (shouldLog('warn')) console.error(`[WARN] ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    if (shouldLog('error')) console.error(`[ERROR] ${msg}`, ...args);
  },
};
