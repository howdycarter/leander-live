import { test, expect } from "@playwright/test";
test("mobile guide stays readable and has a truthful booking handoff", async ({page}) => {
  await page.setViewportSize({width:360,height:800});
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toContainText("useful starting point");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("link",{name:"Book a free growth mapping"})).toHaveAttribute("href","https://howdycarter.com/book?source=leander-live");
  await expect(page.getByText("Opening the booking page does not confirm an appointment.",{exact:false})).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
});
test("event detail has source, Central time, and Back works",async({page})=>{
  await page.goto("/");
  await page.goto("/events/residential-fall-cleanup-2026-10-17/");
  await expect(page).toHaveURL(/\/events\/residential-fall-cleanup-2026-10-17\//);
  await expect(page.getByRole("heading",{level:1})).toHaveText("Residential Fall Cleanup");
  await expect(page.getByText(/8:00 AM CDT/)).toBeVisible();
  await expect(page.getByRole("link",{name:"Check original event details"})).toHaveAttribute("href",/EID=3158/);
  await page.goBack();await expect(page.getByRole("heading",{level:1})).toContainText("useful starting point");
});
test("guide and source link remain usable without JavaScript",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
  await page.goto("http://127.0.0.1:4183/");
  await expect(page.getByRole("heading",{level:1})).toContainText("useful starting point");
  await expect(page.getByRole("link",{name:"City calendar: library, parks, and community events"})).toBeVisible();
  await context.close();
});
