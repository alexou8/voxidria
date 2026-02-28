/**
 * Structured logging utility for Supabase Edge Functions.
 *
 * All logs include request_id for tracing a single request across logs.
 * Logs are visible in: Supabase Dashboard → Edge Functions → Logs.
 */
export interface LogContext {
  request_id: string;
  function_name: string;
  user_id?: string;
  session_id?: string;
  latency_ms?: number;
  [key: string]: unknown;
}

export function logInfo(context: LogContext, message: string): void {
  console.log(JSON.stringify({ level: "INFO", message, ...context }));
}

export function logError(context: LogContext, message: string, error?: unknown): void {
  console.error(JSON.stringify({
    level: "ERROR",
    message,
    error: error instanceof Error ? error.message : String(error),
    ...context,
  }));
}
