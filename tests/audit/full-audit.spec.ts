import { test, expect, type Page } from "@playwright/test";

// Presses every control on every tab and reports anything broken.
test.use({ actionTimeout: 20000, geolocation: { latitude: -30.7489, longitude: 121.4658 }, permissions: ["geolocation"] });

const problems: string[] = [];
const results: string[] = [];
async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    results.push(`PASS  ${name}`);
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push(`FAIL  ${name}: ${(e as Error).message.split("\n")[0]}`);
    console.log(`FAIL  ${name}: ${(e as Error).message.split("\n")[0]}`);
  }
}
function watch(page: Page) {
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", async (m) => {
    if (m.type() === "error" && !/Failed to load resource|ERR_NETWORK|DevTools/.test(m.text())) {
      const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => "?")));
      problems.push(`console: ${JSON.stringify(args.slice(1, 3))} ${String(args[args.length - 1]).slice(0, 400)}`);
    }
  });
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400 && u.includes("/api/") && !(u.endsWith("/auth/me") && r.status() === 401))
      problems.push(`http ${r.status()} ${r.request().method()} ${u.replace(/^.*\/api/, "/api")}`);
  });
}
const back = (page: Page) => page.getByRole("button", { name: "Go back" }).click();

test("full audit of every tab", async ({ page, context }) => {
  test.setTimeout(1500000);
  watch(page);
  await page.goto("/");
  await check("Welcome: Get Started", async () => {
    await page.getByRole("button", { name: "Get Started" }).click();
    await expect(page.getByRole("tab", { name: "Home", exact: true })).toBeVisible();
  });

  // HOME
  await check("Home: profile button opens Profile", async () => {
    await page.getByRole("button", { name: "Open profile" }).click();
    await expect(page.getByText("Professional detail")).toBeVisible();
    await page.getByRole("tab", { name: "Home", exact: true }).click();
  });
  await check("Home: place search by name", async () => {
    await page.getByLabel("Search any location", { exact: true }).fill("Kalgoorlie");
    await page.getByRole("button", { name: "Search places" }).click();
    await page.getByRole("button", { name: /Kalgoorlie/ }).first().click();
    await expect(page.getByPlaceholder(/Kalgoorlie/)).toBeVisible();
  });
  await check("Home: Analyze Location opens analysis with results", async () => {
    await page.getByRole("button", { name: "Analyze Location" }).click();
    await expect(page.getByRole("button", { name: "View Report" })).toBeVisible({ timeout: 120000 });
    await expect(page.getByText(/^(High|Moderate|Low)$/).first()).toBeVisible();
  });
  await check("Analysis: all five tabs render", async () => {
    for (const t of ["Sites", "Geology", "Time", "Sources", "Minerals"]) {
      await page.getByRole("tab", { name: t, exact: true }).click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("tab", { name: "Time", exact: true }).click();
    await expect(page.getByText("This spot was at")).toBeVisible({ timeout: 60000 });
    await page.getByRole("button", { name: "Play time travel" }).click();
    await expect(page.getByText("66 million years ago")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Pause time travel" }).click();
    await page.getByRole("tab", { name: "Minerals", exact: true }).click();
  });
  await check("Analysis: About mineral opens Guide", async () => {
    await page.getByRole("button", { name: /^About / }).first().click();
    await expect(page.getByText("Recognition clues")).toBeVisible();
    await back(page);
  });
  await check("Analysis: Report and PDF export", async () => {
    await page.getByRole("button", { name: "View Report" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await back(page);
  });
  await check("Analysis: Save signed out asks to sign in", async () => {
    await page.getByRole("button", { name: "Save to My Projects" }).click();
    await expect(page.getByText("Welcome Back")).toBeVisible();
    await page.getByLabel("Close").click();
    await back(page);
  });
  await check("Home: Recent reopens analysis", async () => {
    await page.getByRole("button", { name: /Open analysis of/ }).first().click();
    await expect(page.getByRole("button", { name: "View Report" })).toBeVisible();
    await back(page);
  });
  await check("Home: Mineral of the Day opens its page", async () => {
    await page.getByRole("button", { name: /^Learn about / }).click();
    await expect(page.getByText("Recognition clues")).toBeVisible();
    await back(page);
  });
  await check("Home: Mineral Guide row", async () => {
    await page.getByRole("button", { name: "Mineral Guide", exact: true }).click();
    await expect(page.getByLabel("Search minerals")).toBeVisible();
  });
  await check("Guide: group filters, search, rare species, look-alike", async () => {
    for (const g of ["Sulfides", "Rocks", "All"]) await page.getByRole("button", { name: g, exact: true }).click();
    await page.getByLabel("Search minerals").fill("quartz");
    await page.getByRole("button", { name: "Open Quartz profile" }).click();
    await page.getByRole("button", { name: "Compare with Calcite" }).click();
    await expect(page.getByText("Calcite", { exact: true }).first()).toBeVisible();
    await back(page);
    await expect(page.getByText("Quartz", { exact: true }).first()).toBeVisible();
    await back(page);
    await page.getByLabel("Search minerals").fill("zircon");
    await page.getByRole("button", { name: "Open Zircon profile" }).click();
    await back(page);
    await back(page);
  });
  await check("Home: Identify by Tests row", async () => {
    await page.getByRole("button", { name: "Identify by Tests", exact: true }).click();
    await page.getByRole("button", { name: "Magnet: Pulls" }).click();
    await expect(page.getByRole("button", { name: "Open Magnetite profile" })).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await back(page);
  });
  await check("Home: My Projects row switches tab", async () => {
    await page.getByRole("button", { name: "My Projects", exact: true }).click();
    await expect(page.getByText("Your projects")).toBeVisible();
  });

  // EXPLORE
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await check("Explore: Street / Satellite", async () => {
    await page.getByRole("button", { name: "Street", exact: true }).click();
    await page.getByRole("button", { name: "Satellite", exact: true }).click();
  });
  await check("Explore: locate me (GPS)", async () => {
    await page.getByRole("button", { name: "Use current location" }).click();
    await expect(page.getByText(/30\.7489° S/)).toBeVisible({ timeout: 15000 });
  });
  await check("Explore: tap map picks a point", async () => {
    await page.mouse.click(120, 420);
    await expect(page.getByText(/Selected map location|°/).first()).toBeVisible();
  });
  await check("Explore: draw area and clear", async () => {
    await page.getByRole("button", { name: "Draw area" }).click();
    for (const [x, y] of [[100, 270], [280, 270], [150, 340]]) await page.mouse.click(x, y);
    await expect(page.getByText("Tap corners · 3 placed")).toBeVisible();
    await page.getByText("Clear", { exact: true }).click();
    await page.getByRole("button", { name: "Draw area" }).click();
  });
  await check("Explore: radius chips", async () => {
    for (const r of ["10", "50", "25"]) await page.getByRole("button", { name: `${r} km radius` }).click();
  });
  await check("Explore: analyze then result card opens analysis", async () => {
    await page.getByRole("button", { name: "Use current location" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Analyze Location" }).click();
    await expect(page.getByRole("button", { name: "View Report" })).toBeVisible({ timeout: 120000 });
    await back(page);
    await page.getByText(/sites · 25 km/).click();
    await expect(page.getByRole("button", { name: "View Report" })).toBeVisible();
    await back(page);
  });
  await check("Explore: Save signed out asks to sign in", async () => {
    await page.getByRole("button", { name: "Save location" }).click();
    await expect(page.getByText("Welcome Back")).toBeVisible();
    await page.getByLabel("Close").click();
  });

  // SCAN
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await check("Scan: camera states", async () => {
    await expect(page.getByRole("button", { name: "Enable Camera" })).toBeVisible();
    await expect(page.getByLabel("Take photo", { exact: true })).toBeDisabled();
  });
  await check("Scan: choose photos and review", async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose photos" }).click();
    await (await chooser).setFiles([".data/vision-smoke/pyrite.jpg", ".data/vision-smoke/granite.jpg"]);
    await page.getByRole("button", { name: "Review photos" }).click();
    await expect(page.getByLabel("Main photo")).toBeVisible();
    await page.getByRole("button", { name: "Use photo 2 as main" }).click();
    await page.getByRole("button", { name: "Use photo 2 as main" }).click();
  });
  await check("Scan: Identify (local AI) returns matches", async () => {
    await page.getByRole("button", { name: "Identify", exact: true }).click();
    await expect(page.getByText("Suggested · Unconfirmed")).toBeVisible({ timeout: 240000 });
    await expect(page.getByText("Best match")).toBeVisible();
  });
  await check("Scan: Test It and About", async () => {
    await page.getByRole("button", { name: "Test It" }).click();
    await expect(page.getByText(/Scan suggested/)).toBeVisible();
    await back(page);
    await page.getByRole("button", { name: /^About / }).click();
    await expect(page.getByText(/Recognition clues|crystal system/).first()).toBeVisible();
    await back(page);
  });
  await check("Scan: mineral search, voice note, GPS", async () => {
    await page.getByLabel("Search suspected mineral").fill("gal");
    await page.getByRole("button", { name: "Select Galena" }).click();
    await page.getByRole("button", { name: "Record voice note" }).click();
    await expect(page.getByText(/Microphone|Recording|Could not/)).toBeVisible({ timeout: 8000 });
    if (await page.getByRole("button", { name: "Stop recording" }).isVisible())
      await page.getByRole("button", { name: "Stop recording" }).click();
    await page.getByText("Use GPS", { exact: true }).click();
    await expect(page.getByText(/GPS ±/)).toBeVisible({ timeout: 15000 });
  });
  await check("Scan: Save signed out asks to sign in", async () => {
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Welcome Back")).toBeVisible();
  });

  // ACCOUNT, PROJECTS
  const email = `audit-${Date.now()}@example.test`;
  await check("Account: create from sign-in sheet", async () => {
    await page.getByRole("button", { name: "New here? Create Account" }).click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("synthetic-native-test-only-passphrase");
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await expect(page.getByText("Welcome Back")).toHaveCount(0);
  });
  await check("Projects: create project", async () => {
    await page.getByRole("tab", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: "Create Project", exact: true }).click();
    await page.getByLabel("Project name", { exact: true }).fill("Audit field");
    await page.getByRole("button", { name: "Save Project", exact: true }).click();
    await expect(page.getByRole("button", { name: "Audit field" })).toBeVisible();
  });
  await check("Scan: save sample with photos, GPS to project", async () => {
    await page.getByRole("tab", { name: "Scan", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Audit field", exact: true }).click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await back(page);
  });
  await check("Projects: open project, sample, About, rename", async () => {
    await page.getByRole("tab", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: "Audit field" }).click();
    await expect(page.getByLabel("Sample photo 1")).toBeVisible();
    await page.getByRole("button", { name: "About Galena" }).click();
    await back(page);
    await page.getByRole("button", { name: "Rename project" }).click();
    await page.getByLabel("Project name", { exact: true }).fill("Audit field 2");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Audit field 2", { exact: true }).first()).toBeVisible();
  });
  await check("Projects: Analyze from project", async () => {
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(page.getByRole("button", { name: "View Report" })).toBeVisible({ timeout: 120000 });
    await back(page);
  });
  await check("Projects: Add Sample jumps to Scan", async () => {
    await page.getByRole("button", { name: "Add Sample" }).click();
    await expect(page.getByRole("tab", { name: "Scan", exact: true, selected: true })).toBeVisible();
  });
  await check("Projects: Rockdex shows the find and a badge", async () => {
    await page.getByRole("tab", { name: "Projects", exact: true }).click();
    await page.getByRole("button", { name: "Rockdex", exact: true }).click();
    await expect(page.getByRole("button", { name: "Galena, collected" })).toBeVisible();
    await expect(page.getByLabel("First Find", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Galena, collected" }).click();
    await back(page);
    await page.getByRole("button", { name: "Projects", exact: true }).click();
  });
  await check("Projects: delete sample and project", async () => {
    await page.getByRole("button", { name: "Audit field 2" }).click();
    await page.getByRole("button", { name: /^Delete Field rock sample/ }).click();
    await page.getByRole("button", { name: /^Delete Field rock sample/ }).click();
    await expect(page.getByText("No samples yet")).toBeVisible();
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByText("No projects yet")).toBeVisible();
  });

  // PROFILE
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await check("Profile: shows account email", async () => {
    await expect(page.getByText(email)).toBeVisible();
  });
  await check("Profile: Professional detail toggle", async () => {
    await page.getByLabel("Professional detail", { exact: true }).click();
    await page.getByLabel("Professional detail", { exact: true }).click();
  });
  await check("Profile: data source links open", async () => {
    for (const name of ["Macrostrat", "USGS Mineral Resources", "OpenStreetMap"]) {
      const popup = context.waitForEvent("page", { timeout: 8000 });
      await page.getByRole("button", { name, exact: true }).click();
      const p = await popup;
      results.push(`      ${name} -> ${p.url()}`);
      await p.close();
    }
  });
  await check("Profile: Sign Out", async () => {
    await page.getByRole("button", { name: "Sign Out", exact: true }).click();
    await expect(page.getByText("Guest", { exact: true })).toBeVisible();
  });

  console.log("\n===== AUDIT =====\n" + results.join("\n"));
  console.log("\n===== PROBLEMS =====\n" + ([...new Set(problems)].join("\n") || "none"));
});
