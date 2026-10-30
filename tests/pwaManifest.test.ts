import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"));
test("installed CRSS starts at personal cabinet", () => expect(manifest.start_url).toBe("/me"));
test("installed app covers all application routes", () => expect(manifest.scope).toBe("/"));
test("home-screen app launches standalone", () => expect(manifest.display).toBe("standalone"));
