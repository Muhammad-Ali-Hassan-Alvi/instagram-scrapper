# Instagram Scraper — Technical Research Blueprint

> **Purpose:** Technical blueprint for the future Instagram scraper implementation in this project.  
> **Scope:** Research and documentation only. No scraping code is implemented here.  
> **Last updated:** 2026-06-27  
> **Status:** Living document — Instagram changes endpoints, `doc_id` values, and response shapes without notice.

---

## Important Notes Before Implementation

1. **This project scrapes via the Instagram web client**, not the official [Instagram Graph API](https://developers.facebook.com/docs/instagram-platform/). Graph API behavior is referenced only where it clarifies field availability boundaries.
2. **Endpoints and `doc_id` values rotate.** Community tools (e.g. [instaloader](https://github.com/instaloader/instaloader)) report that hardcoded GraphQL `doc_id` values can start returning `401 Unauthorized` even with valid sessions. Treat all `doc_id` values as **UNKNOWN until verified at implementation time**.
3. **Anything not directly confirmed from public documentation or reproducible community research is marked `UNKNOWN`.**
4. **Legal / ToS:** Instagram's Terms of Service restrict automated access. This document describes technical behavior only for an internal tool scraping accounts you control.

---

## Section 1 — Instagram Authentication Flow

### 1.1 Browser Login Flow

Instagram web login is a standard browser form flow:

| Step | URL / Action | Notes |
|------|--------------|-------|
| 1 | Navigate to `https://www.instagram.com/` | May redirect unauthenticated users to login |
| 2 | Open login form | Typically `https://www.instagram.com/accounts/login/` |
| 3 | Submit username + password | Form POST to Instagram auth endpoints |
| 4 | Handle post-login redirects | Instagram may redirect through intermediate challenge URLs |
| 5 | Land on authenticated home/feed | Indicates successful session establishment |

**Confirmed post-login complications** (documented across Instagram web client reverse-engineering communities):

| Response / Error | Meaning | Automation impact |
|------------------|---------|-------------------|
| `challenge_required` | Soft verification (SMS/email code) | Requires human or programmatic code handler |
| `checkpoint_required` | Hard checkpoint | Often requires manual resolution in official app |
| Two-factor authentication (TOTP/SMS) | Additional code after password | Requires 2FA code at login time |
| `feedback_required` | Longer anti-abuse block | Stop automation; wait hours to days |

**UNKNOWN for this project:**

- Exact request URLs and payload shapes for the current web login POST (Instagram obfuscates and changes these).
- Whether our two target accounts have 2FA enabled.
- Whether Meta will trigger challenges on headless/automation login from the deployment environment (Vercel IP, datacenter IP, etc.).

### 1.2 Session Cookies

After successful login, Instagram persists session state primarily through HTTP cookies on domain `.instagram.com`.

**Commonly observed cookies** (confirmed across multiple automation references):

| Cookie | Role | Notes |
|--------|------|-------|
| `sessionid` | Primary session identifier | Most critical cookie for authenticated requests |
| `csrftoken` | CSRF protection token | Used as cookie and request header |
| `ds_user_id` | Logged-in user's numeric ID | Often present in authenticated sessions |
| `mid` | Machine / browser identifier | Part of device fingerprint |
| `ig_did` | Device identifier | Part of device fingerprint |
| `rur` | Routing / region cookie | Observed in sessions; exact purpose **UNKNOWN** |

Additional cookies may be set. The full required cookie set for all endpoints is **UNKNOWN**.

**Cookie attributes (typical):**

- `sessionid`: `HttpOnly`, `Secure`, `SameSite=None` (or `Lax` in some contexts)
- `csrftoken`: readable from JavaScript in some configurations (`HttpOnly: false` reported)

### 1.3 `storageState` (Playwright)

[Playwright `storageState`](https://playwright.dev/docs/auth) serializes browser context state to JSON, including:

- Cookies (including `sessionid`, `csrftoken`, etc.)
- `localStorage` entries per origin
- IndexedDB state (where applicable)

**Planned strategy for this project:**

1. Perform browser login once (manual or scripted).
2. Save `storageState` to a git-ignored file (e.g. `playwright/.auth/instagram.json`).
3. Load `storageState` on subsequent scraper runs to skip re-login.
4. Never commit session files to version control.

**UNKNOWN:**

- Whether Instagram stores critical auth state in `sessionStorage` (Playwright does not persist `sessionStorage` by default).
- Optimal storage file location for Vercel deployment (serverless cold starts, ephemeral filesystem).

### 1.4 CSRF Token

Instagram web POST requests (GraphQL mutations, some API calls) require CSRF validation.

**Confirmed sources of CSRF token:**

| Source | Location |
|--------|----------|
| Cookie | `csrftoken` |
| Request header | `X-CSRFToken: <csrftoken value>` |
| HTML meta tag | Sometimes embedded in page (re-fetched on navigation) |

**Implementation rule:** When issuing authenticated POST requests, send `X-CSRFToken` matching the current `csrftoken` cookie from the active browser context.

**UNKNOWN:**

- Whether all GET endpoints require CSRF headers.
- Whether CSRF token rotation invalidates in-flight sessions.

### 1.5 Session Reuse Strategy

Recommended approach for this internal 24-hour scrape job:

```
Run 1: Login → save storageState → scrape → exit
Run 2+: Load storageState → validate session → scrape → exit
```

**Session validation checks** (before scraping):

1. Navigate to `https://www.instagram.com/` and confirm not redirected to `/accounts/login/`.
2. Optionally call a lightweight authenticated endpoint and check for `200` + expected JSON shape.
3. If validation fails → re-login → overwrite `storageState`.

**Additional reuse principles** (confirmed in automation best-practice literature):

- Reuse the **same device fingerprint** (cookies + local storage) across runs.
- Avoid logging in on every run — increases challenge risk.
- Pin a stable IP/proxy per account where possible; per-request IP rotation is flagged as suspicious.

### 1.6 Session Expiration Strategy

**Confirmed expiration / invalidation signals:**

| Signal | Action |
|--------|--------|
| Redirect to `/accounts/login/` | Session expired or invalidated → re-login |
| API response `401` / `403` with login message | Re-login or refresh session |
| `checkpoint_required` / `challenge_required` | Pause automation; manual or scripted recovery |
| `"Please wait a few minutes before you try again."` | Rate limit — not necessarily session expiry; back off before retry |
| Cookie `sessionid` past `expires` attribute | Session expired → re-login |

**UNKNOWN:**

- Exact TTL of `sessionid` cookie (varies; not publicly documented).
- Whether Instagram silently extends sessions on activity.
- Maximum session age before forced re-authentication for automation clients.

**Recommended expiration handling:**

1. On scrape start: validate session (Section 1.5).
2. On mid-scrape auth failure: abort current run, log to `ScrapeLog`, attempt one re-login, retry scrape once.
3. Persist updated `storageState` after every successful login.
4. If re-login triggers checkpoint: mark scrape as failed; require manual intervention.

---

## Section 2 — Public Profile Data

### Data Source Overview

Instagram profile data can be retrieved through multiple web client paths:

| Source | Endpoint / Location | Auth typically required? |
|--------|---------------------|--------------------------|
| Web profile API | `GET https://i.instagram.com/api/v1/users/web_profile_info/?username={username}` | Often works without login for **public** profiles; blocked/throttled without proper headers |
| Web profile API (alternate host) | `GET https://www.instagram.com/api/v1/users/web_profile_info/?username={username}` | Same as above; host behavior may differ |
| Legacy embedded JSON | `window._sharedData` in profile page HTML | **Largely deprecated** — often absent in page source |
| Legacy JSON param | `/?__a=1` on profile URL | **Deprecated / removed** |
| GraphQL | `POST https://www.instagram.com/graphql/query` | Varies; many queries require authenticated session |
| Logged-in feed API | `GET https://www.instagram.com/api/v1/feed/user/{user_id}/` | Requires authenticated session |

**Required headers** (commonly reported for `web_profile_info`):

```
X-IG-App-ID: 936619743392459
User-Agent: <realistic browser UA>
Accept: */*
Accept-Encoding: gzip, deflate, br
Referer: https://www.instagram.com/
```

> **Note:** `X-IG-App-ID: 936619743392459` is widely reported as Instagram's web app ID. Verify at implementation time — value could change.

### Field-by-Field Analysis

Mapping to our `Account` model (`src/models/Account.ts`).

#### Username

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.username` (`web_profile_info`) or `graphql.user.username` |
| **Public?** | Yes — visible on public profiles |
| **Login required?** | No for public profiles via `web_profile_info` (when not blocked) |
| **Exact value available?** | Yes — string handle without `@` |

#### Display Name

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.full_name` or `graphql.user.full_name` |
| **Public?** | Yes for public profiles |
| **Login required?** | No for public profiles (when endpoint accessible) |
| **Exact value available?** | Yes |

#### Followers

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.edge_followed_by.count` or `data.user.follower_count` |
| **Public?** | Count visible on public profiles |
| **Login required?** | No for public profiles (when endpoint accessible). Private profiles: limited without follow/auth |
| **Exact value available?** | Yes — integer count when returned. UI may abbreviate (e.g. "1.2M") but API returns exact count |

#### Following

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.edge_follow.count` or `data.user.following_count` |
| **Public?** | Yes for public profiles |
| **Login required?** | Same as followers |
| **Exact value available?** | Yes — integer count |

#### Total Posts

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.edge_owner_to_timeline_media.count` or `data.user.media_count` |
| **Public?** | Yes — post count shown on profile |
| **Login required?** | No for public profiles (when endpoint accessible) |
| **Exact value available?** | Yes — integer count |

#### Biography

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.biography` |
| **Public?** | Yes for public profiles |
| **Login required?** | No for public profiles. Empty string if no bio |
| **Exact value available?** | Yes — full text in API; may differ from rendered HTML line breaks |

#### Verified

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.is_verified` |
| **Public?** | Yes |
| **Login required?** | No for public profiles |
| **Exact value available?** | Yes — boolean |

#### Profile Picture

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.profile_pic_url_hd` (preferred) or `profile_pic_url` |
| **Public?** | Yes |
| **Login required?** | No for public profiles |
| **Exact value available?** | URL to CDN image — exact URL string. Image bytes require separate HTTP GET. URL may expire (**expiry behavior UNKNOWN**) |

#### Account ID

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.id` or `data.user.pk` (numeric user ID as string) |
| **Public?** | Not shown in UI, but returned in API JSON |
| **Login required?** | Returned by `web_profile_info` without login (when accessible). Required for pagination API calls |
| **Exact value available?** | Yes — stable numeric identifier as string |

#### Additional model field: `private`

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `data.user.is_private` |
| **Public?** | Yes — privacy status is visible |
| **Login required?** | No |
| **Exact value available?** | Yes — boolean. **Scraping posts from private accounts requires authenticated session with follow access** |

---

## Section 3 — Post Data

### Data Source Overview

Post data is loaded via the profile timeline, not from the profile summary alone.

| Source | Typical use | Auth |
|--------|-------------|------|
| Initial profile response | First ~12 posts embedded in `edge_owner_to_timeline_media.edges` | Varies |
| GraphQL timeline query | Paginated post fetch via `POST /graphql/query` | Usually requires login for reliable access |
| REST user feed | `GET /api/v1/feed/user/{user_id}/?max_id={cursor}` | Requires authenticated session (reported as current reliable fallback) |

Response nodes may appear in **GraphQL edge format** or **`iphone_struct` format** depending on endpoint. Field names differ between formats — normalize during implementation.

Mapping to our `Post` model (`src/models/Post.ts`).

### Field-by-Field Analysis

#### Post ID

| Attribute | Value |
|-----------|-------|
| **Instagram source (GraphQL)** | `node.id` |
| **Instagram source (REST/iphone)** | `id` or `pk` |
| **Publicly available?** | Returned in timeline responses for accessible posts |
| **Exact value?** | Yes — numeric string, stable media identifier |

#### Shortcode

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `node.shortcode` or `code` |
| **Publicly available?** | Yes — used in public URLs `instagram.com/p/{shortcode}/` and `instagram.com/reel/{shortcode}/` |
| **Exact value?** | Yes — alphanumeric string |

#### Caption

| Attribute | Value |
|-----------|-------|
| **Instagram source (GraphQL)** | `edge_media_to_caption.edges[0].node.text` |
| **Instagram source (REST/iphone)** | `caption.text` or `caption` |
| **Publicly available?** | Yes for public posts |
| **Exact value?** | Yes — full caption text when present. Empty string if no caption |

#### Hashtags

| Attribute | Value |
|-----------|-------|
| **Instagram source** | **No dedicated public field confirmed** — typically parsed from caption text (`#tag` pattern) |
| **Alternative** | `edge_media_to_hashtag` or similar GraphQL edges — availability **UNKNOWN** on current endpoints |
| **Publicly available?** | Hashtags visible in caption on public posts |
| **Exact value?** | Parsed list — exact extraction rules must be defined at implementation (normalization, unicode, compound hashtags **UNKNOWN**) |

#### Mentions

| Attribute | Value |
|-----------|-------|
| **Instagram source** | Parsed from caption (`@username` pattern) and/or `edge_media_to_tagged_user.edges[].node.user.username` |
| **Publicly available?** | Visible on public posts when users are tagged |
| **Exact value?** | Parsed/tagged user list — exact merge strategy **UNKNOWN** |

#### Posted Date

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `taken_at_timestamp` (Unix seconds) or `taken_at` |
| **Publicly available?** | Yes |
| **Exact value?** | Yes — convert Unix timestamp to `Date` |

#### Likes

| Attribute | Value |
|-----------|-------|
| **Instagram source (GraphQL)** | `edge_liked_by.count` or `edge_media_preview_like.count` |
| **Instagram source (REST/iphone)** | `like_count` |
| **Publicly available?** | Usually yes for public posts; account owner can hide like counts |
| **Exact value?** | Integer when returned. `-1` or field omitted when hidden (**behavior UNKNOWN — verify**) |

#### Comments

| Attribute | Value |
|-----------|-------|
| **Instagram source (GraphQL)** | `edge_media_to_comment.count` or `edge_media_to_parent_comment.count` |
| **Instagram source (REST/iphone)** | `comment_count` |
| **Publicly available?** | Usually yes for public posts |
| **Exact value?** | Integer count (not full comment thread) |

#### Views

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `video_view_count`, `play_count`, `view_count` (varies by media type and endpoint) |
| **Publicly available?** | **Videos/Reels:** often shown publicly. **Static images:** typically no view count |
| **Exact value?** | Integer when field present. Absent or `0` for non-video posts |
| **Notes** | Official Graph API distinguishes `plays` vs `views` for Reels. Web field naming is inconsistent |

#### Shares

| Attribute | Value |
|-----------|-------|
| **Instagram source (web timeline)** | **UNKNOWN** — not observed on standard public post timeline JSON |
| **Instagram source (official Graph API)** | `shares` metric via `/insights` — owner/creator accounts only, not web scrape |
| **Publicly available?** | **Not confirmed** on web client public post cards |
| **Exact value?** | **UNKNOWN** for web scraping approach. Default to `0` with TODO unless discovered during implementation |

#### Saves

| Attribute | Value |
|-----------|-------|
| **Instagram source (web timeline)** | **UNKNOWN** — not observed on public post JSON |
| **Instagram source (official Graph API)** | `saved` / `saved_count` — owner-only insights |
| **Publicly available?** | **No** — not available on public web timeline |
| **Exact value?** | **UNKNOWN** for web scraping. Our model includes `saves`; expect `0` unless owner insights path added later |

#### Media Type

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `__typename` (`GraphImage`, `GraphVideo`, `GraphSidecar`), `media_type` (1=image, 2=video, 8=carousel), `product_type` (`feed`, `clips`, `igtv`) |
| **Publicly available?** | Yes |
| **Exact value?** | Requires mapping to our enum: `image`, `reel`, `carousel`, `video` — mapping rules **partially UNKNOWN** (see Section 8) |

#### Duration

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `video_duration` (seconds, float) |
| **Publicly available?** | For video/reel posts when returned in API |
| **Exact value?** | Seconds (may be fractional). `null` for non-video |

#### Thumbnail

| Attribute | Value |
|-----------|-------|
| **Instagram source** | `thumbnail_src`, `display_url`, `image_versions2.candidates[0].url` |
| **Publicly available?** | Yes — CDN URL |
| **Exact value?** | URL string. Multiple resolutions available; pick highest quality or consistent size (**selection rule UNKNOWN**) |

#### Media URL

| Attribute | Value |
|-----------|-------|
| **Instagram source (image)** | `display_url` |
| **Instagram source (video)** | `video_url` or `video_versions[].url` |
| **Instagram source (carousel)** | Multiple URLs in `edge_sidecar_to_children.edges[].node` |
| **Publicly available?** | Yes for accessible public posts |
| **Exact value?** | URL string(s). Carousel storage strategy in our single `mediaUrl` field **UNKNOWN** — may need first slide only or separate model change (out of scope) |

---

## Section 4 — Pagination Strategy

Instagram profile posts use **cursor-based pagination** (Relay-style `page_info`).

### 4.1 Cursor-Based Pagination (GraphQL)

**Mechanism:**

```json
{
  "page_info": {
    "has_next_page": true,
    "end_cursor": "QVFCM..."
  },
  "edges": [ /* posts */ ]
}
```

**Next page request (conceptual):**

```
POST https://www.instagram.com/graphql/query
Content-Type: application/x-www-form-urlencoded

doc_id=<UNKNOWN>
variables={"id":"<user_id>","first":12,"after":"<end_cursor>"}
```

**Headers:** Session cookies + `X-CSRFToken` + `X-IG-App-ID` + realistic `User-Agent`.

> **Critical:** The `doc_id` for user timeline queries rotates. Community reports document revoked IDs (e.g. `7898261790222653`) and replacements (e.g. `34579740524958711`). **Do not hardcode without verification.**

### 4.2 REST Pagination (Reported Fallback)

When GraphQL `doc_id` fails with persistent `401`, community tools fall back to:

```
GET https://www.instagram.com/api/v1/feed/user/{user_id}/?max_id={next_max_id}
```

**Pagination fields (REST):**

| Field | Meaning |
|-------|---------|
| `more_available` | Boolean — more pages exist |
| `next_max_id` | Cursor for next page |
| `items` | Array of posts (`iphone_struct` shape) |

### 4.3 How Instagram Loads Additional Posts (Browser Behavior)

1. User opens profile page → initial batch loaded (embedded or XHR).
2. User scrolls grid → client sends paginated request with previous `end_cursor` or `max_id`.
3. New posts appended to grid until `has_next_page: false` or `more_available: false`.

### 4.4 Typical Page Size

| Context | Count |
|---------|-------|
| GraphQL `first` parameter | **12** (default used by Instagram web client; confirmed in multiple reverse-engineering writeups) |
| Initial profile embed | **~12 posts** |
| REST feed page | **UNKNOWN** exact count — likely similar (~12) |

### 4.5 How to Continue Loading

```
cursor = null
loop:
  response = fetch_page(user_id, cursor)
  yield posts from response
  if not response.has_next_page:
    break
  cursor = response.end_cursor
  wait random_delay()
```

**Stop conditions:**

- `has_next_page === false`
- `more_available === false`
- Empty `edges` / `items` array
- Rate limit error — stop and backoff
- Duplicate cursor returned — stop (infinite loop guard)

---

## Section 5 — Scraping Strategy

Complete flow for the 24-hour internal scrape job (two Instagram accounts).

```
┌─────────────────────────────────────────────────────────────┐
│                        START SCRAPE                         │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. LOGIN                                                    │
│    • Load Playwright storageState if exists                 │
│    • Validate session (not redirected to login)             │
│    • If invalid: browser login with env credentials         │
│    • Handle challenge/2FA if triggered (manual fallback)    │
│    • Save updated storageState                              │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LOAD PROFILE                                             │
│    • Navigate to https://www.instagram.com/{username}/      │
│    • OR call web_profile_info / authenticated profile API   │
│    • Confirm account accessible (public or authorized)      │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. COLLECT PROFILE                                          │
│    • Extract: username, displayName, accountId, followers,  │
│      following, totalPosts, biography, verified, private,   │
│      profileImage                                           │
│    • Upsert Account document in MongoDB                     │
│    • Set lastScrapedAt after successful profile write       │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. FETCH POSTS (first page)                                 │
│    • From profile embed OR dedicated timeline API           │
│    • Normalize post JSON to internal schema                 │
│    • Parse hashtags/mentions from caption                   │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. PAGINATE                                                 │
│    • While has_next_page / more_available:                  │
│        - Wait random delay                                  │
│        - Fetch next page with end_cursor / next_max_id       │
│        - Normalize and queue posts                          │
│    • Stop at rate limit or end of timeline                  │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. SAVE MONGODB                                             │
│    • Upsert posts by compound key (accountId + postId)      │
│    • Update metrics on existing posts                       │
│    • Write ScrapeLog (startedAt, completedAt, counts, etc.) │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. FINISH                                                   │
│    • Close browser context                                  │
│    • Persist storageState                                   │
│    • Return scrape summary                                  │
└─────────────────────────────────────────────────────────────┘
```

**Per-account loop:** Repeat steps 2–7 for each configured Instagram username.

**ScrapeLog integration:** Create log entry at step 1 (`startedAt`), finalize at step 7 (`completedAt`, `durationMs`, `success`, counts).

---

## Section 6 — Rate Limiting Strategy

Instagram enforces undocumented rate limits. Error messages may appear even with HTTP `200` status.

### 6.1 Random Delays

| Between | Recommended delay | Confidence |
|---------|-------------------|------------|
| Pagination requests | 2–5 seconds + random jitter | Industry practice; exact safe values **UNKNOWN** |
| Profile loads | 3–8 seconds | Conservative estimate |
| After rate limit hit | 10–30 minutes minimum | Confirmed in community recovery guides |

**Implementation pattern:**

```
delay = base_ms + random(0, jitter_ms)
await sleep(delay)
```

Avoid perfectly uniform intervals — constant timing patterns are flagged as bot-like.

### 6.2 Chunk Size

| Parameter | Value |
|-----------|-------|
| Posts per pagination request | **12** (match Instagram default `first` param) |
| Accounts per session | **2** (project requirement) |
| Concurrent requests | **1** per session (sequential pagination) |

Parallel scraping of multiple accounts from one session: **UNKNOWN** safe concurrency — default to sequential.

### 6.3 Session Reuse

- Reuse `storageState` across daily runs.
- Re-login only when session validation fails.
- Do not rotate IP between pagination requests.
- Keep consistent `User-Agent` and device cookies.

### 6.4 Retries

| Error type | Retry strategy |
|------------|----------------|
| Transient network error | Retry up to 3 times with exponential backoff (1s, 2s, 4s) |
| HTTP 429 / `Please wait a few minutes` | No immediate retry. Back off 10–30 min. Max 1 retry per scrape run |
| HTTP 401 on GraphQL `doc_id` | Switch to REST fallback endpoint; do not retry same `doc_id` in loop |
| `challenge_required` | Do not retry automatically. Alert for manual resolution |
| `checkpoint_required` | Stop. Manual resolution required |
| MongoDB write failure | Retry up to 3 times; fail scrape if persistent |

### 6.5 Error Handling

| Category | Detection | Action |
|----------|-----------|--------|
| Auth failure | Login redirect, missing `sessionid` | Re-login once; fail scrape if still invalid |
| Rate limit | 429, "Please wait a few minutes" message | Log warning, backoff, partial save if needed |
| Account not found | 404 on profile | Log error, skip account, continue to next |
| Private account blocked | Empty timeline without access | Log error, save profile only if available |
| Schema drift | Missing expected JSON fields | Log field name, use defaults, add to Section 8 investigation |
| Endpoint revoked | Persistent 401 on pagination | Switch fallback endpoint; document new `doc_id` |

**ScrapeLog fields for errors:**

- `success: false`
- `errorMessage: "< categorized error >"`
- Partial counts (`pagesScraped`, `postsInserted`, `postsUpdated`) still recorded

---

## Section 7 — Field Mapping Table

### Account Fields

| Client Field (`Account` model) | Instagram Source | Available (web scrape) | Exact | Example |
|-------------------------------|------------------|------------------------|-------|---------|
| `platform` | Hardcoded `"instagram"` | Yes | Yes | `"instagram"` |
| `username` | `data.user.username` | Yes | Yes | `"nike"` |
| `displayName` | `data.user.full_name` | Yes | Yes | `"Nike"` |
| `accountId` | `data.user.id` / `pk` | Yes | Yes | `"659492624"` |
| `profileImage` | `data.user.profile_pic_url_hd` | Yes | URL exact | `"https://instagram.fxxx.fbcdn.net/..."` |
| `followers` | `edge_followed_by.count` / `follower_count` | Yes | Yes | `306000000` |
| `following` | `edge_follow.count` / `following_count` | Yes | Yes | `123` |
| `totalPosts` | `edge_owner_to_timeline_media.count` / `media_count` | Yes | Yes | `1234` |
| `biography` | `data.user.biography` | Yes | Yes | `"Just Do It."` |
| `verified` | `data.user.is_verified` | Yes | Yes | `true` |
| `private` | `data.user.is_private` | Yes | Yes | `false` |
| `lastScrapedAt` | Generated by scraper | Yes | Yes | `2026-06-27T12:00:00.000Z` |

### Post Fields

| Client Field (`Post` model) | Instagram Source | Available (web scrape) | Exact | Example |
|----------------------------|------------------|------------------------|-------|---------|
| `accountId` | MongoDB `Account._id` (resolved from Instagram user ID) | Yes | Yes | `ObjectId("...")` |
| `platform` | Hardcoded `"instagram"` | Yes | Yes | `"instagram"` |
| `postId` | `node.id` / `id` | Yes | Yes | `"34567890123456789"` |
| `shortcode` | `node.shortcode` / `code` | Yes | Yes | `"CabcDeFgHiJ"` |
| `type` | Derived from `media_type`, `product_type`, `__typename` | Partial | Mapping needed | `"reel"` |
| `caption` | `edge_media_to_caption...text` / `caption.text` | Yes | Yes | `"New drop 🔥 #brand"` |
| `hashtags` | Parsed from caption | Partial | Parsed | `["brand", "drop"]` |
| `mentions` | Parsed from caption + tagged users | Partial | Parsed | `["partner"]` |
| `mediaUrl` | `display_url` / `video_url` | Yes | URL exact | `"https://instagram.fxxx.fbcdn.net/..."` |
| `thumbnailUrl` | `thumbnail_src` / `display_url` | Yes | URL exact | `"https://instagram.fxxx.fbcdn.net/..."` |
| `postedAt` | `taken_at_timestamp` | Yes | Yes | `2026-06-01T14:30:00.000Z` |
| `likes` | `like_count` / `edge_liked_by.count` | Usually | Yes* | `15432` |
| `comments` | `comment_count` / `edge_media_to_comment.count` | Usually | Yes | `842` |
| `shares` | **UNKNOWN** on web timeline | **UNKNOWN** | **UNKNOWN** | `0` (default) |
| `saves` | Not on public web timeline | No | No | `0` (default) |
| `views` | `video_view_count` / `play_count` | Video/Reels only | Yes when present | `250000` |
| `duration` | `video_duration` | Video/Reels only | Yes when present | `32.5` |
| `scrapedAt` | Generated by scraper | Yes | Yes | `2026-06-27T12:05:00.000Z` |

\* Like count may be hidden by account owner — behavior when hidden is **UNKNOWN**.

---

## Section 8 — Unknown Fields & Open Investigations

The following must be verified during implementation (live network inspection with authenticated session against our two target accounts).

### Endpoints & Infrastructure

| Item | Status |
|------|--------|
| Current GraphQL `doc_id` for user timeline pagination | **UNKNOWN** — must be captured from browser DevTools |
| Whether `web_profile_info` works without login from Vercel IPs | **UNKNOWN** |
| Whether REST `/api/v1/feed/user/{id}/` is the reliable primary path when logged in | Likely yes (community reports) — **verify** |
| Current valid `X-IG-App-ID` value | Reported `936619743392459` — **verify** |
| Required cookie set for authenticated pagination | **UNKNOWN** |
| Reels tab vs Posts tab — separate pagination endpoints? | **UNKNOWN** |

### Field Availability

| Item | Status |
|------|--------|
| `shares` on web timeline JSON | **UNKNOWN** |
| `saves` via any web endpoint (non-insights) | **UNKNOWN** — likely unavailable |
| Like count when owner hides likes | **UNKNOWN** — field omitted vs `-1` vs `0` |
| View count on static image posts | Expected absent — **verify** |
| Carousel `mediaUrl` strategy (first slide vs JSON array) | **UNKNOWN** — may need future model change |
| Hashtag extraction edge cases (unicode, emoji, dots) | **UNKNOWN** |
| `product_type: "clips"` → `PostType.reel` mapping rules | **UNKNOWN** — needs mapping table during implementation |
| IGTV / legacy video types → `PostType.video` vs `reel` | **UNKNOWN** |

### Authentication & Operations

| Item | Status |
|------|--------|
| `sessionid` cookie TTL | **UNKNOWN** |
| 2FA status of project Instagram accounts | **UNKNOWN** |
| Challenge frequency from Vercel/serverless IP | **UNKNOWN** |
| Optimal `storageState` refresh interval | **UNKNOWN** |
| Whether Playwright headless triggers more challenges than headed | **UNKNOWN** |
| Safe daily request budget per account | **UNKNOWN** |

### Data Freshness

| Item | Status |
|------|--------|
| CDN URL expiry for `profileImage`, `mediaUrl`, `thumbnailUrl` | **UNKNOWN** |
| Whether to store URLs only vs download media | Out of current scope — **UNKNOWN** |
| Metric lag between Instagram UI and API counts | **UNKNOWN** |

---

## Appendix A — Reference Endpoints (Unverified Snapshot)

> **Do not treat these as stable constants.** Capture fresh values from DevTools before implementation.

| Purpose | Method | URL |
|---------|--------|-----|
| Profile info | GET | `https://i.instagram.com/api/v1/users/web_profile_info/?username={username}` |
| User feed (REST) | GET | `https://www.instagram.com/api/v1/feed/user/{user_id}/?max_id={cursor}` |
| GraphQL query | POST | `https://www.instagram.com/graphql/query` |
| Profile page | GET | `https://www.instagram.com/{username}/` |
| Login | GET/POST | `https://www.instagram.com/accounts/login/` |

## Appendix B — Related Project Files

| File | Relevance |
|------|-----------|
| `src/models/Account.ts` | Account schema target |
| `src/models/Post.ts` | Post schema target |
| `src/models/ScrapeLog.ts` | Scrape run logging target |
| `src/config/env.ts` | `INSTAGRAM_USERNAME`, `INSTAGRAM_PASSWORD` |
| `src/scrapers/instagram/` | Future scraper implementation location |
| `src/playwright/` | Future browser automation helpers |

## Appendix C — Research Sources

- [Playwright Authentication / storageState](https://playwright.dev/docs/auth)
- [Instagram Platform — Media Insights (official API)](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/)
- [instaloader — doc_id rotation issues](https://github.com/instaloader/instaloader/issues/2689)
- [instaloader — doc_id fix PR](https://github.com/instaloader/instaloader/pull/2663)
- [Stack Overflow — Instagram GraphQL pagination](https://stackoverflow.com/questions/45787021/how-to-use-instagram-graphql)
- [Stack Overflow — deprecated `__a=1` / `_sharedData`](https://stackoverflow.com/questions/49788905/what-is-the-new-instagram-json-endpoint)
- [instagram-web-api — web_profile_info migration](https://github.com/jlobos/instagram-web-api/issues/291)
