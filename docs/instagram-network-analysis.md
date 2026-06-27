# Instagram Network Analysis — Live Capture Report

> **Purpose:** Implementation specification derived from live inspection of the Instagram web application.  
> **Capture date:** 2026-06-27  
> **Profile tested:** `https://www.instagram.com/instagram/`  
> **Method:** Playwright Chromium (headless), network request/response interception  
> **Auth state during capture:** **Logged out** (`__user=0`, no `sessionid` cookie observed)

---

## Capture Summary

| Metric | Value |
|--------|-------|
| Total XHR/fetch/document requests captured | 43 |
| Unique endpoint patterns | 9 |
| Scroll/pagination requests with `after`, `max_id`, or `feed/user` | **0** |
| Direct `fetch()` to `web_profile_info` without browser (follow-up test) | **429** |

**Important limitation:** This capture reflects **logged-out** behavior on a **public profile**. The project scraper will use **authenticated** sessions (`INSTAGRAM_USERNAME` / `INSTAGRAM_PASSWORD`). Post-pagination and some endpoints under login are marked **UNKNOWN** until a logged-in capture is performed.

**Raw capture artifacts:** `scripts/.research-output/` (research-only, not production code)

---

## Section 1 — Network Requests After Opening `/instagram/`

Requests below were observed in chronological order after navigating to `https://www.instagram.com/instagram/`, waiting for network idle, and scrolling.

### Common Headers (API calls)

Observed on most Instagram API XHR/fetch requests:

| Header | Example value | Notes |
|--------|---------------|-------|
| `User-Agent` | Chrome 131 / Windows | Required |
| `X-IG-App-ID` | `936619743392459` | Present on all Instagram API calls observed |
| `X-CSRFToken` | Set after first page load | Matches `csrftoken` cookie |
| `X-Requested-With` | `XMLHttpRequest` | On REST/legacy GraphQL GET |
| `X-ASBD-ID` | `359341` | Observed on web API calls |
| `X-Web-Device-ID` | UUID | Generated per browser session |
| `X-Web-Session-ID` | e.g. `ql715c:yuxl50:hknuus` | Web session identifier |
| `X-FB-LSD` | Token string | Facebook LSD token from page boot |
| `Referer` | `https://www.instagram.com/instagram/` | Profile URL |
| `Accept-Language` | `en-US` | |

POST `/api/graphql` additionally sends `Content-Type: application/x-www-form-urlencoded` and `X-FB-Friendly-Name` (GraphQL operation name).

**Authentication required (logged-out capture):** No. Public profile data returned without `sessionid`. Login-gated behavior **UNKNOWN**.

---

### Request Inventory

#### 1. Profile document

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.instagram.com/instagram/` |
| **Method** | GET |
| **Headers** | Standard navigation headers; `User-Agent`, `sec-ch-ua*` |
| **Response type** | `text/html` (document) |
| **Purpose** | Boot React app (Polaris), set initial cookies (`csrftoken`, etc.), load JS bundles |
| **Authentication required** | No |

---

#### 2. GraphQL — profile page content

| Field | Value |
|-------|-------|
| **Request URL** | `POST https://www.instagram.com/api/graphql` |
| **Method** | POST |
| **Headers** | `X-IG-App-ID`, `X-CSRFToken`, `X-FB-LSD`, `X-FB-Friendly-Name: PolarisProfilePageContentQuery`, `Content-Type: application/x-www-form-urlencoded` |
| **Body (key fields)** | `doc_id=26672929172408668`, `variables={"enable_integrity_filters":true,"id":"25025320",...}`, plus boot tokens: `lsd`, `__dyn`, `__csr`, `__rev`, `__hsi`, `__s`, `jazoest`, `__spin_r` |
| **Response type** | `application/json` |
| **Purpose** | Load profile page metadata (username, bio, follower counts, badges). **Does not return post grid edges** in observed response |
| **Authentication required** | No (logged-out capture) |

---

#### 3. GraphQL — school partner badge

