import { describe, expect, it } from "bun:test";
import { removePlannerAttachment } from "../src/lib/plannerAttachments";
import type { PlannerAttachment } from "../src/hooks/usePlannerTasks";

const attachment = (name: string, path = "", url = ""): PlannerAttachment => ({ name, path, url });

describe("planner attachment removal", () => {
  it("removes only the selected legacy attachment when paths and URLs coincide", () => {
    const first = attachment("first.pdf");
    const second = attachment("second.pdf");
    const third = attachment("third.pdf", "third-path", "third-url");

    expect(removePlannerAttachment([first, second, third], first)).toEqual([second, third]);
  });

  it("preserves another attachment that shares the selected file URL", () => {
    const first = attachment("first.pdf", "first-path", "shared-url");
    const second = attachment("second.pdf", "second-path", "shared-url");

    expect(removePlannerAttachment([first, second], first)).toEqual([second]);
  });
});
