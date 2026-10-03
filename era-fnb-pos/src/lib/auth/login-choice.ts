/**
 * Set by a password logout on a paired tablet so the next redirect without a
 * session opens `/login`, not `/pin`. Edge-safe: middleware imports it.
 */
export const LOGIN_CHOICE_COOKIE = "era_fnb_login_choice";
export const LOGIN_CHOICE_PASSWORD = "password";
export const LOGIN_CHOICE_MAX_AGE_S = 10 * 60;