| Field | Value |
|-------|-------|
| **Request URL** | `POST https://www.instagram.com/api/graphql` |
| **Method** | POST |
| **Headers** | Same GraphQL header pattern |
| **Body (key fields)** | `X-FB-Friendly-Name: PolarisSchoolPartnerProfileBadgeQuery`, `doc_id=35717419834538716`, `variables={"igid":"25025320"}` |
| **Response type** | `text/javascript` (non-JSON wrapper in some captures) |
| **Purpose** | UI badge metadata — not used for scraping |
| **Authentication required** | No |

---

#### 4. Analytics beacon

| Field | Value |
|-------|-------|
| **Request URL** | `POST https://www.instagram.com/ajax/bz?...` |
| **Method** | POST |
| **Headers** | `Content-Type: multipart/form-data`, `X-FB-LSD`, `X-ASBD-ID` |
| **Response type** | Unknown / small |
| **Purpose** | Client telemetry (`falco:ig_web_page_view`, `falco:bd_pdc_signals`) |
| **Authentication required** | No |

**Note:** Multiple `/ajax/bz` requests fire during page load and scroll (~6 observed).

---

#### 5. Profile info REST (primary data source)

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram` |
| **Method** | GET |
| **Headers** | `X-IG-App-ID: 936619743392459`, `X-CSRFToken`, `X-Requested-With: XMLHttpRequest`, `X-Web-Device-ID`, `X-Web-Session-ID`, `Referer` |
| **Response type** | `application/json; charset=utf-8` |
| **Response size (observed)** | ~621 KB |
| **Purpose** | **Primary source** for profile fields **and first page of posts** |
| **Authentication required** | No (public profile, logged-out) |

---

#### 6. Facebook cross-site user info

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.facebook.com/ig_xsite_user_info/` |
| **Method** | GET |
| **Response type** | JSON |
| **Purpose** | Cross-site / ads identity — not used for scraping |
| **Authentication required** | No |

---

#### 7. Route preloading

| Field | Value |
|-------|-------|
| **Request URL** | `POST https://www.instagram.com/ajax/bulk-route-definitions/` |
| **Method** | POST |
| **Headers** | `Content-Type: application/x-www-form-urlencoded`, `X-IG-D: www`, `X-FB-LSD` |
| **Response type** | `text/javascript` (JSONP-style `for(;;);{...}`) |
| **Purpose** | Preload React route definitions for profile, suggested accounts, footer links. **Triggered heavily on scroll** (~15 requests) |
| **Authentication required** | No |

---

#### 8. Legacy GraphQL GET — stories/highlights

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.instagram.com/graphql/query/?query_id=9957820854288654&user_id=25025320&include_chaining=false&include_reel=true&include_suggested_users=false&include_logged_out_extras=true&include_live_status=false&include_highlight_reels=true` |
| **Method** | GET |
| **Headers** | `X-IG-App-ID`, `X-CSRFToken`, `X-Requested-With` |
| **Response type** | `application/json` |
| **Purpose** | Stories, highlight reels, suggested chaining — **not post grid** |
| **Authentication required** | No |

Response `data.user` keys observed: `has_public_story`, `is_live`, `reel`, `edge_chaining`, `edge_highlight_reels`.

---

#### 9. Content ruling / gating

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.instagram.com/api/v1/web/get_ruling_for_content/?content_type=PROFILE&target_id=25025320` |
| **Method** | GET |
| **Headers** | Standard web API headers |
| **Response type** | `application/json` |
| **Purpose** | Content moderation / age gating rules |
| **Authentication required** | No |

---

#### 10. GraphQL POST — logged-out experiments (multiple)

| Field | Value |
|-------|-------|
| **Request URL** | `POST https://www.instagram.com/api/graphql` |
| **Method** | POST |
| **Body (key fields)** | `X-FB-Friendly-Name: fetchPolarisLoggedOutExperimentQuery`, `doc_id=26565457316490229` (multiple variable payloads) |
| **Response type** | `text/javascript` |
| **Purpose** | A/B experiments, dialogs — not scraping data |
| **Authentication required** | No |

