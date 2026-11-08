/** keepalive analytics posts are small; reject larger bodies before parse or persist. */
export const MAX_TELEMETRY_BODY_BYTES = 64 * 1024;
