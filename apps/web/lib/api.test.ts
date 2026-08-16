import { describe, expect, it } from "vitest";
import { date } from "./api";
describe("date formatter", () => {
  it("renders missing dates safely", () => expect(date()).toBe("—"));
  it("renders invalid dates safely", () => expect(date("not-a-date")).toBe("—"));
});
