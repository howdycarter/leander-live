import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests", testMatch: "ui.spec.ts", use: {baseURL:"http://127.0.0.1:4183", launchOptions:{executablePath:process.env.CHROMIUM_PATH || undefined,args:["--no-sandbox"]}},
  webServer: {command:"npm run preview -- --host 127.0.0.1 --port 4183",url:"http://127.0.0.1:4183",reuseExistingServer:false},
});
