import { describe, expect, test } from "bun:test";
import { sortRequestsByDateDesc } from "../src/lib/requestRegistry";

describe("requests registry date order", () => {
  test("sorts the general list strictly from newest to oldest", () => {
    const sorted = sortRequestsByDateDesc([
      { id: "old", request_date: "2025-01-02" },
      { id: "new", request_date: "2026-11-16" },
      { id: "middle", request_date: "2026-01-05" },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["new", "middle", "old"]);
  });

  test("keeps newest-first order after splitting into phases", () => {
    const sorted = sortRequestsByDateDesc([
      { id: "old", request_date: "2025-01-02", phase: "work" },
      { id: "new", request_date: "2026-11-16", phase: "work" },
      { id: "other", request_date: "2026-06-01", phase: "other" },
    ]);
    expect(sorted.filter((item) => item.phase === "work").map((item) => item.id)).toEqual(["new", "old"]);
  });

  test("places missing or invalid dates after valid dates", () => {
    const sorted = sortRequestsByDateDesc([
      { id: "missing", request_date: null },
      { id: "valid", request_date: "2026-01-01" },
      { id: "invalid", request_date: "not-a-date" },
    ]);
    expect(sorted[0].id).toBe("valid");
    expect(sorted.slice(1).map((item) => item.id).sort()).toEqual(["invalid", "missing"]);
  });
});
