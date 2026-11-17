import { describe, expect, test } from "bun:test";
import { parseAuthMode, safeNext } from "../src/lib/authNavigation";

describe("auth navigation", () => {
  test("keeps a protected request link after login", () => {
    expect(safeNext("/requests?request=6f0273d0-13a4-4aa0-a6a7-1bcb0442f26e")).toBe("/requests?request=6f0273d0-13a4-4aa0-a6a7-1bcb0442f26e");
  });

  test("rejects external and protocol-relative redirects", () => {
    expect(safeNext("https://example.com/requests")).toBe("/requests");
    expect(safeNext("//example.com/requests")).toBe("/requests");
    expect(safeNext("/\\example.com/requests")).toBe("/requests");
    expect(safeNext(null)).toBe("/requests");
  });

  test("uses Requests by default and prevents an auth redirect loop", () => {
    expect(safeNext("/")).toBe("/requests");
    expect(safeNext("/auth?next=/tasks")).toBe("/requests");
    expect(safeNext("/employee-login")).toBe("/requests");
  });

  test("recognizes all existing auth actions and defaults safely", () => {
    expect(parseAuthMode("signup")).toBe("signup");
    expect(parseAuthMode("forgot")).toBe("forgot");
    expect(parseAuthMode("reset")).toBe("reset");
    expect(parseAuthMode("unexpected")).toBe("login");
  });
});
