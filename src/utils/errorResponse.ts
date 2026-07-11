/**
 * Decide what error text is safe to send to the client.
 *
 * Known 4xx errors (validation, "already registered", "Invalid credentials",
 * "Insufficient funds", "not found", etc.) are intentional, human-readable
 * domain errors — safe to surface as-is.
 *
 * Anything else (5xx / unexpected) may contain internal details (DB driver
 * errors, stack traces via err.message, etc.) and must be hidden from the
 * client outside development.
 */
export function safeErrorMessage(err: any, status: number): string {
  if (status < 500) {
    return err?.message || 'Request failed';
  }

  if (process.env.NODE_ENV === 'development') {
    return err?.message || 'Internal server error';
  }

  return 'Something went wrong';
}
