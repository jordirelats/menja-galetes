// Al Chromium (Vivaldi, Chrome, Brave) l'API es diu `chrome`; al Firefox, `browser`.
// Les dues tornen promeses: amb aquest àlies, la finestreta i les opcions serveixen per a tots dos.
if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") globalThis.browser = globalThis.chrome;
