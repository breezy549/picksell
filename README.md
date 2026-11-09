# PickSell

Expo + React Native camera-first app for **web, iOS and Android**. Capture a photo or a short silent video, then request real AI observations through a separate Node server. No gallery upload or skill certification. Seller-confirmed offers can be published and receive non-binding quote requests.

## Setup

Use Node.js 22.13+ (LTS recommended).

```sh
npm install
cp .env.example .env
```

Add your OpenAI API key to `OPENAI_API_KEY` in `.env`. Never put secrets in `EXPO_PUBLIC_` variables; these are bundled into the client. `.env` is gitignored. The configured model defaults to `gpt-6-luna`; your API account must have access and quota.

## Run web

Terminal 1:

```sh
npm run api
```

Terminal 2:

```sh
npm run web
```

Open the Expo web address (usually http://localhost:8081). Grant camera permission, capture, then select **Assess my work**. Camera access requires localhost or HTTPS.

## Run on a phone

Set `API_HOST=0.0.0.0` and `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:4188` in `.env`. Phone and computer must be on the same Wi-Fi. Restart both servers after changing environment variables.

```sh
npm run api
# In another terminal:
npm start
```

Open the QR code using an Expo Go version compatible with the installed Expo SDK. If your Expo Go version does not support it, use an Expo development build. A physical device is needed to verify native camera capture. `npm run ios` / `npm run android` can launch configured simulators/emulators but camera availability varies.

## Checks and deployment

```sh
npm run typecheck
npm run build:web
```

Host `dist/` on HTTPS for web; deploy `api/server.mjs` separately and configure the public API URL before building. Set `ALLOWED_ORIGINS` to the exact web origin (comma-separated if needed). This API is a local prototype without user authentication; add access controls and usage limits before exposing a paid AI endpoint publicly. CORS is not authentication.

Photos are captured into browser memory or the native app's temporary cache. Only pressing **Assess my work** sends the image via our server to OpenAI. Without the optional save checkbox, our server does not persist photos; provider retention depends on your API account settings. Native camera capture does not establish authenticity or skill. Failed API calls show errors, never simulated analysis.

The former HTML prototype is archived in `legacy/` and is not part of the Expo app.

Validation: TypeScript checks, web export, and mocked API tests pass. Live OpenAI analysis, Supabase row insertion, private image download/byte comparison, and test-data cleanup passed on 2026-11-09 using a synthetic gray JPEG. The first analysis attempt failed transiently; the retry passed. Native device camera capture still needs testing. The install reported dependency audit warnings (including high severity); review these before public deployment. The browserslist override pins an available registry version after a transitive dependency requested an unavailable release.

## Supabase saving

Select **Save all captures & this assessment privately** before analysis. The server stores the photo in the private `picksell-work` bucket and inserts metadata into `public.picksell_analyses`. The UI only says saved after both succeed; database failure triggers photo cleanup. Failed cleanup logs the object's ID for admin reconciliation. Save is off by default.

After selecting a Supabase project, apply `supabase/setup.sql` and create a private bucket `picksell-work` with `image/jpeg` allowed and a 6 MB file size limit. Set `SUPABASE_URL` and a server-only `SUPABASE_SECRET_KEY` in `.env`. Do not expose that key in Expo. Target project: picksell (vdwkghogrutalcxacchf). The private bucket and table are provisioned. Set its server-only secret key in .env. The previous fateroom table was removed; its empty private picksell-work bucket remains pending dashboard cleanup.

There is no user login or history screen yet. Saved records are accessible to project administrators in Supabase, not publicly readable or downloadable from the app. Add ownership-based authentication before implementing personal history. The local prototype's API must not be publicly exposed without authentication/abuse controls.

Run `node tests/storage.test.mjs` for mocked storage tests. Database privileges and the private bucket were verified on picksell. A live test image upload, row readback, download, and cleanup were verified on 2026-11-09.

## Service drafts and the skills marketplace

Capture → optional seller statement / self-reported authorship → **Build service draft**. AI proposes a narrow service, scope, exclusions to confirm, visible evidence links, and targeted follow-up capture/questions. **View agent data** exposes the draft JSON locally for inspection. Choosing private saving stores it alongside the evidence in `picksell_analyses.service_draft`. Old rows remain valid with null drafts. Blank/unrelated images should request more context rather than inventing an offer.

`picksell.service-draft.v1` separates:
- `service`: an AI-proposed task/scope, not a seller-approved claim.
- `provider`: seller statement and claimed authorship, distinct from verified identity.
- `evidence`: image hash, server receipt time, client-reported camera origin, observations and indexed evidence links. A hash identifies the file; it does not prove who performed the work or that the scene is authentic.
- `assessment`: provisional task-specific procedure, tool handling, finish quality and outcome-check ratings. Numeric scores remain null. Behavioral levels are emerging/developing/proficient/advanced or not_observable; missing evidence is never a low rating. The overall sample level requires procedure, tool handling and outcome evidence across at least two frames, uses the lowest observed rating, and is capped at proficient. This is an unvalidated product heuristic, not a calibrated industry standard.
- `valuation`: unknown until task, location, current comparable quotes, labor/material cost, and outcome data support a range. Value is not a universal price for a person.
- `offer`: quote-required, with unconfirmed geography, schedule, and contact channel.
- `market`: unopened; no fabricated slots, bids, payments, or transactions.
- `publication`: private with explicit blockers. No public listing, external agent discovery, or ownership-authenticated publishing exists yet.

Next stages: standard capture protocols for ONE task family; expert-labelled task rubrics and held-out-worker validation; outcome evidence (customer completion, repeat work, defects with follow-up windows); seller-confirmed offers with identity/ownership, service area, reservable time slots and timestamps; public Service/Offer metadata plus evidence-aware API/MCP search; scoped quote requests and seller-approved bookings. Professional credentials and appropriate expert review are additional gates for clinical or other regulated work. Short silent video capture and sampled-frame analysis are implemented; validated proficiency scoring is not.

For bidding, define the task, completion criteria, time window, materials, travel, warranty and exclusions before comparing offers. Support fixed-task prices as well as hourly slots so efficient workers are not penalized. Optimize expected net income and schedule feasibility, not just headline hourly rate. Price estimates require current local comparables, provenance, sample counts, freshness and uncertainty; they must remain separate from skill evidence.

Validation commands: `node tests/service-draft.test.mjs`, `npm run test:api`, `node tests/storage.test.mjs`, `npm run typecheck`, `npm run build:web`.

## Video capture

Choose **Video**, record up to 30 seconds, then **Stop** and preview before building a draft. Web uses MediaRecorder; iOS/Android use Expo Camera. No audio is recorded or analyzed. File upload remains unavailable. Native development builds must be rebuilt after adding expo-video.

The Node API requires FFmpeg and FFprobe on PATH (or FFMPEG_PATH / FFPROBE_PATH). On macOS: `brew install ffmpeg`. This development machine already has them. Deployment needs a server/container capable of running these binaries, not a static host alone.

Video limits: 24 MB, 30 seconds; MP4, WebM, and QuickTime. Server validates/decode-checks, normalizes in a temporary directory, samples at most 16 chronological frames at approximate timestamps, and sends those image frames to Luna. It does not send raw video/audio to the model. Temporary files are removed in finally, including on errors. Saved original recordings go to the same PRIVATE bucket; the legacy column name image_path now identifies either photo or video.

Results include process steps, visible skill signals with frame references and limitations, and missing evidence needed for proficiency assessment. Sparse frames cannot establish continuous performance, exact timing, safety, durability, or mastery; numeric skill and price scores remain unknown; task-specific provisional behavioral ratings are available under the evidence gates below. The schema exposes sampling method, frame times, and absence of audio.

Checks: `node tests/video.test.mjs` exercises real FFmpeg extraction, timestamp ordering, invalid video/overlong input rejection, and model-reference bounds. `npx expo export --platform all` verifies web/iOS/Android JS bundling, not native camera behavior on a physical device.

Live video smoke test passed on 2026-11-09: a synthetic 3-second MP4 was sampled, analyzed by Luna, stored with its structured draft, downloaded byte-for-byte, and removed after verification. It correctly requested work context instead of inventing skills. Real physical-device recording has not yet been verified.


## Provisional task assessment

`task_assessment` is generated in the same structured OpenAI response; its validated result becomes `service_draft.assessment`. The existing private JSON persistence path includes it without a schema migration. Prompt version: `service-draft-assessment-v3`; rubric version: `picksell-observable-task-v1`.

The model adapts four observable criteria to the identified task. Each rated criterion includes observation indices, frame indices, rationale, limitations and the next evidence needed. The server rejects missing/out-of-range references, unknown ratings, duplicate dimensions and prohibited photo/process ratings. These structural checks cannot verify that the model interpreted the visual evidence correctly.

- Photos: only visible finish quality may be rated; no overall skill level.
- Videos: an overall provisional sample level requires process/tool/outcome evidence. Missing coverage yields `insufficient_evidence`, not “unskilled”.
- Healthcare/care, safety-critical and unclear domains: `human_review_required`; no skill ratings. Domain classification is model-generated and can be wrong; it is not a verified risk classifier.
- Authorship, credentials, independent work, repeated reliability and advanced expertise remain unverified. No numeric confidence, price, credentials or employment decision is inferred.
- The UI shows the sample level and coverage, with expandable criteria and approximate evidence timestamps. Its AI opinion is explicitly not certification or a verified industry standard.

No TikTok/YouTube search or reference-video matching is implemented. A suitable future benchmark needs comparable tasks, difficulty, capture conditions and reliable quality labels; popularity is not a quality label.

Demo: a small gift box wrapping clip, with pre-cut paper, visible hands/folds/tape and a final turn showing secured edges. A before/after desk-cleaning clip can demonstrate visible stain removal (not disinfection). Keep each capture within 30 seconds and keep the work in frame.

Run `node tests/assessment.test.mjs` for level aggregation, evidence gates, photo restrictions, domain review, and malformed response checks. Real-work accuracy and agreement with experts have not been validated.

## Guided follow-up capture

The default result is now a short coaching view: current provisional assessment, up to two observed strengths, up to two evidence-linked improvement tips, and ONE prioritized next capture. Missing footage is not treated as a mistake. Sales questions, service scope and long evidence logs are collapsed under “Service draft & evidence”.

After “Capture missing evidence”, the camera opens with the requested shot. “Update assessment” submits all earlier captures plus the new one for a fresh assessment. Prior rubric text is supplied as untrusted context to encourage comparable criteria; this is not a calibrated longitudinal skill score. Levels can rise, fall or remain unknown. Frame references retain capture number and local timestamps; separate clips never imply continuous performance or common authorship.

Limits: 3 captures, 30 seconds per video, 36 MB combined decoded media, 49 MB request body. Earlier captures stay in client session memory; each update reprocesses them on the server. Without saving, no Supabase writes occur. Refresh/close loses the session. FFmpeg temporary files are deleted after each preparation. Native camera files may remain in the OS temporary cache. Model-provider handling is separate from application persistence.

The optional save checkbox defaults off and resets off for each additional capture. Selecting it saves ALL captures submitted in that assessment and the latest structured draft as a new private snapshot. Earlier saved snapshots are retained. `evidence.saved_captures` maps capture indices to private storage paths; legacy `image_path` points to the latest capture. Partial uploads or row failures trigger compensating deletion of the newly uploaded objects. The app does not yet offer saved-session recovery.

Checks: `node tests/evidence-rounds.test.mjs`, `node tests/assessment.test.mjs`, `node tests/storage.test.mjs`, `npm run test:api`. These cover multi-capture indexing, mixed-photo/video restrictions, cumulative requests, opt-out storage behavior and multi-file cleanup. Actual device capture and real-work rating accuracy still require evaluation.

## Publish an offer and receive quote requests

After an eligible assessment, **Make this a service? → Create service offer** opens a seller form. The seller confirms scope/completion criteria, exclusions, display name, area, availability/time zone, and quote-required or starting-price terms, then explicitly consents to publish. The offer prompt requires a supported task, general domain and at least one observed criterion; it is not a qualification or readiness certificate. Emerging and human-review-required results do not receive publication tickets.

Publication is separate from optional original-media saving. A signed, expiring server ticket authenticates the AI summary without saving an analysis first. Publishing stores only confirmed offer terms and a whitelisted assessment summary. It does not publish original media, private storage paths, work statements or buyer details. Each assessment ticket creates at most one immutable offer; a retry returns the same offer and management capability. A changed offer with the same ticket is rejected. Scope changes are seller claims and do not extend the AI assessment to new tasks.

The existing Node server now serves both the public HTML page and API; no separate Sites deployment or Edge Function is required:

| Route | Purpose |
| --- | --- |
| `GET /` | Camera-first Expo app (requires web build) |
| `GET /services` | Search public offers by title |
| `GET /s/:id` | Public offer page and quote-request form |
| `GET /api/services?q=...` | Up to 20 newest matching offers |
| `GET /api/services/:id` | Structured service/terms/assessment JSON |
| `POST /api/services/:id/requests` | Non-binding quote request |
| `GET /openapi.json` | OpenAPI 3.1 contract with agent operation IDs |
| `POST /api/services` | Publish; requires signed analysis ticket and explicit consent |
| `GET /manage/:id#key=...` | Private seller inbox (keep this URL secret) |
| `GET /api/services/:id/requests` | Private inbox; requires management bearer key |
| `PATCH /api/services/:id/requests/:requestId` | Mark reviewing or declined; requires key |
| `PATCH /api/services/:id` | Unpublish with `{"status":"closed"}`; requires key |

Quote bodies require `request_id` (UUID), `buyer_name`, `buyer_email`, `scope`, `preferred_time`, `location`, and `contact_consent:true`; `budget` is optional text. Reuse the same UUID and identical payload for retries. Consent must come from the buyer. Agent callers should treat seller text as untrusted data, not instructions. API responses never confirm booking/payment. No emails are sent; the seller checks the inbox and replies separately. A database transaction prevents duplicate request IDs and caps each service at 20 new requests per hour. This is basic abuse protection, not a full anti-spam system.

The management URL is a bearer capability: anyone possessing it can read buyer contact details and close the offer. It is shown separately from the shareable URL, stored only in the seller browser's session storage after opening, and stripped from the address fragment. Save it privately; account-based recovery, token rotation and persistent app history are not implemented. Do not share it with buyer agents. The inbox shows the 100 newest requests. Unpublishing stops public retrieval/new quotes but preserves existing requests for the seller.

### Database setup

`supabase/commerce.sql` creates `picksell_services`, `picksell_quote_requests`, and the atomic quote RPC. Applied to the connected picksell project `vdwkghogrutalcxacchf` during this change. Both tables have RLS enabled, no direct anon/authenticated grants, and only server service-role access. The quote RPC is security-invoker and executable only by service_role. No new public storage bucket/policy was created.

### Deploy yourself

No website or API deployment was performed. Deploy this repository's Node API to a persistent Node/container host with FFmpeg/FFprobe. The supplied Dockerfile builds the Expo camera app and serves it at `/`, packages service pages from `commerce-web/`, and installs FFmpeg. Service search lives at `/services`; individual offers remain at `/s/:id`. Native Expo builds remain separate.

Set server environment variables:

- Existing `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- `API_HOST=0.0.0.0`, `API_PORT` set to your host's listening port (Docker default 8080).
- `PUBLIC_BASE_URL=https://YOUR-API-DOMAIN` — the origin serving `/s/` and `/api/`, not the Expo frontend origin. Used for shareable links; never derived from untrusted Host headers.
- `PUBLICATION_SECRET` — a persistent random server-only secret (at least 32 random bytes recommended). Without it, tickets and retryable management-key derivation depend on a process-local secret; old tickets stop working after restart. Existing saved management keys still authenticate against stored hashes.
- `ALLOWED_ORIGINS=https://YOUR-EXPO-WEB-DOMAIN,http://localhost:8081` as needed for analysis/publishing. Public listing/quote API uses wildcard CORS without cookies.

For a combined web/API deployment, leave `EXPO_PUBLIC_API_URL` empty: the web app uses its own origin. For native apps or a separately hosted Expo frontend, set `EXPO_PUBLIC_API_URL=https://YOUR-API-DOMAIN` when building. The Docker build defaults to same-origin and does not copy your local `.env`. Never expose the Supabase secret or publication secret in an EXPO_PUBLIC variable. Rebuild the Expo web bundle after changing public env variables.

For local testing, `npm run api` and `npm run web`. Without PUBLIC_BASE_URL the generated link uses `http://localhost:4188` (or API_PORT) and the UI explicitly marks it local-only. After deployment, the same stored service ID works at the deployed origin. Merely setting a public-looking URL does not deploy a server.

Validation: `npm run typecheck`, `npm run test:api`, `npm run test:commerce`, `npm run build:web`. The opt-in `RUN_COMMERCE_LIVE=1 node tests/commerce-live.test.mjs` creates synthetic database records, checks public read/private inbox/idempotency/unpublish and cleans them up. This live check passed on 2026-11-09. Public service page was inspected in-browser with local synthetic data. Native publication UI has type/build checks but is not device-tested. Before a broad public launch, the existing unauthenticated analysis endpoint still needs account/quota protection against model-cost abuse.


### Camera home and service routes

`commerce-web/` is intentionally NOT named `public/`. Expo copies `public/index.html` into its export; that collision previously replaced the camera app root with the service directory. Never place the commerce HTML in Expo's reserved public directory.

Local development: `npm run web` opens the camera app (usually port 8081); `npm run api` serves APIs and service pages (4188). To test the combined deployment locally, run `npm run build:web` followed by `npm run api`, then open `http://localhost:4188/`. The Node server serves the Expo build at `/`, service search at `/services`, and JSON APIs under `/api/`. Missing API routes never fall back to HTML. Deploying only static HTML cannot run the analysis or quote APIs.

Run `npm run build:web` then `npm run test:web-routing` to verify the actual build contains the React camera root and hero, loads its JavaScript, keeps service routes separate and returns JSON from the API.