Additional POST `/api/graphql` calls observed:

| Friendly name | doc_id | Purpose |
|---------------|--------|---------|
| `PolarisLoggedOutDynamicDialogQuery` | `26298724549801149` | Login/signup dialogs |
| `QuickPromotionSupportIGSchemaBatchFetchQuery` | `28296776023244273` | Promotional UI |

---

#### 11. Failed GraphQL GET — profile query

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.instagram.com/graphql/query/?doc_id=18113378221181848&variables={...user_id...}` |
| **Method** | GET |
| **Status** | **400** |
| **Response type** | `application/json` |
| **Response body** | `{"message":"invalid request","errors":[{"message":"execution error","summary":"Incorrect Query"}],"status":"fail"}` |
| **Purpose** | Attempted profile GraphQL query — **invalid in current web client** |
| **Authentication required** | N/A (failed) |

---

#### 12. JS module loader

| Field | Value |
|-------|-------|
| **Request URL** | `GET https://www.instagram.com/ajax/bootloader-endpoint/?modules=...` |
| **Method** | GET |
| **Response type** | JavaScript |
| **Purpose** | Lazy-load React modules (e.g. `PolarisLoggedOutDynamicDialog.react`) |
| **Authentication required** | No |

---

## Section 2 — Profile Field Sources

All values below were read from the live **`web_profile_info`** JSON response (`data.user`).

| Field | Source request | JSON path | Auth required (observed) | Exact value |
|-------|----------------|-----------|--------------------------|-------------|
| **Username** | `web_profile_info` | `data.user.username` | No | Yes — `"instagram"` |
| **Display Name** | `web_profile_info` | `data.user.full_name` | No | Yes — `"Instagram"` |
| **Followers** | `web_profile_info` | `data.user.edge_followed_by.count` | No | Yes — integer (observed: `685886816`) |
| **Following** | `web_profile_info` | `data.user.edge_follow.count` | No | Yes — integer (observed: `233`) |
| **Biography** | `web_profile_info` | `data.user.biography` | No | Yes — full string |
| **Profile Picture** | `web_profile_info` | `data.user.profile_pic_url_hd` (preferred) or `profile_pic_url` | No | Yes — CDN URL |
| **Account ID** | `web_profile_info` | `data.user.id` | No | Yes — `"25025320"` |
| **Verified** | `web_profile_info` | `data.user.is_verified` | No | Yes — boolean |
| **Post Count** | `web_profile_info` | `data.user.edge_owner_to_timeline_media.count` | No | Yes — integer (observed: `8501`) |

**Secondary confirmation (partial fields only):**

`POST /api/graphql` (`PolarisProfilePageContentQuery`) also returns: `username`, `full_name`, `biography`, `follower_count`, `following_count`, `is_verified`, `profile_pic_url`, `pk`, `id`.  
`media_count` was **`null`** in this response — **do not use** as post count source.

---

## Section 3 — Post Field Sources

### Primary source (first page)

**Request:** `GET /api/v1/users/web_profile_info/?username={username}`  
**Container:** `data.user.edge_owner_to_timeline_media`  
**Observed:** `count: 8501`, `edges.length: 12`, `page_info.has_next_page: true`

Each post node: `edge_owner_to_timeline_media.edges[].node`

