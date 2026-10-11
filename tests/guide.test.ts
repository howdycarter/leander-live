import { describe, expect, it } from "vitest";
import { currentGuide, BOOKING_URL } from "../src/GuidePage";
import records from "../src/data/guide.json";
describe("reviewed public guide", () => {
  it("holds cached-only source selections until fresh review", () => {
    expect(currentGuide(Date.parse("2026-10-11T09:00:00Z"))).toHaveLength(0);
    expect(currentGuide(Date.parse("2026-10-13T08:43:00Z"))).toHaveLength(0);
    expect(currentGuide(Date.parse("2026-10-18T00:00:00Z"))).toHaveLength(0);
  });
  it("keeps a fixed attribution token and a source for each selection", () => {
    expect(BOOKING_URL).toBe("https://howdycarter.com/book?source=leander-live");
    for (const event of records) {
      expect(new URL(event.sourceUrl).hostname).toBe("www.leandertx.gov");
      expect(Date.parse(event.endsAt)).toBeGreaterThan(Date.parse(event.startsAt));
      expect(Date.parse(event.reviewDueAt)-Date.parse(event.checkedAt)).toBe(48*3600000);
    }
  });
});
