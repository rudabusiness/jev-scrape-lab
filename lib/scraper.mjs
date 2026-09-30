import { chromium } from "playwright";

const normalizeHost = (host) => host.trim().toLowerCase();

function assertAllowedUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) URLs are allowed.");
  const allowed = (process.env.SCRAPE_ALLOWLIST || "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);
  if (!allowed.length) throw new Error("Set SCRAPE_ALLOWLIST before live scraping.");
  const host = normalizeHost(url.hostname);
  const approved = allowed.some((item) => host === item || host.endsWith(`.${item}`));
  if (!approved) throw new Error(`Host ${host} is not in SCRAPE_ALLOWLIST.`);
  return url.toString();
}

function proxyConfig() {
  if (!process.env.PROXY_SERVER) return undefined;
  return {
    server: process.env.PROXY_SERVER,
    username: process.env.PROXY_USERNAME || undefined,
    password: process.env.PROXY_PASSWORD || undefined
  };
}

export async function scrapeReviews(config) {
  const targetUrl = assertAllowedUrl(config.url);
  const reviewSelector = String(config.reviewSelector || "").trim();
  const textSelector = String(config.textSelector || "").trim();
  const loadMoreSelector = String(config.loadMoreSelector || "").trim();
  const maxItems = Math.min(Math.max(Number(config.maxItems) || 100, 1), 500);
  const maxClicks = Math.min(Math.max(Number(config.maxClicks) || 20, 0), 100);
  if (!reviewSelector || !textSelector) throw new Error("Review and text selectors are required.");

  const browser = await chromium.launch({ headless: true, proxy: proxyConfig() });
  const context = await browser.newContext({ locale: config.locale || "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (["image", "media", "font"].includes(type)) return route.abort();
    return route.continue();
  });

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const reviews = page.locator(reviewSelector);
    await reviews.first().waitFor({ state: "attached" });

    for (let click = 0; click < maxClicks && loadMoreSelector; click += 1) {
      const count = await reviews.count();
      if (count >= maxItems) break;
      const more = page.locator(loadMoreSelector).first();
      if (!(await more.isVisible().catch(() => false))) break;
      await more.click();
      await page.waitForFunction(
        ({ selector, before }) => document.querySelectorAll(selector).length > before,
        { selector: reviewSelector, before: count },
        { timeout: 8_000 }
      ).catch(() => null);
    }

    const raw = await reviews.evaluateAll((nodes, childSelector) =>
      nodes.map((node) => {
        const target = childSelector ? node.querySelector(childSelector) : node;
        return target?.textContent?.replace(/\s+/g, " ").trim() || "";
      }),
      textSelector
    );
    return [...new Set(raw.filter(Boolean))].slice(0, maxItems).map((text, index) => ({ id: index + 1, text }));
  } finally {
    await context.close();
    await browser.close();
  }
}
