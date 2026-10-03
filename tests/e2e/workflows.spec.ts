import { test, expect } from "@playwright/test";

test("search, private project, observation and report", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Explore Earth. Follow the evidence." }),
  ).toBeVisible();
  await page.getByLabel("Search any location").fill("6.9, 6.1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "6.90000, 6.10000" }).click();
  await expect(
    page.getByRole("heading", { name: "Explore the Earth", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await page
    .getByLabel("Email address")
    .fill(`e2e-${info.project.name}-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Only-a-local-test-passphrase-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save location", exact: true })
    .click();
  await page.getByLabel("Project name").fill("E2E field notebook");
  await page.getByRole("button", { name: "Create private project" }).click();
  await page
    .getByRole("button", { name: /Private E2E field notebook/ })
    .click();
  await page.getByRole("button", { name: "Observation", exact: true }).click();
  await page.getByLabel("Observation title").fill("Outcrop test record");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic test observation. Not geological evidence.");
  await page.getByRole("button", { name: "Save field record" }).click();
  await expect(
    page.getByRole("heading", { name: "Outcrop test record" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate summary report" }).click();
  await expect(
    page.getByRole("heading", { name: "Geological context", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Insufficient evidence to generate mineral candidates."),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveText(/Gold probability/);
  await page.screenshot({
    path: `test-results/${info.project.name}-report.png`,
    fullPage: true,
  });
});

test("map tools, scanner fallback and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await expect(
    page.getByText("Map overlays are not connected.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Street", { exact: true }).check();
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page.getByRole("button", { name: "Professional", exact: true }).click();
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(
    page.getByText("Photo identification is not connected yet.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Visible texture").selectOption("Coarse grains");
  await expect(
    page.getByText("These traits alone cannot confirm a mineral."),
  ).toBeVisible();
});
