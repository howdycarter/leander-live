import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const now = Date.parse("2026-10-11T08:00:00Z");
const event = { title: "Test event", description: "Test fixture only", startsAt: now + 86400000, venue: "Test venue", url: "https://www.leandertx.gov/Calendar.aspx?EID=3158" };
const lead = { businessName: "Test Business", contactName: "Test Owner", email: "test@example.test", vertical: "Other", interests: ["Growth mapping"], consentToContact: true, requestId: "test-request-00001", problem: "Our contact form needs repair." };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("ADMIN_KEY", "test-only-secret"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("event publication", () => {
  it("denies unauthenticated status changes and review access", async () => {
    const t = convexTest(schema, modules); const id = await t.mutation(api.events.submit, event);
    await expect(t.mutation(api.events.setStatus, {adminKey: "wrong", id, status: "approved"})).rejects.toThrow("Not authorized");
    await expect(t.query(api.events.listForReview, {adminKey: "wrong"})).rejects.toThrow("Not authorized");
    expect(await t.query(api.events.listUpcoming, {})).toEqual([]);
  });
  it("fails closed when the moderator key is missing", async () => {
    vi.stubEnv("ADMIN_KEY", ""); const t = convexTest(schema, modules);
    await expect(t.query(api.events.listForReview, {adminKey: ""})).rejects.toThrow("Not authorized");
  });
  it("requires verified source/end time; hides stale and cancelled records", async () => {
    const t = convexTest(schema, modules); const id = await t.mutation(api.events.submit, event);
    await expect(t.mutation(api.events.setStatus, {adminKey: "test-only-secret", id, status: "approved"})).rejects.toThrow("Review");
    const args = {adminKey: "test-only-secret", id, startsAt: event.startsAt, endsAt: event.startsAt + 3600000, venue: event.venue, url: event.url, sourceChecked: true};
    await expect(t.mutation(api.events.review, {...args, url: "javascript:alert(1)"})).rejects.toThrow();
    await expect(t.mutation(api.events.review, {...args, sourceChecked: false})).rejects.toThrow();
    await t.mutation(api.events.review, args);
    expect(await t.query(api.events.listUpcoming, {})).toHaveLength(1);
    await t.mutation(api.events.setStatus, {adminKey: "test-only-secret", id, status: "cancelled"});
    expect(await t.query(api.events.listUpcoming, {})).toHaveLength(0);
    await t.mutation(api.events.review, args); vi.setSystemTime(now + 49 * 3600000);
    expect(await t.query(api.events.listUpcoming, {})).toHaveLength(0);
  });
  it("keeps crawled and incomplete emailed records pending", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.events.upsertCrawled, event);
    await t.mutation(internal.events.insertFromEmail, {from: "test@example.test", subject: "Unknown date", body: "Please review our event."});
    const rows = await t.query(api.events.listForReview, {adminKey: "test-only-secret"});
    expect(rows.every(row => row.status === "pending")).toBe(true);
    expect(rows.find(row => row.source === "email")?.startsAt).toBe(0);
    expect(await t.query(api.events.listUpcoming, {})).toHaveLength(0);
  });
});

describe("source identity", () => {
  it("keeps same-title events at different sources and holds changed facts", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(internal.events.upsertCrawled,event);
    await t.mutation(internal.events.upsertCrawled,{...event,url:"https://www.leandertx.gov/Calendar.aspx?EID=3298",venue:"Other venue"});
    expect(await t.query(api.events.listForReview,{adminKey:"test-only-secret"})).toHaveLength(2);
    await t.mutation(api.events.review,{adminKey:"test-only-secret",id:first.eventId!,startsAt:event.startsAt,endsAt:event.startsAt+3600000,venue:event.venue,url:event.url,sourceChecked:true});
    await t.mutation(internal.events.upsertCrawled,{...event,startsAt:event.startsAt+86400000});
    const changed = await t.run(ctx=>ctx.db.get(first.eventId!));
    expect(changed).toMatchObject({status:"pending",startsAt:event.startsAt+86400000});
    expect(changed?.checkedAt).toBeUndefined();
    expect(await t.query(api.events.listUpcoming,{})).toHaveLength(0);
  });
  it("rejects crawler URLs outside the approved source hosts",async()=>{
    const t=convexTest(schema,modules);
    await expect(t.mutation(internal.events.upsertCrawled,{...event,url:"https://example.com/event"})).rejects.toThrow("Unapproved");
  });
});

