const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "parkwise-browser-"),
  );
  process.env.LOCAL_DATABASE_PATH = path.join(directory, "database");
  const http = require("node:http"),
    { default: handler } = await import("../server/app.js"),
    { database } = await import("../server/database.js");
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { spawn } = require("node:child_process");
  const vite = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5175",
      "--strictPort",
    ],
    {
      env: {
        ...process.env,
        API_PROXY_TARGET: "http://127.0.0.1:" + server.address().port,
      },
      stdio: "ignore",
    },
  );
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch("http://localhost:5175")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) {
    vite.kill();
    throw Error("Browser test server did not start.");
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const owner = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    driver = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
  const errors = [];
  for (const p of [owner, driver])
    p.on("pageerror", (e) => errors.push(e.message));
  try {
    async function register(page, role) {
      await page.goto(
        "http://localhost:5175/#" + (role === "owner" ? "Owner" : "SignIn"),
      );
      const card = page.locator(".pw-auth-card");
      await card
        .getByRole("button", { name: "New here? Create an account" })
        .click();
      await card
        .getByLabel("Full name")
        .fill(role === "owner" ? "Parking Owner" : "Parking Driver");
      await card
        .getByLabel("Email address")
        .fill(role + "-browser@example.test");
      await card
        .getByLabel("Password", { exact: true })
        .fill("Strong-pass-1234");
      await card
        .getByRole("button", { name: "Create " + role + " account" })
        .click();
      await page
        .waitForFunction(() => !document.querySelector(".pw-auth-card"), null, {
          timeout: 5000,
        })
        .catch(async (e) => {
          console.log(await card.innerText());
          throw e;
        });
    }
    await register(owner, "owner");
    await owner
      .getByRole("navigation")
      .getByRole("link", { name: /Facilities/ })
      .click();
    await owner
      .getByRole("button", { name: "Add facility", exact: true })
      .first()
      .click();
    for (const [label, value] of [
      ["Facility name", "Integration Parking"],
      ["Street address", "Pune Test Road, Maharashtra"],
      ["Entrance latitude", "18.52"],
      ["Entrance longitude", "73.85"],
      ["Floor / level", "Ground level"],
      ["Hourly rate (₹)", "40"],
      ["Standard bays", "2"],
      ["Accessible bays", "1"],
      ["EV bays", "1"],
      [
        "Arrival instructions",
        "Enter the east gate. Follow the posted labels to your assigned bay.",
      ],
    ])
      await owner.getByLabel(label, { exact: true }).fill(value);
    await owner
      .getByRole("button", { name: "Create facility", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Publish facility", exact: true })
      .click();
    await owner.getByText("Published", { exact: true }).waitFor();
    await register(driver, "driver");
    const guest = await browser.newPage({ reducedMotion: "reduce" });
    await guest.goto("http://localhost:5175/#Discover");
    await guest.getByRole("button", { name: /Integration Parking/ }).click();
    await guest.getByLabel("Duration", { exact: true }).selectOption("120");
    await guest
      .getByLabel("Vehicle plate", { exact: true })
      .fill("MH12 AB9876");
    await guest
      .getByRole("button", { name: "Sign in to reserve", exact: true })
      .click();
    await guest
      .getByLabel("Email address", { exact: true })
      .fill("driver-browser@example.test");
    await guest
      .getByLabel("Password", { exact: true })
      .fill("Strong-pass-1234");
    await guest
      .locator(".pw-auth-card")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await guest
      .getByRole("button", { name: "Reserve a bay", exact: true })
      .waitFor();
    assert.equal(
      await guest.getByLabel("Duration", { exact: true }).inputValue(),
      "120",
    );
    assert.equal(
      await guest.getByLabel("Vehicle plate", { exact: true }).inputValue(),
      "MH12 AB9876",
    );
    await guest.close();
    await driver
      .getByRole("navigation")
      .getByRole("link", { name: /Find parking/ })
      .click();
    await driver.getByRole("button", { name: /Integration Parking/ }).click();
    await driver.getByLabel("Vehicle plate").fill("MH12 AB9876");
    await driver
      .getByRole("button", { name: "Save parking", exact: true })
      .click();
    await driver
      .getByRole("button", { name: "Saved parking ✓", exact: true })
      .waitFor();
    await driver
      .getByRole("button", { name: "Reserve a bay", exact: true })
      .click();
    await driver.locator(".pw-pass").waitFor();
    const calendarDownload = driver.waitForEvent("download");
    await driver
      .getByRole("button", { name: "Add to calendar", exact: true })
      .click();
    const calendar = await calendarDownload;
    assert.match(calendar.suggestedFilename(), /\.ics$/);
    assert.match(
      await fs.readFile(await calendar.path(), "utf8"),
      /TRIGGER;RELATED=END:-PT15M/,
    );
    await driver.getByLabel("Extra parking time").selectOption("30");
    await driver
      .getByRole("button", { name: "Extend parking", exact: true })
      .click();
    await driver
      .getByRole("button", { name: "Confirm extension", exact: true })
      .click();
    await driver.waitForFunction(() =>
      document.querySelector(".pw-pass-footer")?.textContent.includes("₹80"),
    );
    await driver.goto("http://localhost:5175/#Garage");
    await driver.getByText("Integration Parking", { exact: true }).waitFor();
    await driver
      .getByLabel("Vehicle name", { exact: true })
      .fill("My everyday car");
    await driver
      .getByLabel("Vehicle plate", { exact: true })
      .fill("MH12AB9876");
    await driver
      .getByRole("button", { name: "Save vehicle", exact: true })
      .click();
    await driver.getByText("My everyday car", { exact: true }).waitFor();
    await driver.reload();
    await driver.getByText("My everyday car", { exact: true }).waitFor();
    await driver.screenshot({
      path: "docs/screenshots/driver-garage-launch.png",
      fullPage: true,
    });
    await driver.goto("http://localhost:5175/#Discover");
    await driver.getByRole("button", { name: /Integration Parking/ }).click();
    await driver.getByLabel("Use a saved vehicle").selectOption("MH12AB9876");
    assert.equal(
      await driver.getByLabel("Vehicle plate", { exact: true }).inputValue(),
      "MH12AB9876",
    );
    await driver.getByLabel("Sort parking").selectOption("price");
    await driver.getByLabel("Saved parking only").check();
    await driver.getByRole("button", { name: /Integration Parking/ }).waitFor();
    await driver.goto("http://localhost:5175/#MyParking");
    await driver.locator(".pw-pass").waitFor();

    assert.match(await driver.locator(".pw-assignment").innerText(), /A01/);
    if (
      (await driver.locator(".pw-pass details").getAttribute("open")) === null
    )
      await driver.locator(".pw-pass summary").click();
    const directions = await driver
      .getByRole("link", { name: "Directions to entrance" })
      .getAttribute("href");
    assert.match(directions, /18\.52%2C73\.85/);
    assert.match(await driver.locator(".pw-floorplan").innerText(), /Your bay/);
    await owner
      .getByRole("navigation")
      .getByRole("link", { name: /Arrivals/ })
      .click();
    await owner
      .getByRole("button", { name: "Confirm arrival", exact: true })
      .waitFor();
    assert.match(await owner.locator("tbody").innerText(), /MH12AB9876/);
    await owner
      .getByRole("button", { name: "Confirm arrival", exact: true })
      .click();
    await driver.getByRole("button", { name: "Refresh", exact: true }).click();
    await driver.locator(".pw-status.parked").waitFor();
    await owner
      .getByRole("button", { name: "Record payment", exact: true })
      .click();
    await owner
      .getByRole("button", { name: "Confirm money received", exact: true })
      .click();
    await owner.getByText("₹80 recorded", { exact: true }).waitFor();
    await driver.getByRole("button", { name: "Refresh", exact: true }).click();
    await driver
      .getByRole("button", { name: "Download payment record", exact: true })
      .waitFor();
    const receiptDownload = driver.waitForEvent("download");
    await driver
      .getByRole("button", { name: "Download payment record", exact: true })
      .click();
    const receipt = await receiptDownload;
    assert.match(
      await fs.readFile(await receipt.path(), "utf8"),
      /Recorded received: ₹80/,
    );
    await driver
      .getByRole("link", { name: "Get help with this booking", exact: true })
      .click();
    await driver
      .getByLabel("Message", { exact: true })
      .fill("Where is the pedestrian exit?");
    await driver
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await driver
      .getByText("Where is the pedestrian exit?", { exact: true })
      .waitFor();
    await owner
      .getByRole("link", { name: "Booking help", exact: true })
      .click();
    await owner
      .getByText("Where is the pedestrian exit?", { exact: true })
      .waitFor();
    await owner
      .getByLabel("Message", { exact: true })
      .fill("Use the marked east pedestrian exit.");
    await owner
      .getByRole("button", { name: "Send message", exact: true })
      .click();
    await driver
      .getByText("Use the marked east pedestrian exit.", { exact: true })
      .waitFor();
    await driver
      .getByRole("button", { name: "Mark resolved", exact: true })
      .click();
    await driver
      .getByText("This conversation is resolved.", { exact: true })
      .waitFor();
    await owner
      .getByRole("navigation")
      .getByRole("link", { name: /Reports/ })
      .click();
    await owner
      .getByRole("button", { name: "Export bookings CSV", exact: true })
      .waitFor();
    const csvDownload = owner.waitForEvent("download");
    await owner
      .getByRole("button", { name: "Export bookings CSV", exact: true })
      .click();
    const csv = await csvDownload;
    assert.match(
      await fs.readFile(await csv.path(), "utf8"),
      /"80.00","80.00","0.00"/,
    );
    await owner.screenshot({
      path: "docs/screenshots/owner-reports-launch.png",
      fullPage: true,
    });
    await owner
      .getByRole("navigation")
      .getByRole("link", { name: /Arrivals/ })
      .click();
    await owner.getByRole("button", { name: "Check out", exact: true }).click();
    await driver.getByRole("navigation").getByRole("link", { name: /My parking/ }).click();
    await driver
      .getByRole("button", { name: "All parking", exact: true })
      .click();
    await driver.getByRole("button", { name: "Refresh", exact: true }).click();
    await driver.locator(".pw-status.completed").waitFor();
    await driver.locator(".pw-review-form summary").click();
    await driver
      .getByLabel("Your review", { exact: true })
      .fill("Clear instructions and a well marked parking bay.");
    await driver
      .getByRole("button", { name: "Save review", exact: true })
      .click();
    await driver.getByText("Edit your review", { exact: true }).waitFor();
    await driver
      .getByRole("link", { name: "Account settings", exact: true })
      .click();
    await driver
      .getByLabel("Full name", { exact: true })
      .fill("Parking Driver Updated");
    await driver
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await driver.getByText("Account name updated.", { exact: true }).waitFor();
    await driver
      .getByRole("navigation")
      .getByRole("link", { name: /My parking/ })
      .click();
    await driver
      .getByRole("button", { name: "All parking", exact: true })
      .click();
    await driver.locator(".pw-pass").waitFor();

    await owner
      .getByRole("navigation")
      .getByRole("link", { name: /Facilities/ })
      .click();
    await owner
      .getByRole("button", { name: "Edit details", exact: true })
      .click();
    await owner
      .getByLabel("Arrival instructions", { exact: true })
      .fill(
        "Use the east entrance. Ask the attendant to guide you to the posted bay label.",
      );
    await owner
      .getByRole("button", { name: "Save facility details", exact: true })
      .click();
    await owner
      .getByText(
        "Facility details updated. Existing booked amounts stay the same.",
      )
      .waitFor();
    await driver.getByRole("button", { name: "Refresh", exact: true }).click();
    if (
      (await driver.locator(".pw-pass details").getAttribute("open")) === null
    )
      await driver.locator(".pw-pass summary").click();
    await driver
      .getByText(
        "Use the east entrance. Ask the attendant to guide you to the posted bay label.",
        { exact: true },
      )
      .waitFor();
    for (const width of [390, 768, 1440]) {
      for (const [page, routes] of [
        [driver, ["Discover", "MyParking", "Garage", "Help", "Account"]],
        [
          owner,
          [
            "Owner",
            "Facilities",
            "OwnerActivity",
            "Reports",
            "OwnerHelp",
            "Account",
          ],
        ],
      ]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of routes) {
          await page.goto("http://localhost:5175/#" + route);
          await page.locator(".pw-heading").waitFor();
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `${route} overflow ${width}`,
          );
        }
      }
    }
    await fs.mkdir("docs/screenshots", { recursive: true });
    await owner.setViewportSize({ width: 1440, height: 1000 });
    await owner.goto("http://localhost:5175/#Facilities");
    await owner.locator(".pw-floorplan").waitFor();
    await owner.screenshot({
      path: "docs/screenshots/owner-facilities-driver-tools.png",
      fullPage: true,
    });
    await driver.setViewportSize({ width: 1440, height: 1000 });
    await driver.goto("http://localhost:5175/#MyParking");
    await driver.getByRole("button", { name: "All parking" }).click();
    await driver.locator(".pw-pass").waitFor();
    if (
      (await driver.locator(".pw-pass details").getAttribute("open")) === null
    )
      await driver.locator(".pw-pass summary").click();
    await driver.locator("iframe").scrollIntoViewIfNeeded();
    await driver
      .frameLocator("iframe")
      .locator("#map")
      .waitFor({ timeout: 15000 });
    await driver.screenshot({
      path: "docs/screenshots/driver-pass-launch.png",
      fullPage: true,
    });
    await driver.goto("http://localhost:5175/#Discover");
    await driver.getByRole("button", { name: /Integration Parking/ }).click();
    await driver
      .getByRole("button", { name: "Reserve a bay", exact: true })
      .waitFor();
    await driver
      .frameLocator("iframe")
      .locator("#map")
      .waitFor({ timeout: 15000 });
    await driver.screenshot({
      path: "docs/screenshots/driver-discovery-launch.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const db = await database();
    const stored = await db.query(
      "SELECT count(*)::int AS count FROM bookings",
    );
    assert.equal(stored.rows[0].count, 1);
    await db.close();
    const { PGlite } = await import("@electric-sql/pglite");
    const reopened = new PGlite(process.env.LOCAL_DATABASE_PATH);
    assert.equal(
      (await reopened.query("SELECT count(*)::int AS count FROM bookings"))
        .rows[0].count,
      1,
    );
    await reopened.close();
    console.log(
      "PASS separate driver/owner accounts, publication, shared booking, bidirectional status, entrance directions, bay plan, persistent database driver garage, saved parking, extensions, calendar download, guest checkout continuity payment recording, support messages, reports, reviews, account settings and eleven responsive page/role combinations",
    );
  } finally {
    await browser.close();
    vite.kill();
    await new Promise((r) => server.close(r));
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
