import { expect, test } from "bun:test";
import { pluralRu } from "../src/lib/pluralRu";

for (const [n, expected] of [[1,"заявка"],[2,"заявки"],[5,"заявок"],[11,"заявок"],[12,"заявок"],[14,"заявок"],[21,"заявка"],[22,"заявки"],[81,"заявка"],[0,"заявок"],[111,"заявок"]] as const) {
  test(`${n} requests use ${expected}`, () => expect(pluralRu(n,["заявка","заявки","заявок"])).toBe(expected));
}
test("active task forms",()=>{expect(pluralRu(2,["активная задача","активные задачи","активных задач"])).toBe("активные задачи");expect(pluralRu(1,["активной","активных","активных"])).toBe("активной");expect(pluralRu(2,["активной","активных","активных"])).toBe("активных");});
test("minutes forms",()=>{expect(pluralRu(1,["минута","минуты","минут"])).toBe("минута");expect(pluralRu(2,["минута","минуты","минут"])).toBe("минуты");expect(pluralRu(12,["минута","минуты","минут"])).toBe("минут");});