describe("business inquiry", () => {
  it("saves explicit consent once when a request is retried", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.leads.submitBusinessLead, lead); await t.mutation(api.leads.submitBusinessLead, lead);
    const rows = await t.run(ctx => ctx.db.query("businessLeads").collect());
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ consentToContact: true, consentAt: now, notificationStatus: "pending", source: "leander-live-form" });
  });
  it.each([
    {consentToContact:false}, {email:"bad"}, {email:"",phone:""}, {companyWebsite:"spam"},
    {problem:"short"}, {requestId:"bad"}, {phone:"123"}, {interests:["Buy leads"]},
  ])("rejects invalid requests without saving: %j", async invalid => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.leads.submitBusinessLead, {...lead,...invalid})).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("businessLeads").collect())).toHaveLength(0);
  });
  it("does not reuse a token for another person's request", async () => {
    const t = convexTest(schema, modules); await t.mutation(api.leads.submitBusinessLead, lead);
    await expect(t.mutation(api.leads.submitBusinessLead,{...lead,email:"different@example.test"})).rejects.toThrow();
  });
  it("holds subscriptions and paid chat by default", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.leads.subscribe,{name:"Test",email:"test@example.test",interests:[],smsOptIn:false})).rejects.toThrow("not open");
    expect(await t.action(api.chat.chatReply,{messages:[],sessionId:"test"})).toMatchObject({unavailable:true});
  });
  it("blocks resale even with a valid admin key", async () => {
    const t = convexTest(schema, modules); await t.mutation(api.leads.submitBusinessLead, lead);
    const record = await t.run(ctx => ctx.db.query("businessLeads").first());
    await expect(t.mutation(api.crm.markSold,{adminKey:"test-only-secret",leadId:record!._id,price:100})).rejects.toThrow("disabled");
    await expect(t.mutation(api.crm.moveLeadStage,{adminKey:"test-only-secret",leadId:record!._id,status:"sold"})).rejects.toThrow("Unknown status");
  });
});

describe("automation cost guard", () => {
  it("requires both an enabled switch and positive bounded limit", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.automation.reserve,{scope:"crawl"})).toBe(false);
    vi.stubEnv("AUTOMATION_ENABLED","true");
    expect(await t.mutation(internal.automation.reserve,{scope:"crawl"})).toBe(false);
    vi.stubEnv("AUTOMATION_DAILY_CALL_LIMIT","2");
    expect(await t.mutation(internal.automation.reserve,{scope:"crawl"})).toBe(true);
    expect(await t.mutation(internal.automation.reserve,{scope:"summary"})).toBe(true);
    expect(await t.mutation(internal.automation.reserve,{scope:"chat"})).toBe(false);
    vi.setSystemTime(now + 86400000);
    expect(await t.mutation(internal.automation.reserve,{scope:"chat"})).toBe(true);
    vi.stubEnv("AUTOMATION_ENABLED","false");
    expect(await t.mutation(internal.automation.reserve,{scope:"chat"})).toBe(false);
  });
  it.each(["NaN","Infinity","-1","1.5"])("rejects unsafe limit %s", async limit => {
    vi.stubEnv("AUTOMATION_ENABLED","true"); vi.stubEnv("AUTOMATION_DAILY_CALL_LIMIT",limit);
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.automation.reserve,{scope:"crawl"})).toBe(false);
  });
});


describe("read-only chat", () => {
  it("sends no capture instructions and ignores model-emitted contact blocks", async () => {
    vi.stubEnv("OPENAI_API_KEY","test-only-placeholder");
    vi.stubEnv("AUTOMATION_ENABLED","true");
    vi.stubEnv("CHAT_ENABLED","true");
    vi.stubEnv("AUTOMATION_DAILY_CALL_LIMIT","2");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({choices:[{message:{content:'Check the source. <!--LEAD {"type":"subscriber","name":"Example","email":"test@example.test","smsOptIn":true}-->'}}]}), {status:200,headers:{"Content-Type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);
    const t = convexTest(schema, modules);
    const result = await t.action(api.chat.chatReply,{messages:[{role:"user",content:"Tell me about local events."}],sessionId:"chat-regression"});
    const request = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    const prompt = request.messages[0].content;
    expect(prompt).toContain("Do not ask for or capture contact information");
    expect(prompt).not.toContain("COMPLETE lead");
    expect(prompt).not.toContain('"type":"subscriber"');
    expect(prompt).not.toContain('"type":"business"');
    expect(result).toMatchObject({reply:"Check the source.",leadSaved:false});
    expect(await t.run(ctx => ctx.db.query("subscribers").collect())).toHaveLength(0);
    expect(await t.run(ctx => ctx.db.query("businessLeads").collect())).toHaveLength(0);
  });
});