| Field | JSON path (observed) | Present in response | Notes |
|-------|----------------------|---------------------|-------|
| **Posts (list)** | `edge_owner_to_timeline_media.edges[]` | Yes | 12 posts per initial load |
| **Post ID** | `node.id` | Yes | e.g. `"3928250036051888465"` |
| **Shortcode** | `node.shortcode` | Yes | e.g. `"DaD8phTyclR"` |
| **Caption** | `node.edge_media_to_caption.edges[0].node.text` | Yes | Empty array if no caption |
| **Hashtags** | No dedicated field | Parse from caption | **UNKNOWN** dedicated API field |
| **Mentions** | `node.edge_media_to_tagged_user.edges[].node.user.username` + caption | Partial | Tagged users in `edge_media_to_tagged_user` |
| **Posted Date** | `node.taken_at_timestamp` | Yes | Unix seconds |
| **Likes** | `node.edge_liked_by.count` or `node.edge_media_preview_like.count` | Yes | Observed exact integers |
| **Comments** | `node.edge_media_to_comment.count` | Yes | Observed exact integers |
| **Views** | `node.video_view_count` | Video/reel only | Absent on `GraphImage` posts |
| **Shares** | **Not observed** | No numeric field | Only `viewer_can_reshare: true` boolean |
| **Media URLs** | `node.display_url` (image), `node.video_url` (video) | Yes | CDN URLs |
| **Thumbnail** | `node.display_url` / `node.thumbnail_src` | Yes | Same as display for images |
| **Media Type** | `node.__typename` | Yes | `GraphImage`, `GraphVideo`, `GraphSidecar` |
| **Reels indicator** | `node.product_type` | Partial | Observed `"clips"` on reels; `undefined` on some images |
| **Duration** | `node.video_duration` | Video only | e.g. `178.2` seconds |

**Additional timeline observed:** `edge_felix_video_timeline` (IGTV/long video tab data, 12 edges) — separate from main post grid. Include/exclude policy for scraper: **UNKNOWN**.

### Post types observed (first 12)

| `__typename` | Count in sample |
|--------------|-----------------|
| `GraphImage` | Yes |
| `GraphVideo` | Yes |
| `GraphSidecar` | Yes |

---

## Section 4 — Pagination

### What the initial response provides

From `web_profile_info`:

```json
"edge_owner_to_timeline_media": {
  "count": 8501,
  "page_info": {
    "has_next_page": true,
    "end_cursor": "QVFBcmxITFhZRE5JVjM0OFR1..."
  },
  "edges": [ /* 12 posts */ ]
}
```

| Property | Observed value |
|----------|----------------|
| Posts per page | **12** |
| Cursor field | `page_info.end_cursor` |
| Has more | `page_info.has_next_page` |

### What happens on scroll (logged-out capture)

| Test | Result |
|------|--------|
| Scroll profile 15+ times (wheel + `main` scroll) | **0** pagination requests |
| Requests with `after`, `max_id`, `feed/user` in URL/body | **None** |
| Scroll-triggered requests | `/ajax/bulk-route-definitions/` only (suggested profiles, footer routes) |

**Conclusion (logged-out):** Instagram loads **12 posts** via `web_profile_info` and exposes a cursor, but **does not fire a follow-up post pagination request on scroll** in this capture.

### Manual pagination tests (logged-out browser context)

| Attempt | URL / method | Status | Result |
|---------|--------------|--------|--------|
| Legacy `query_id=17830106458427912` + `variables.after=end_cursor` | GET `/graphql/query/` | **400** | `"invalid request"` |
| `doc_id=26672929172408668` minimal POST body | POST `/api/graphql` | **200** | Returns **HTML**, not JSON — missing boot tokens |
| Direct HTTP `fetch(web_profile_info)` without browser | GET | **429** | Rate limited |

### Pagination mechanism (best current understanding)

| Question | Answer |
|----------|--------|
| GraphQL or REST? | **GraphQL** (POST `/api/graphql` with `doc_id` + `variables.after`) — inferred from client architecture; **not observed live for posts** |
| REST `/api/v1/feed/user/{id}/` | **Not observed** in this capture |
| Cursor or max_id? | Initial page uses **`end_cursor`** (Relay-style). `max_id` **not observed** |
| Which parameter changes? | **`variables.after`** should receive previous `page_info.end_cursor` (standard Relay pattern). **`first`** likely stays `12` — **UNKNOWN** exact pagination query name/doc_id |

**Authenticated pagination:** **UNKNOWN** — requires logged-in capture against target accounts.

---

## Section 5 — Where `doc_id` Comes From

### Observed `doc_id` values (2026-06-27 capture)

