import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scrapeReviews } from "./lib/scraper.mjs";
import { classifyReviews } from "./lib/classify.mjs";

const app = express();
const here = dirname(fileURLToPath(import.meta.url));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(here, "public")));

app.post("/api/scrape", async (req, res) => {
  try {
    const reviews = await scrapeReviews(req.body || {});
    res.json({ reviews, count: reviews.length });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Scrape failed." });
  }
});

app.post("/api/classify", async (req, res) => {
  try {
    const reviews = Array.isArray(req.body?.reviews) ? req.body.reviews.slice(0, 200) : [];
    if (!reviews.length) return res.status(422).json({ error: "Provide at least one review." });
    const cleaned = reviews.map((item, index) => ({ id: item.id ?? index + 1, text: String(item.text || "").slice(0, 5_000) }));
    const results = await classifyReviews(cleaned, req.body.options);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Classification failed." });
  }
});

app.get("/{*splat}", (_req, res) => res.sendFile(join(here, "public", "jev-scrape-lab.html")));
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Jev Scrape Lab running at http://localhost:${port}`));
