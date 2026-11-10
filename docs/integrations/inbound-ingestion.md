# Inbound (push) ingestion

Lets external automations such as **n8n** or **IFTTT** **push** already-normalized
job/opportunity records into faindaGeeg. This is for **official-API or otherwise
authorized data only** — no scraping. The sender is responsible for retrieving
data through permitted means (Reddit/X OAuth apps, official feeds, manual
curation, etc.) and for normalizing it into the record shape below.

There are two complementary patterns:

- **Direct webhook** — the automation POSTs records to faindaGeeg as it collects
  them. Fast, but the app must be up when the automation fires.
- **Google Sheets buffer** — the automation appends rows to a published sheet and
  faindaGeeg drains it on demand. Durable; it survives app downtime and rate
  limits (see [Google Sheets buffer pattern](#google-sheets-buffer-pattern)).

## Endpoint

```
POST /api/ingestion/inbound
X-Webhook-Secret: <INGEST_WEBHOOK_SECRET>
Content-Type: application/json
```

Authentication is a shared secret sent in the `X-Webhook-Secret` header. There
is no per-user auth on this endpoint.

### Responses

| Status | When | Body |
| --- | --- | --- |
| `202 Accepted` | Records accepted for background processing | `{ "data": { "accepted", "duplicates", "runIds" } }` |
| `401 Unauthorized` | Missing or wrong `X-Webhook-Secret` | `{ "error": { "message": "Invalid webhook secret", "statusCode": 401 } }` |
| `503 Service Unavailable` | `INGEST_WEBHOOK_SECRET` is unset (feature disabled) | `{ "error": { "message": "Inbound ingestion is disabled", "statusCode": 503 } }` |

`accepted` is the number of new records persisted, `duplicates` the number
skipped by dedup, and `runIds` the ingestion run ids created (one per distinct
`source` name in the batch).

## Request body

The body accepts any of three shapes:

- a **single record** — `{ ... }`
- a **bare array** — `[{ ... }, { ... }]`
- an **object with a `records` array** — `{ "records": [ ... ] }`

A batch may contain **at most 50 records**.

### Record fields

| Field | Required | Notes |
| --- | --- | --- |
| `source` | **yes** | Feed name, e.g. `"X - r/forhire search"`. Upserted as a `Source`, so reuse the same name to group records (and their runs) together. |
| `sourceType` | no | One of the `source_type` enum: `x`, `reddit`, `github`, `job_board`, `review`, `facebook`, `instagram`, `manual`, `other`. Defaults to `other`. Uses the first record's value when records share a `source`. |
| `content` | **yes** | The raw text of the post/listing. Treated as untrusted (see [Security notes](#security-notes)). |
| `externalId` | no | Stable id from the upstream source, used for dedup. Falls back to a content hash when omitted. |
| `url` | no | Canonical link to the original item. |
| `title` | no | Short title. |
| `author` | no | Author handle/name; feeds independent-source counts. |
| `publishedAt` | no | ISO 8601 timestamp. |

### How records are processed

Records are **accepted immediately (202)** and processed in the background per
source. Dedup is **per source**, by `externalId` when supplied (otherwise by
content hash), so the same item pushed twice is counted as a duplicate and not
reprocessed. Each batch appears as an **ingestion run** on the **Sources** page
(status, counts, errors), and each new record is extracted and scored like any
other source record — creating opportunities only when it is relevant and
schema-valid.

## Examples

### curl

```bash
curl -X POST http://localhost:3001/api/ingestion/inbound \
  -H 'content-type: application/json' \
  -H 'x-webhook-secret: YOUR_INGEST_WEBHOOK_SECRET' \
  -d '{
    "source": "X - r/forhire search",
    "sourceType": "reddit",
    "externalId": "t3_abc123",
    "url": "https://www.reddit.com/r/forhire/comments/abc123/",
    "title": "Hiring a React/Node developer for a dashboard",
    "content": "Looking to hire a freelance React/Node.js developer to build an internal dashboard. Budget ~$5k.",
    "author": "u/someone",
    "publishedAt": "2026-11-10T14:30:00Z"
  }'
```

### JSON batch (bare array)

```bash
curl -X POST http://localhost:3001/api/ingestion/inbound \
  -H 'content-type: application/json' \
  -H 'x-webhook-secret: YOUR_INGEST_WEBHOOK_SECRET' \
  -d '[
    { "source": "X - r/forhire search", "sourceType": "reddit",
      "externalId": "t3_abc123", "content": "Hiring a React dev...", "url": "https://..." },
    { "source": "X - r/forhire search", "sourceType": "reddit",
      "externalId": "t3_def456", "content": "Need help migrating to Postgres...", "url": "https://..." }
  ]'
```

The same batch can be sent wrapped as `{ "records": [ ... ] }`.

## n8n example workflow

A minimal Reddit -> faindaGeeg flow:

1. **Reddit Trigger** (OAuth, e.g. a subreddit search or "new posts" trigger).
   Use Reddit's official API — do not scrape.
2. **Set / Edit Fields** — map each item to the record contract:

   | Record field | n8n expression (example) |
   | --- | --- |
   | `source` | `"X - r/forhire search"` (a constant feed name) |
   | `sourceType` | `"reddit"` |
   | `externalId` | `{{ $json.id }}` |
   | `url` | `{{ $json.url }}` |
   | `title` | `{{ $json.title }}` |
   | `content` | `{{ $json.selftext }}` |
   | `author` | `{{ $json.author }}` |
   | `publishedAt` | `{{ new Date($json.created_utc * 1000).toISOString() }}` |

3. **HTTP Request** node — `POST`
   `https://<your-app>/api/ingestion/inbound`, body content type **JSON**, body
   set to the record (or an array of records), and a header
   `X-Webhook-Secret: <INGEST_WEBHOOK_SECRET>`.

The same shape works for **X**: use n8n's X (Twitter) node or a generic HTTP
node against the official API, then the same Set/HTTP steps. Multiple records
from one trigger can be **batched into a single POST** (up to 50) to reduce
request count.

## Google Sheets buffer pattern

For durability, buffer items in a Google Sheet instead of (or in addition to)
direct webhooks. This survives app downtime and avoid needing the app to be
reachable when the automation runs.

1. Create a sheet with a header row of exactly these columns (case-insensitive;
   `externalId` falls back to `url`, then to a content hash):

   ```
   externalId,url,title,content,author,publishedAt
   ```

2. Have n8n/IFTTT **append rows** to that sheet (one row per item).
3. In Google Sheets, **File > Share > Publish to web**, choose the sheet and the
   **CSV** format, and copy the published URL.
4. Set `GOOGLE_SHEETS_CSV_URL` to that URL in the environment.
5. Run the **Google Sheets** source — from the **Sources** page, or:

   ```bash
   curl -X POST http://localhost:3001/api/ingestion/runs \
     -H 'content-type: application/json' \
     -d '{"sourceName":"Google Sheets"}'
   ```

Each run drains the whole sheet. Downstream dedup by `externalId` (or content
hash) means rows already ingested are skipped, so the sheet can keep growing.
Leave `GOOGLE_SHEETS_CSV_URL` blank to disable the source; running it without a
URL raises an error.

## Security notes

- **Keep the secret secret.** `INGEST_WEBHOOK_SECRET` is a shared bearer secret
  for the endpoint; anyone with it can inject records. Store it as an n8n
  credential / environment variable and rotate it if leaked. Leave it blank to
  disable inbound ingestion entirely.
- **Content is untrusted.** Pushed text is treated as data, never as
  instructions: the extraction prompt is injection-resistant and will not follow
  commands embedded in a record. Still, only push data you are authorized to
  process.
- **Prefer n8n over IFTTT for low-volume feeds.** The IFTTT free tier polls
  hourly and limits the number of applets, which is often too coarse for timely
  job feeds; n8n gives finer schedules, batching, and richer field mapping.
