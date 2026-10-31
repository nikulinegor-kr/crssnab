import { expect, test } from "bun:test";
import { chooseImageSaveMethod } from "../src/lib/saveImage";

test("phone in browser saves PNG through the share sheet", () => {
  expect(chooseImageSaveMethod({ native: false, touch: true, canShareFiles: true })).toBe("share");
});

test("computer always saves PNG as a file", () => {
  expect(chooseImageSaveMethod({ native: false, touch: false, canShareFiles: true })).toBe("download");
});

test("phone without file sharing falls back to a file download", () => {
  expect(chooseImageSaveMethod({ native: false, touch: true, canShareFiles: false })).toBe("download");
});

test("installed app uses the native share sheet", () => {
  expect(chooseImageSaveMethod({ native: true, touch: true, canShareFiles: false })).toBe("native");
});
