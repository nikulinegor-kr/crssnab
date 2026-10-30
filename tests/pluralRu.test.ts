import { expect, test } from "bun:test";
import { pluralRu } from "../src/lib/pluralRu";
import { formatExecEventTime } from "../src/lib/executivePanel";

for (const [n, expected] of [[1,"заявка"],[2,"заявки"],[5,"заявок"],[11,"заявок"],[12,"заявок"],[14,"заявок"],[21,"заявка"],[22,"заявки"],[81,"заявка"],[0,"заявок"],[111,"заявок"]] as const) {
  test(`${n} requests use ${expected}`, () => expect(pluralRu(n,["заявка","заявки","заявок"])).toBe(expected));
}
test("active task forms",()=>{expect(pluralRu(2,["активная задача","активные задачи","активных задач"])).toBe("активные задачи");expect(pluralRu(1,["активной","активных","активных"])).toBe("активной");expect(pluralRu(2,["активной","активных","активных"])).toBe("активных");});
test("minutes forms",()=>{expect(pluralRu(1,["минута","минуты","минут"])).toBe("минута");expect(pluralRu(2,["минута","минуты","минут"])).toBe("минуты");expect(pluralRu(12,["минута","минуты","минут"])).toBe("минут");});
for (const [minutes, expected] of [[1,"1 минута назад"],[2,"2 минуты назад"],[12,"12 минут назад"]] as const) {
  test(`event time ${minutes} minutes`,()=>expect(formatExecEventTime("2026-10-30T05:00:00Z",new Date(Date.parse("2026-10-30T05:00:00Z")+minutes*60000))).toBe(expected));
}