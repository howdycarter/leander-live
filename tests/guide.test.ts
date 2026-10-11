import { describe, expect, it } from "vitest";
import { currentGuide, BOOKING_URL } from "../src/GuidePage";
import records from "../src/data/guide.json";
import { isCurrentGuideEvent } from "../src/lib/guidePolicy";
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
  it("excludes an ended event even when its source review is still current", () => {
    const now = Date.parse("2026-10-11T09:00:00Z");
    const event = {...records[0], reviewStatus:"verified", endsAt:"2026-10-11T08:59:00Z"};
    expect(isCurrentGuideEvent(event, now)).toBe(false);
    expect(isCurrentGuideEvent({...event,endsAt:"2026-10-11T12:00:00Z"},now)).toBe(true);
  });
  it.each([
    {checkedAt:"2026-10-12T00:00:00Z"},
    {reviewDueAt:"2026-10-20T00:00:00Z"},
    {endsAt:"invalid"},
    {reviewDueAt:"invalid"},
  ])("holds malformed or overlong freshness windows %j", invalid => {
    expect(isCurrentGuideEvent({...records[0],reviewStatus:"verified",...invalid},Date.parse("2026-10-11T09:00:00Z"))).toBe(false);
  });
});
