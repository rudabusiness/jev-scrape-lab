# Jev Scrape Lab

A safe, reproducible version of the video workflow:

1. Use Playwright to extract paginated reviews from an allowlisted public site.
2. Send reviews to Jev as independent `Choice` questions.
3. Route confident decisions through a fast path and uncertain decisions to a review queue.
4. Export the result as CSV.

## Run

```bash
cp .env.example .env
npm install
npm run install:browser
set -a && source .env && set +a
npm start
```

Open `http://localhost:3000`. Press **Load demo reviews** to test the interface without scraping. Add a real hostname to `SCRAPE_ALLOWLIST` before live extraction.

## Jev setup

Create a TypeSafe key and set `TYPESAFE_API_KEY`. The server uses the official JavaScript SDK and `jev-latest`. Keys remain server-side; never call Jev directly from browser code.

## Adapting selectors

Use browser developer tools or Playwright codegen to identify resilient review, text, and load-more locators. Prefer semantic attributes such as roles, text, and `data-*` contracts. The scraper blocks images, media, and fonts to reduce bandwidth.

## Production hardening

- Verify authorization, terms, robots guidance, rate limits, privacy, and retention rules.
- Keep the allowlist narrow and add DNS/IP checks if this becomes a multi-user service.
- Add authentication, per-user quotas, job queues, cancellation, retries, logs, and observability.
- Tune the confidence threshold using labeled examples from the real domain; do not treat `0.72` as universal.
- For high-stakes actions, send the slow path to a human or a stronger reasoning model.