| doc_id | Operation (`X-FB-Friendly-Name`) | Transport | In initial HTML? |
|--------|-----------------------------------|-----------|------------------|
| `26672929172408668` | `PolarisProfilePageContentQuery` | POST `/api/graphql` | **No** |
| `35717419834538716` | `PolarisSchoolPartnerProfileBadgeQuery` | POST `/api/graphql` | **No** |
| `26565457316490229` | `fetchPolarisLoggedOutExperimentQuery` | POST `/api/graphql` | **No** |
| `26298724549801149` | `PolarisLoggedOutDynamicDialogQuery` | POST `/api/graphql` | **No** |
| `28296776023244273` | `QuickPromotionSupportIGSchemaBatchFetchQuery` | POST `/api/graphql` | **No** |
| `18113378221181848` | UNKNOWN (GET profile query) | GET `/graphql/query/` | **No** — returns **400** |

### Observed `query_id` (legacy GET GraphQL)

| query_id | In initial HTML? | Status |
|----------|------------------|--------|
| `9957820854288654` | **Yes** | 200 — stories/highlights only |
| `17830106458427912` | **UNKNOWN** | 400 when used for post pagination test |

### Source of `doc_id`

| Source | Confirmed? |
|--------|------------|
| Embedded in initial HTML | **No** (except legacy `query_id`, not POST `doc_id`) |
| Loaded dynamically from JS bundles | **Yes** — client sends `doc_id` in POST body at runtime |
| Static across sessions | **UNKNOWN** — values tied to web app build `__rev=1042254720` |
| Network response pre-seeding | **No** — first POST `/api/graphql` occurs after JS boot |

**Implementation rule:** Do **not** hardcode `doc_id` permanently. Extract from live browser network traffic or JS bundle at runtime. Values rotate with Instagram deploys.

POST `/api/graphql` also requires boot parameters observed in body: `lsd`, `__dyn`, `__csr`, `__rev`, `__hsi`, `__s`, `jazoest`, `__spin_r`, `__comet_req`. Minimal replay without these returned HTML instead of JSON.

---

## Section 6 — Endpoint Assessment

| Endpoint | Purpose | Stable? | Deprecated? | Risk | Should we use? |
|----------|---------|---------|-------------|------|----------------|
| `GET /api/v1/users/web_profile_info/?username=` | Profile + first 12 posts | Moderate | No (active in 2026 capture) | Medium — direct HTTP got **429** without browser | **Yes** — via Playwright browser context |
| `POST /api/graphql` (`PolarisProfilePageContentQuery`) | Profile metadata | Low | No | High — needs full boot tokens + rotating `doc_id` | **Optional** — redundant with `web_profile_info` for our fields |
| `POST /api/graphql` (post pagination) | Next post pages | **UNKNOWN** | **UNKNOWN** | High | **UNKNOWN** until logged-in pagination captured |
| `GET /graphql/query/?query_id=` | Legacy GraphQL | Low | Partially — post pagination query_id returned **400** | Medium | **No** for posts |
| `GET /graphql/query/?doc_id=` | Legacy GET GraphQL | Low | Yes — observed **400 invalid request** | High | **No** |
| `GET /api/v1/feed/user/{id}/` | REST user feed | **UNKNOWN** | Not observed | **UNKNOWN** | **UNKNOWN** — not seen in live capture |
| `POST /ajax/bulk-route-definitions/` | Route/hover preloading | Moderate | No | Low | **No** — not scraping data |
| `POST /ajax/bz` | Telemetry | Moderate | No | Low | **No** |
| `GET /api/v1/web/get_ruling_for_content/` | Content gating | Moderate | No | Low | **No** |
| `GET /facebook.com/ig_xsite_user_info/` | Cross-site identity | Moderate | No | Low | **No** |
| `GET /ajax/bootloader-endpoint/` | JS modules | Moderate | No | Low | **No** |

---

## Section 7 — Architecture Recommendation

### Choose: **Option B — Playwright + internal API requests**

### Why not Option A (Playwright DOM scraping)

- Post metrics (likes, comments, views) are **not reliably exposed** in DOM text; they live in JSON API responses.
- Instagram renders via React; DOM selectors change frequently.
- Pagination does not appear to expose additional posts in DOM without API calls (logged-out scroll fired zero post requests).

