import { describe, expect, test } from "bun:test";
import { formatRequestPublicNumber as f } from "../src/lib/requestPublicNumber";
describe("formatRequestPublicNumber", () => {
  test("pads to 5 digits", () => expect(f({ public_number: 1 })).toBe("REQ-00001"));
  test("keeps 5 digits", () => expect(f({ public_number: 12345 })).toBe("REQ-12345"));
  test("missing number gives null", () => expect(f({ public_number: null })).toBeNull());
  test("never truncates overflow", () => expect(f({ public_number: 100000 })).toBeNull());
});
