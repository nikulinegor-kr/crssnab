import { describe, expect, test } from "bun:test";
import { parseQrInput, qrPayload, validateOperation } from "../src/lib/warehouseQr";

const token = "0123456789abcdef0123456789abcdef";

describe("warehouse QR payload", () => {
  test("round-trips cell and unit codes", () => {
    expect(parseQrInput(qrPayload("cell", token))).toEqual({ kind: "cell", token });
    expect(parseQrInput(qrPayload("unit", token))).toEqual({ kind: "unit", token });
  });
  test("accepts bare token and scanner semicolon layout", () => {
    expect(parseQrInput(token.toUpperCase())).toEqual({ kind: null, token });
    expect(parseQrInput(`CRSS;U;${token}`)?.kind).toBe("unit");
  });
  test("rejects foreign codes", () => expect(parseQrInput("https://example.com")).toBeNull());
});

describe("operation pre-check", () => {
  test("item quantity must be 1", () => expect(validateOperation({ type: "receipt", kind: "item", quantity: 2, toWarehouseId: "w" })).toContain("Изделие учитывается поштучно: количество 1"));
  test("issue needs recipient and request or object", () => {
    const e = validateOperation({ type: "issue", kind: "batch", quantity: 1, fromWarehouseId: "w", available: 5 });
    expect(e).toContain("Укажите получателя");
    expect(e).toContain("Укажите заявку или объект");
  });
  test("cannot issue more than available", () => expect(validateOperation({ type: "issue", kind: "batch", quantity: 11, available: 10, fromWarehouseId: "w", recipientName: "А", requestId: "r" })).toContain("Недостаточно остатка: доступно 10"));
  test("return limited by issued remainder", () => expect(validateOperation({ type: "return", kind: "batch", quantity: 5, issueId: "i", returnable: 4 })).toContain("Можно вернуть не больше 4"));
  test("valid move passes", () => expect(validateOperation({ type: "move", kind: "batch", quantity: 30, available: 100, fromWarehouseId: "w", fromCellId: "a", toWarehouseId: "w", toCellId: "b" })).toEqual([]));
});
