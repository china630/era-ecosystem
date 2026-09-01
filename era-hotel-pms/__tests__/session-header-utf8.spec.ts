import {
  decodeSessionHeaderUtf8,
  encodeSessionHeaderUtf8,
  SESSION_HEADER_UTF8_PREFIX,
} from "@/lib/auth/session-header-utf8";

describe("session-header-utf8", () => {
  it("leaves ASCII and latin1 unchanged", () => {
    expect(encodeSessionHeaderUtf8("reception")).toBe("reception");
    expect(encodeSessionHeaderUtf8("José")).toBe("José");
    expect(decodeSessionHeaderUtf8("José")).toBe("José");
  });

  it("round-trips Cyrillic full names", () => {
    const name = "Əliyev İlham";
    const encoded = encodeSessionHeaderUtf8(name);
    expect(encoded.startsWith(SESSION_HEADER_UTF8_PREFIX)).toBe(true);
    expect(decodeSessionHeaderUtf8(encoded)).toBe(name);
  });
});
