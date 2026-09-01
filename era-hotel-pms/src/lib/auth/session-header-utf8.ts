/** Prefix for UTF-8 session values in request headers (Fetch Headers = ByteString / latin1). */
export const SESSION_HEADER_UTF8_PREFIX = "utf8:";

/** Encode text for Edge middleware `Headers#set` (throws on code points > 255). */
export function encodeSessionHeaderUtf8(value: string): string {
  if (!value) return value;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) {
      return SESSION_HEADER_UTF8_PREFIX + encodeURIComponent(value);
    }
  }
  return value;
}

/** Decode `encodeSessionHeaderUtf8` values from incoming request headers. */
export function decodeSessionHeaderUtf8(value: string): string {
  if (!value) return value;
  if (value.startsWith(SESSION_HEADER_UTF8_PREFIX)) {
    return decodeURIComponent(value.slice(SESSION_HEADER_UTF8_PREFIX.length));
  }
  return value;
}
