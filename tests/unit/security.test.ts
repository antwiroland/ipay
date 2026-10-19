import { describe, expect, it } from "vitest";
import { normalizeGhanaPhone, safeInternalPath } from "@/lib/validation";
import { base32Encode, decryptField, encryptField, hashPassword, totpCode, verifyPassword, verifyTotp } from "@/server/auth/crypto";
import { toCsv } from "@/server/services/reports";
import { renderTemplate } from "@/server/notifications/templates";

describe("password hashing", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("CorrectHorse9");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("CorrectHorse9");
    expect(await verifyPassword("CorrectHorse9", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await hashPassword("CorrectHorse9")).not.toBe(h); // salted
  });
});

describe("TOTP (RFC 6238)", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC test vector (last 6 digits)", () => {
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(totpCode(secret, 1111111109_000)).toBe("081804");
  });
  it("accepts ±1 step drift only", () => {
    const t = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, t - 30_000), t)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, t - 90_000), t)).toBe(false);
    expect(verifyTotp(secret, "abc123", t)).toBe(false);
  });
});

describe("field encryption", () => {
  it("round-trips and is authenticated", () => {
    const c = encryptField("JBSWY3DPEHPK3PXP");
    expect(decryptField(c)).toBe("JBSWY3DPEHPK3PXP");
    const tampered = c.slice(0, -2) + (c.endsWith("A") ? "BB" : "AA");
    expect(() => decryptField(tampered)).toThrow();
  });
});

describe("input safety", () => {
  it("normalizes Ghana phone numbers", () => {
    expect(normalizeGhanaPhone("024 123 4567")).toBe("+233241234567");
    expect(normalizeGhanaPhone("+233 50 123 4567")).toBe("+233501234567");
    expect(normalizeGhanaPhone("233201234567")).toBe("+233201234567");
    expect(normalizeGhanaPhone("12345")).toBeNull();
  });
  it("blocks open redirects", () => {
    expect(safeInternalPath("/products/x?y=1")).toBe("/products/x?y=1");
    expect(safeInternalPath("https://evil.com")).toBe("/");
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath("/\\evil.com")).toBe("/");
  });
  it("neutralises CSV formula injection", () => {
    const csv = toCsv([{ a: "=HYPERLINK(1)", b: 'say "hi"' }], [{ key: "a", label: "A" }, { key: "b", label: "B" }]);
    expect(csv).toBe(`A,B\n'=HYPERLINK(1),"say ""hi"""`);
  });
  it("renders templates without evaluating code", () => {
    expect(renderTemplate("Hi {{name}} {{missing}}", { name: "Ama" })).toBe("Hi Ama ");
  });
});
