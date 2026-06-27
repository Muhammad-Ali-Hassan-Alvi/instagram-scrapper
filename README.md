# Social Analytics Scraper

Internal analytics tool for scraping and storing metrics from two Instagram accounts and two TikTok accounts. Built for a small team (one to two users), not for public use.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- MongoDB Atlas + Mongoose
- Playwright
- Vercel (deployment target)

## Project Setup

### Prerequisites

- Node.js 20+
- npm
- MongoDB Atlas cluster
- Instagram and TikTok credentials for scraping accounts

### Installation

```bash
git clone <repository-url>
cd instagram-scrapper
npm install
npx playwright install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
INSTAGRAM_USERNAME=your_instagram_username
INSTAGRAM_PASSWORD=your_instagram_password
TIKTOK_USERNAME=your_tiktok_username
TIKTOK_PASSWORD=your_tiktok_password
CRON_SECRET=optional_bearer_token_for_cron_route
CRON_SCHEDULE=0 6 * * *
CRON_TZ=UTC
RUN_SCRAPE_ON_START=false
```

`MONGO_URI` is accepted as an alias for `MONGODB_URI`. Instagram credentials are optional for a limited public scrape (~12 posts per account); add them for full historical pagination via `/api/v1/feed/user/`.

### 24-hour cron

**Recommended (local / VPS — Playwright needs a real browser):**

```bash
npm run cron
```

Runs forever and scrapes on `CRON_SCHEDULE` (default: `0 6 * * *` = daily at 06:00 UTC). Set `RUN_SCRAPE_ON_START=true` to also scrape when the worker starts.

**Vercel (HTTP trigger only — Playwright may not work on serverless):**

`vercel.json` calls `GET /api/cron/scrape` daily. Set `CRON_SECRET` in Vercel env; Vercel sends `Authorization: Bearer <CRON_SECRET>`.

## How to Run Locally

```bash
# Start the development server
npm run dev

# Type-check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Production build
npm run build
npm start

# Run Instagram scrape (nicky.cass + ball5show by default)
npm run scrape:instagram

# Start 24-hour cron worker (runs scrape daily at CRON_SCHEDULE)
npm run cron

# Run one scheduled scrape immediately (same as cron tick)
npm run cron:once

# Scrape specific accounts
npm run scrape:instagram -- ball5show nicky.cass
```

Output:
- `data/consolidated.csv` — latest metrics per post
- `data/snapshots/YYYY-MM-DD.csv` — daily snapshot
- `data/history/` — timestamped historical snapshots

Open [http://localhost:3000](http://localhost:3000) for the dashboard. Use **Export** in the nav for CSV, PDF, Word, and HTML downloads.

## Folder Structure

```
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # Shared UI components
├── config/           # Environment and app configuration
├── hooks/            # Custom React hooks
├── lib/              # Core utilities (e.g. database connection)
├── models/           # Mongoose schemas and models
├── playwright/       # Playwright browser automation helpers
├── scrapers/
│   ├── instagram/    # Instagram scraping logic
│   └── tiktok/       # TikTok scraping logic
├── services/         # Business logic and data services
├── types/            # Shared TypeScript types
└── utils/            # General-purpose utilities (logger, etc.)
```

## Future Roadmap

- [x] Mongoose models for Instagram account/post data
- [x] Playwright Instagram scraper + CSV export
- [x] Cron route for 24-hour scrape interval (`vercel.json`)
- [ ] TikTok scraper
- [ ] Internal dashboard for viewing analytics
- [ ] Authentication for internal users

## Coding Standards

- Strict TypeScript (`strict`, no `any`)
- Use `logger` from `src/utils/logger.ts` instead of `console.log`
- Small, reusable functions with JSDoc on exported APIs
- Path alias: `@/*` maps to `src/*`
