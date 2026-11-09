import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdirSync } from "node:fs";

test("first admin, provider execution, saved work, member privacy, mobile and login", async ({
  page,
  browser,
}) => {
  const requests: Array<{
    url: string;
    headers: Record<string, unknown>;
    body: Record<string, any>;
  }> = [];
  let providerFailure = false;
  const provider = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/v1/models") {
      response.end(JSON.stringify({ models: [{ name: "jev-test" }] }));
      return;
    }
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = JSON.parse(text);
    requests.push({ url: request.url || "", headers: request.headers, body });
    if (providerFailure) {
      response.writeHead(429);
      response.end(JSON.stringify({ error: "rate limited" }));
      return;
    }
    const answers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(body.questions) as Array<
      [string, any]
    >) {
      if (q.type === "choice") {
        const options = Object.keys(q.criteria);
        answers[id] = {
          type: q.type,
          choice: options[0],
          probabilities: Object.fromEntries(
            options.map((key, index) => [
              key,
              index === 0 ? 0.92 : 0.08 / (options.length - 1),
            ]),
          ),
          confidence: 0.8,
        };
      } else if (q.type === "score") {
        const n = q.criteria.length;
        answers[id] = {
          type: q.type,
          score: n - 1.4,
          probabilities: Object.fromEntries(
            q.criteria.map((_: string, i: number) => [
              i,
              i === n - 2 ? 0.4 : i === n - 1 ? 0.6 : 0,
            ]),
          ),
          legend: Object.fromEntries(
            q.criteria.map((value: string, i: number) => [i, value]),
          ),
          confidence: 0.5,
        };
      } else if (q.type === "noul") answers[id] = { type: q.type, noul: 0.98 };
      else
        answers[id] = {
          type: q.type,
          box: { left: 0.12, top: 0.49, right: 0.48, bottom: 0.88 },
          confidence: 0.9,
        };
    }
    const result = {
      model: request.url?.includes("/accounts/")
        ? "@cf/cloudflare/clef"
        : "jev-test",
      answers,
    };
    response.end(
      JSON.stringify(
        request.url?.includes("/accounts/")
          ? { success: true, result }
          : result,
      ),
    );
  });
  await new Promise<void>((resolve) =>
    provider.listen(0, "127.0.0.1", resolve),
  );
  const baseUrl = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|server rendered HTML/i.test(message.text()))
      errors.push(message.text());
  });
  let savedRunUrl = "";
  page.on("request", (request) => {
    if (request.url().includes("_serverFn/") && request.method() === "GET")
      savedRunUrl = request.url();
  });
  const stateFormat = page.getByRole("radiogroup", { name: "State format" });
  async function expectContainedStateControl(minimumTargetHeight = 0) {
    await expect(stateFormat).toBeVisible();
    const geometry = await stateFormat.evaluate((group) => {
      const bounds = group.getBoundingClientRect();
      return Array.from(group.querySelectorAll('[role="radio"]')).map(
        (control) => {
          const rect = control.getBoundingClientRect();
          return {
            contained:
              rect.left >= bounds.left - 1 &&
              rect.right <= bounds.right + 1 &&
              rect.top >= bounds.top - 1 &&
              rect.bottom <= bounds.bottom + 1,
            height: rect.height,
          };
        },
      );
    });
    expect(geometry).toHaveLength(2);
    for (const control of geometry) {
      expect(control.contained).toBe(true);
      expect(control.height).toBeGreaterThanOrEqual(minimumTargetHeight);
    }
  }
  try {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Create administrator", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Test Administrator");
    await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("local-test-password-123");
    await page
      .getByRole("button", { name: "Create administrator", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "New playground", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Connections", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add connection", exact: true })
      .first()
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Local test provider");
    await page.getByLabel("Base URL", { exact: true }).fill(baseUrl);
    await page
      .getByLabel("API key", { exact: true })
      .fill("test-secret-never-returned");
    await page
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Local test provider" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Load example inputs" }).click();
    await expect(page.getByLabel("Playground title")).toHaveValue(
      "Product listing review",
    );
    const textFormat = stateFormat.getByRole("radio", {
      name: "Text",
      exact: true,
    });
    const jsonFormat = stateFormat.getByRole("radio", {
      name: "JSON",
      exact: true,
    });
    await expect(jsonFormat).toBeChecked();
    // The selected format cannot be toggled off, and both formats work by keyboard.
    await jsonFormat.click();
    await expect(jsonFormat).toBeChecked();
    await jsonFormat.press("ArrowLeft");
    await expect(textFormat).toBeFocused();
    await textFormat.press("Space");
    await expect(textFormat).toBeChecked();
    await expect(jsonFormat).not.toBeChecked();
    await textFormat.press("ArrowRight");
    await expect(jsonFormat).toBeFocused();
    await jsonFormat.press("Space");
    await expect(jsonFormat).toBeChecked();
    await expect(textFormat).not.toBeChecked();
    await expectContainedStateControl();
    await page
      .getByRole("button", { name: "Discover models", exact: true })
      .click();
    await expect(
      page.getByText("Found 1 model", { exact: true }),
    ).toBeVisible();
    const modelPicker = page.getByRole("combobox", {
      name: "Model name",
      exact: true,
    });
    await modelPicker.click();
    mkdirSync(".verification", { recursive: true });
    await page.screenshot({
      path: ".verification/workspace-model-menu.png",
      animations: "disabled",
    });
    await page.getByRole("option", { name: "jev-test", exact: true }).click();
    await expect(modelPicker).toHaveText("jev-test");
    await modelPicker.click();
    await page
      .getByRole("option", { name: "Enter a model name…", exact: true })
      .click();
    const modelDialog = page.getByRole("dialog", {
      name: "Enter a model name",
      exact: true,
    });
    await modelDialog
      .getByLabel("Model name", { exact: true })
      .fill("jev-custom-test");
    await modelDialog
      .getByRole("button", { name: "Use model", exact: true })
      .click();
    await expect(modelDialog).toHaveCount(0);
    await expect(modelPicker).toHaveText("jev-custom-test");
    await modelPicker.click();
    await page.getByRole("option", { name: "jev-test", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Saved playground", { exact: true }),
    ).toBeVisible();
    // Saving gives the playground its own address.
    await expect(page).toHaveURL(/\/playgrounds\/[\w-]+$/);
    const playgroundUrl = page.url();
    await page
      .getByRole("button", { name: "Run questions", exact: true })
      .click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.locator(".answer-block")).toHaveCount(4);
    await expect(page.locator(".result-box")).toBeVisible();
    await expect(page).toHaveURL(playgroundUrl);
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.authorization).toBe(
      "Bearer test-secret-never-returned",
    );
    expect(requests[0].headers["typesafe-danger-zone-images"]).toBe("true");
    expect(Object.keys(requests[0].body.assets)).toHaveLength(1);
    await page.getByRole("tab", { name: "Raw JSON" }).click();
    await expect(page.locator(".json-response")).toContainText("jev-test");
    await expect(page.locator(".json-response")).not.toContainText(
      "test-secret-never-returned",
    );
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page.screenshot({
      path: ".verification/workspace-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.screenshot({
      path: ".verification/workspace-desktop-viewport.png",
      animations: "disabled",
    });
    const application = page.locator(".application");
    const desktopSidebar = page.locator("#workspace-sidebar");
    const expandedSidebarWidth = await desktopSidebar.evaluate(
      (sidebar) => sidebar.getBoundingClientRect().width,
    );
    const darkBackground = await page
      .locator("body")
      .evaluate((body) => getComputedStyle(body).backgroundColor);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    const collapseSidebar = page.getByRole("button", {
      name: "Collapse sidebar",
      exact: true,
    });
    await collapseSidebar.focus();
    await collapseSidebar.press("Enter");
    await expect(application).toHaveAttribute("data-sidebar-collapsed", "true");
    await expect
      .poll(() =>
        desktopSidebar.evaluate(
          (sidebar) => sidebar.getBoundingClientRect().width,
        ),
      )
      .toBeLessThan(expandedSidebarWidth / 2);
    await page.screenshot({
      path: ".verification/workspace-dark-collapsed.png",
      animations: "disabled",
    });
    // Icon-only controls retain their accessible names and active-page state.
    const connectionsNav = desktopSidebar.getByRole("link", {
      name: "Connections",
      exact: true,
    });
    await connectionsNav.focus();
    await connectionsNav.press("Enter");
    await expect(connectionsNav).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "Connections", exact: true }),
    ).toBeVisible();
    const playgroundNav = desktopSidebar.getByRole("link", {
      name: "Playground",
      exact: true,
    });
    await playgroundNav.click();
    await expect(playgroundNav).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".answer-block")).toHaveCount(4);
    await page
      .getByRole("button", { name: "Switch to light theme", exact: true })
      .click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect
      .poll(() =>
        page
          .locator("body")
          .evaluate((body) => getComputedStyle(body).backgroundColor),
      )
      .not.toBe(darkBackground);
    await expect(page.locator("[data-sonner-toaster]")).toHaveAttribute(
      "data-sonner-theme",
      "light",
    );
    await page.screenshot({
      path: ".verification/workspace-light-collapsed.png",
      animations: "disabled",
    });
    const expandSidebar = page.getByRole("button", {
      name: "Expand sidebar",
      exact: true,
    });
    await expandSidebar.focus();
    await expandSidebar.press("Enter");
    await expect(application).toHaveAttribute(
      "data-sidebar-collapsed",
      "false",
    );
    await expect
      .poll(() =>
        desktopSidebar.evaluate(
          (sidebar) => sidebar.getBoundingClientRect().width,
        ),
      )
      .toBeGreaterThan(expandedSidebarWidth - 1);
    await page.screenshot({
      path: ".verification/workspace-light-expanded.png",
      animations: "disabled",
    });
    await connectionsNav.click();
    await page
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Add connection", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".verification/workspace-light-connection-dialog.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await playgroundNav.click();
    await collapseSidebar.click();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expectContainedStateControl();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(1024);
    await page.screenshot({
      path: ".verification/workspace-tablet.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await expectContainedStateControl(44);
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Run history", exact: true }),
    ).toBeVisible();
    const mobileNavigation = page.getByRole("dialog", {
      name: "Workspace navigation",
      exact: true,
    });
    await expect(mobileNavigation).toBeVisible();
    await expect.poll(async () => {
      const box = await mobileNavigation.boundingBox();
      return !!box && Math.abs(box.x) < 1 && Math.abs(box.y) < 1 &&
        box.width >= 250 && box.width <= 375 && box.height >= 811;
    }).toBe(true);
    expect(
      await mobileNavigation
        .getByRole("link", { name: "Run history", exact: true })
        .innerText(),
    ).toContain("Run history");
    await page.screenshot({
      path: ".verification/workspace-light-mobile-drawer.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: ".verification/workspace-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.screenshot({
      path: ".verification/workspace-mobile-viewport.png",
      animations: "disabled",
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(375);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("link", { name: "Run history", exact: true })
      .click();
    await expect(page.locator(".history-row")).toHaveCount(1);
    await page.locator(".history-main").click();
    await expect(page.locator(".answer-block")).toHaveCount(4);
    await expect(page).toHaveURL(/\/runs\/[\w-]+$/);
    const runUrl = page.url();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(application).toHaveAttribute("data-sidebar-collapsed", "true");
    await expect(
      page.getByRole("button", { name: "Expand sidebar", exact: true }),
    ).toBeVisible();
    // A run's address reopens its inputs and results.
    await expect(page).toHaveURL(runUrl);
    await expect(page.getByLabel("Playground title")).toHaveValue(
      "Product listing review",
    );
    await expect(page.locator(".answer-block")).toHaveCount(4);
    await expect(
      page.getByRole("link", { name: "Product listing review", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Product listing review", exact: true })
      .click();
    await expect(page).toHaveURL(playgroundUrl);
    // A saved playground's address survives a reload.
    await page.reload();
    await expect(page.getByLabel("Playground title")).toHaveValue(
      "Product listing review",
    );
    await expect(
      page.getByText("Saved playground", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Product listing review", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(modelPicker).toHaveText("jev-test");
    // Save as new copies the editor into a new playground and leaves the
    // original as it was saved.
    await page
      .getByLabel("Playground title")
      .fill("Product listing variant");
    await page
      .getByRole("button", { name: "Save as new", exact: true })
      .click();
    await expect(
      page.getByText("Saved playground", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/playgrounds\/[\w-]+$/);
    expect(page.url()).not.toBe(playgroundUrl);
    await expect(
      page.getByRole("link", { name: "Product listing variant", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("link", { name: "Product listing review", exact: true })
      .click();
    await expect(page).toHaveURL(playgroundUrl);
    await expect(page.getByLabel("Playground title")).toHaveValue(
      "Product listing review",
    );
    providerFailure = true;
    await page
      .getByRole("button", { name: "Run questions", exact: true })
      .click();
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Provider request failed", { exact: true }),
    ).toBeVisible();
    providerFailure = false;
    await page
      .getByRole("link", { name: "Administration", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin$/);
    // Back returns to the playground as it was, failed run included.
    await page.goBack();
    await expect(page).toHaveURL(playgroundUrl);
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/admin$/);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill("Test Member");
    await dialog
      .getByLabel("Email", { exact: true })
      .fill("member@example.test");
    await dialog
      .getByLabel("Initial password")
      .fill("member-test-password-123");
    await dialog
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Test Member", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Connections", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Shared test provider");
    await page.getByLabel("Base URL", { exact: true }).fill(baseUrl);
    await page.getByLabel("API key", { exact: true }).fill("shared-test-key");
    await page.getByRole("combobox", { name: "Connection access" }).click();
    await page
      .getByRole("option", { name: "Shared — all users on this instance" })
      .click();
    await page
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const memberContext = await browser.newContext();
    const member = await memberContext.newPage();
    member.on("pageerror", (error) => errors.push(error.message));
    await member.goto("http://127.0.0.1:4176/");
    await expect(
      member.getByRole("button", { name: "Create administrator", exact: true }),
    ).toHaveCount(0);
    if (savedRunUrl) {
      const anonymous = await memberContext.request.get(savedRunUrl);
      expect(await anonymous.text()).not.toContain("Product listing review");
    }
    await member
      .getByLabel("Email", { exact: true })
      .fill("member@example.test");
    await member
      .getByLabel("Password", { exact: true })
      .fill("member-test-password-123");
    await member.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      member.getByRole("button", { name: "New playground", exact: true }),
    ).toBeVisible();
    await expect(
      member.getByRole("link", { name: "Administration", exact: true }),
    ).toHaveCount(0);
    await expect(
      member.getByRole("link", {
        name: "Product listing review",
        exact: true,
      }),
    ).toHaveCount(0);
    // Another user's addresses open nothing of theirs.
    await member.goto(playgroundUrl);
    await expect(
      member.getByText("Playground not found.", { exact: true }),
    ).toBeVisible();
    await expect(member).toHaveURL("http://127.0.0.1:4176/");
    await expect(member.getByLabel("Playground title")).toHaveValue(
      "Untitled playground",
    );
    await member.goto(runUrl);
    await expect(
      member.getByText("Run not found.", { exact: true }),
    ).toBeVisible();
    await expect(member).toHaveURL(/\/runs$/);
    await expect(
      member.getByText("No runs yet.", { exact: true }),
    ).toBeVisible();
    await member
      .getByRole("link", { name: "Connections", exact: true })
      .click();
    await expect(
      member.getByRole("heading", {
        name: "Shared test provider",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      member.getByRole("heading", { name: "Local test provider", exact: true }),
    ).toHaveCount(0);
    await expect(
      member.getByRole("button", { name: "Edit Shared test provider" }),
    ).toHaveCount(0);
    expect(await member.content()).not.toContain("shared-test-key");
    await member
      .getByRole("link", { name: "Run history", exact: true })
      .click();
    await expect(
      member.getByText("No runs yet.", { exact: true }),
    ).toBeVisible();
    await member
      .getByRole("link", { name: "Connections", exact: true })
      .click();
    await member
      .getByRole("button", { name: "Add connection", exact: true })
      .click();
    await member.getByLabel("Name", { exact: true }).fill("Local Clef");
    await member
      .getByRole("combobox", { name: "Provider", exact: true })
      .click();
    await member
      .getByRole("option", { name: "Cloudflare Workers AI", exact: true })
      .click();
    await member
      .getByLabel("Base URL", { exact: true })
      .fill(`${baseUrl}/client/v4`);
    await member
      .getByLabel("Cloudflare account ID", { exact: true })
      .fill("test-account");
    // A key matching a JSON literal must not corrupt a successful provider response.
    await member.getByLabel("API key", { exact: true }).fill("true");
    await member
      .getByRole("button", { name: "Save connection", exact: true })
      .click();
    await expect(member.getByRole("dialog")).toHaveCount(0);
    await member
      .getByRole("button", { name: "Load example inputs", exact: true })
      .click();
    await member
      .getByRole("combobox", { name: "Choose a connection", exact: true })
      .click();
    await member
      .getByRole("option", { name: "Local Clef", exact: true })
      .click();
    await expect(
      member.getByRole("button", { name: "Run questions", exact: true }),
    ).toBeDisabled();
    await expect(
      member.getByText("Clef accepts images but does not support Box.", {
        exact: false,
      }),
    ).toBeVisible();
    const boxQuestion = member.locator("details").filter({
      has: member.locator("summary code", { hasText: "product_region" }),
    });
    await expect(boxQuestion).not.toHaveAttribute("open");
    await member
      .getByRole("button", {
        name: "Remove question product_region",
        exact: true,
      })
      .click();
    await expect(boxQuestion).toHaveCount(0);
    await expect(member.locator(".question-item")).toHaveCount(3);
    await expect(
      member.locator("summary").filter({ hasText: "product_present" }),
    ).toBeFocused();
    await member
      .getByRole("button", { name: "Run questions", exact: true })
      .click();
    await expect(member.getByText("Completed", { exact: true })).toBeVisible();
    await expect(member.locator(".answer-block")).toHaveCount(3);
    // An unsaved draft's run takes the run's address, so a reload keeps it.
    await expect(member).toHaveURL(/\/runs\/[\w-]+$/);
    const memberRunUrl = member.url();
    const clefRequest = requests.at(-1)!;
    expect(clefRequest.url).toBe(
      "/client/v4/accounts/test-account/ai/run/@cf/cloudflare/clef",
    );
    expect(clefRequest.headers.authorization).toBe("Bearer true");
    expect(clefRequest.body.images).toHaveLength(1);
    expect(clefRequest.body.assets).toBeUndefined();
    await member
      .getByRole("button", { name: "Switch to light theme", exact: true })
      .click();
    await expect(member.locator("html")).toHaveClass(/\blight\b/);
    await expect(member.locator("[data-sonner-toaster]")).toHaveAttribute(
      "data-sonner-theme",
      "light",
    );
    await member.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      member.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await member.reload();
    await expect(member.locator("html")).toHaveClass(/\blight\b/);
    await expect(
      member.getByRole("button", { name: "Switch to dark theme", exact: true }),
    ).toBeVisible();
    await member.screenshot({
      path: ".verification/sign-in-light.png",
      animations: "disabled",
    });
    await member
      .getByRole("button", { name: "Switch to dark theme", exact: true })
      .click();
    await expect(member.locator("html")).toHaveClass(/\bdark\b/);
    // Signing in from a saved address opens what it names.
    await member.goto(memberRunUrl);
    await member
      .getByLabel("Email", { exact: true })
      .fill("member@example.test");
    await member
      .getByLabel("Password", { exact: true })
      .fill("member-test-password-123");
    await member.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(member).toHaveURL(memberRunUrl);
    await expect(member.locator(".answer-block")).toHaveCount(3);
    await memberContext.close();
    expect(errors).toEqual([]);
  } finally {
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});