### Why not Option C (Direct HTTP requests)

Live evidence against standalone HTTP:

1. Direct `fetch` to `web_profile_info` returned **429** without browser fingerprint/cookies.
2. POST `/api/graphql` with only `doc_id` + `variables` returned **HTML** (not JSON) — requires boot tokens (`lsd`, `__dyn`, `__csr`, etc.) generated by the web app.
3. CSRF (`csrftoken`) and device/session headers are set during browser boot.

### Why Option B

1. **Login + session persistence** (`storageState`) requires a real browser context.
2. The browser already calls `web_profile_info` successfully — scraper should **intercept or replay** that call using cookies/headers from the active Playwright context.
3. Profile + first 12 posts come from **one structured JSON response** (~621 KB observed) — no DOM parsing needed.
4. When pagination is implemented, the browser will supply required boot tokens for POST `/api/graphql` — capture the pagination request from DevTools/network listener after login rather than reconstructing manually.
5. Aligns with project stack (Playwright already a dependency).

### Recommended implementation flow (spec)

```
1. Playwright launch with storageState (authenticated session)
2. page.goto(`https://www.instagram.com/{username}/`)
3. Wait for / intercept GET web_profile_info response
4. Parse data.user → Account fields
5. Parse data.user.edge_owner_to_timeline_media.edges → Post[] (first page)
6. If page_info.has_next_page:
     UNKNOWN — capture authenticated pagination request via network listener
     Pass end_cursor in variables.after (expected Relay pattern)
7. Upsert MongoDB
```

### Open items before coding pagination

| Item | Status |
|------|--------|
| Logged-in post pagination request URL/doc_id/friendly-name | **UNKNOWN** |
| Whether authenticated users use POST `/api/graphql` or REST feed | **UNKNOWN** |
| Whether scroll triggers pagination when logged in | **UNKNOWN** |
| `shares` / `saves` numeric fields in any web endpoint | **UNKNOWN** — not in observed JSON |

---

## Appendix A — Verified JSON Samples

### Profile (`web_profile_info`)

```json
{
  "data": {
    "user": {
      "id": "25025320",
      "username": "instagram",
      "full_name": "Instagram",
      "biography": "Discover what's new on Instagram 🔎✨",
      "is_verified": true,
      "edge_followed_by": { "count": 685886816 },
      "edge_follow": { "count": 233 },
      "edge_owner_to_timeline_media": {
        "count": 8501,
        "page_info": { "has_next_page": true, "end_cursor": "..." },
        "edges": [ "..." ]
      }
    }
  },
  "status": "ok"
}
```

### Post node (representative)

```json
{
  "id": "3928250036051888465",
  "shortcode": "DaD8phTyclR",
  "__typename": "GraphImage",
  "taken_at_timestamp": 1782504015,
  "edge_liked_by": { "count": 185068 },
  "edge_media_to_comment": { "count": 7408 },
  "display_url": "https://instagram.fskt2-1.fna.fbcdn.net/...",
  "is_video": false
}
```

---

## Appendix B — Follow-up Research Required

Before implementing full post pagination:

1. Repeat network capture **after authenticated login** against the two target accounts.
2. Scroll until a request contains `after` or `max_id` in POST body.
3. Record `X-FB-Friendly-Name`, `doc_id`, and full form body for that request.
4. Confirm whether `web_profile_info` alone is sufficient for small accounts (<12 posts).
5. Test if `i.instagram.com` host behaves differently from `www.instagram.com` — **not observed** in this capture (all calls used `www`).

---

## Appendix C — Research Method

| Script | Purpose |
|--------|---------|
| `scripts/research-network-capture.mjs` | Initial 43-request capture |
| `scripts/research-full-capture.mjs` | Full JSON bodies for key endpoints |
| `scripts/research-scroll-pagination.mjs` | Scroll pagination detection (0 hits) |
| `scripts/research-pagination-test.mjs` | Manual pagination replay tests |

These scripts are **research artifacts only** and must not ship as production scraper code.
