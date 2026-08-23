/*
 * The test suite runs in a plain Node environment, where the real
 * `server-only` guard throws on import by design. The suite aliases the guard
 * to this empty module, so a server module can be exercised by a test while
 * the application build keeps the guard fully armed.
 */
export {};
