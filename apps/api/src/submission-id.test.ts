import { describe, expect, it } from "vitest";
import { formatSubmissionId } from "./submission-id.js";
describe("formatSubmissionId", () => {
  it("creates compact StoryBoard identifiers", () => expect(formatSubmissionId(1)).toBe("SB0001"));
  it("does not truncate larger sequences", () => expect(formatSubmissionId(10_000)).toBe("SB10000"));
  it("rejects invalid counters", () => expect(() => formatSubmissionId(0)).toThrow());
});
