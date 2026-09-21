/** Six-digit public org number (100000–999999), no leading zero. */
export const ORG_NO_RE = /^[1-9][0-9]{5}$/;

/** Reject UUID-shaped login input before orgNo validation. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
