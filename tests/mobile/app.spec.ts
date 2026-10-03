import { test, expect } from "@playwright/test";
test("native screen preview navigation and safe scanner state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("Unexpected text node"))
      errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(
    page.getByRole("button", { name: "Map Explorer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mineral Guide", exact: true })
    .click();
  await expect(page.getByLabel("Search minerals")).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  await expect(page.getByText("Scan", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enable Camera" }),
  ).toBeVisible();
  await expect(page.getByLabel("Take photo", { exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Projects", exact: true }).click();
  await expect(page.getByText("Your projects")).toBeVisible();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await expect(
    page.getByLabel("Professional detail", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign In / Create Account" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("coordinate search reaches live analysis and report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByLabel("Search any location", { exact: true }).fill("0, -140");
  await page.getByRole("button", { name: "Search places" }).click();
  await page
    .getByRole("button", {
      name: /0.00000, -140.00000|0.0000.*140.0000|0, -140/,
    })
    .click();
  await page.getByRole("button", { name: "Analyze Location" }).click();
  await expect(
    page.getByText("Location Analysis", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Report" }),
  ).toBeVisible({ timeout: 120000 });
  await page.getByRole("button", { name: "View Report" }).click();
  await expect(page.getByRole("button", { name: "Export PDF" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "GeoMineral-Exploration-Report.pdf",
  );
  await download.saveAs("test-results/GeoMineral-Exploration-Report.pdf");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(
    "test-results/GeoMineral-Exploration-Report.pdf",
  );
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(3000);
});

test("native account saves a private project", async ({ page }) => {
  if (process.env.LIVE_LOCAL_SCAN === "1") test.setTimeout(300000);
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign In / Create Account" }).click();
  await page.getByRole("button", { name: "New here? Create Account" }).click();
  const email = `native-ui-${Date.now()}@example.test`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-native-test-only-passphrase");
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Projects", exact: true }).click();
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Synthetic mobile QA project");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  await page.getByText("Synthetic mobile QA project", { exact: true }).click();
  await expect(page.getByText("No samples yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Mineral Guide", exact: true })
    .click();
  await page.getByLabel("Search minerals", { exact: true }).fill("SiO2");
  await page.getByRole("button", { name: "Open Quartz profile" }).click();
  await expect(
    page.getByText("Mohs hardness: 7", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Sample" }).click();
  await page.getByLabel("Mineral sample title").fill("QA quartz specimen");
  await page
    .getByRole("button", { name: "Lab-confirmed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save to Synthetic mobile QA project" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Suspected", exact: true }).click();
  await page
    .getByRole("button", { name: "Save to Synthetic mobile QA project" })
    .click();
  await expect(
    page.getByText("Saved.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Projects", exact: true }).click();
  await page.getByText("Synthetic mobile QA project", { exact: true }).click();
  await expect(
    page.getByText("QA quartz specimen", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Suspected; not confirmed/)).toBeVisible();
  await page.getByRole("button", { name: "About Quartz" }).click();
  await expect(
    page.getByText("Recognition clues", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Scan", exact: true }).click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose photos" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(process.env.LIVE_SCAN_IMAGE || {
    name: "synthetic-sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Review photos" }).click();
  if (process.env.LIVE_LOCAL_SCAN === "1") {
    await expect(page.getByText("Local AI · No API fees")).toBeVisible();
    await page.getByRole("button", { name: "Identify", exact: true }).click();
    await expect(page.getByText("Suggested · Unconfirmed")).toBeVisible({
      timeout: 240000,
    });
    if (process.env.LIVE_SCAN_EXPECTED) {
      await expect(page.getByText(process.env.LIVE_SCAN_EXPECTED, { exact: true })).toBeVisible();
    }
    await page.screenshot({
      path: "test-results/local-scan.png",
      fullPage: true,
    });
  }
  await page
    .getByLabel("Sample title", { exact: true })
    .fill("QA photo sample");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Synthetic mobile QA project", exact: true })
    .click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Projects", exact: true }).click();
  await page.getByText("Synthetic mobile QA project", { exact: true }).click();
  await expect(
    page.getByText("QA photo sample", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Sample photo 1")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Projects", exact: true }).click();
  await page.getByText("Synthetic mobile QA project", { exact: true }).click();
  await expect(page.getByLabel("Sample photo 1")).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("tab", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page.getByText("Guest", { exact: true })).toBeVisible();
});

test("mining district shows rating, sites on the map and a full report", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("tab", { name: "Explore", exact: true }).click();
  await page
    .getByLabel("Search any location", { exact: true })
    .fill("-30.7489, 121.4658");
  await page.getByRole("button", { name: "Search places" }).click();
  await page.getByRole("button", { name: "-30.74890, 121.46580" }).click();
  await page.getByRole("button", { name: "Street", exact: true }).click();
  await page.getByRole("button", { name: "Satellite", exact: true }).click();
  await page.getByRole("button", { name: "50 km radius" }).click();
  await page.getByRole("button", { name: "25 km radius" }).click();
  await page.getByRole("button", { name: "Analyze Location" }).click();
  await expect(page.getByRole("button", { name: "View Report" })).toBeVisible({
    timeout: 120000,
  });
  await expect(page.getByText("High", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Gold", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/analysis.png", fullPage: true });
  await page.getByRole("tab", { name: "Sites", exact: true }).click();
  await expect(page.getByText(/Producer · .*Gold/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Geology", exact: true }).click();
  await expect(page.getByText(/greenstone/).first()).toBeVisible();
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByText(/sites · 25 km/)).toBeVisible();
  await page.screenshot({ path: "test-results/explore.png" });
  await page.getByText(/sites · 25 km/).click();
  await page.getByRole("button", { name: "View Report" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/Kalgoorlie-Report.pdf");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile("test-results/Kalgoorlie-Report.pdf");
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(8000);
  expect(errors).toEqual([]);
});
