# Stitch Forge MD-2.54 — long-running native job delivery

31 October 2026. Source: two real mobile kingfisher failures on 30 October at 19:47 and 19:48 UTC.

## Confirmed failure
- Netlify edge records show POST /api/artwork-embroidery returned 504 after 30.3 and 33.3 seconds.
- Google Cloud logs shown by the owner show Cloud Run HTTP 200 after approximately 41 and 34 seconds.
- The original artwork was accepted; a paid AI feature analysis completed successfully.
- Browser waiting on two sequential synchronous Netlify-to-Cloud-Run phases is not a reliable delivery architecture.

## MD-2.54 design
- The user still sees exactly: Upload image → Generate embroidery → Stitch video → Download ZIP.
- Prepared bounded source packet is sent once to the authenticated /api/artwork-job-submit endpoint. No new OpenAI call in any background function.
- Netlify Blobs site-wide private store saves the bounded original analysis pixels and labels (not the uploaded full-resolution image), assigned to a random UUID. The store has strong consistency.
- A server-side signed invocation passes only the job UUID and short MAC to /api/artwork-job-work. The Netlify Background Function runs a complete two-phase native PES6 + DST transaction, including at most one bounded audit repair cycle; effective limit 15 minutes.
- The background function reuses the existing protected Cloud Run bridge and its trust, geometry, source and ZIP checks, with a longer upstream deadline only for the background invocation.
- An atomic create-only job lock prevents duplicate processing of one job.
- Private authenticated status and result endpoints allow browser polling and a quick audited ZIP download. The source packet is deleted after processing and results/receipts expire from access after 8 hours; a scheduled cleanup deletes old blobs daily.
- Browser independently verifies the downloaded ZIP checksum, native PES and SVG hashes against the signed phase receipt, source/dimension binding, decoded stitch counts and containment before it shows decoded stitch playback or enables download.
- Legacy synchronous bridge preserved for older isolated tests, but the main UI now uses background mode by default.
- Existing device-saved Stitch Forge owner token is unchanged. No API keys are saved or returned. No Cloud Run traffic shift.
- New dependency pinned: @netlify/blobs 11.1.7 (MIT). Note that background execution and Blob storage may incur normal Netlify usage charges; no new subscription is required on supported credit-based plans.

## Testing and release gates
- GitHub isolated branch test run: https://github.com/sapiverpress-studio/Stitch-Forge/actions/runs/41175740805 (success).
- Job-level mocked tests cover unauthorised submission/status/result, packet schema, signed dispatch, complete two-phase processing, receipt/output integrity, duplicate suppression and native failures fail-closed.
- Existing source-packet and one-button workflow tests also passed in the GitHub runner.
- The tests are NOT a live Netlify Blobs/Cloud Run handshake and do not prove the kingfisher's resulting embroidery is recognisable or safe for physical sew-out.
- After deployment, test a source-based native run with AI disabled (avoid new paid OpenAI call) and verify 202 submission → status queued/running/done → real native ZIP, decoded stitches and no request-level 504. Independently review detailed likeness and then physical sew-out.

## Security and operations
- The job store is private. Browser receives only an opaque job ID; background dispatch is authenticated by a server-side HMAC using an existing private worker secret.
- Result/status endpoints require the existing owner token; no anonymous download URL.
- Never log the owner token, worker token, source pixel payload or underlying OpenAI key.
- Non-completing or crashed tasks do not automatically re-run native work; terminal errors and expiry fail closed. Netlify background retries do not duplicate work because of the create-only lock.
- Scheduled cleanup caps each invocation at 200 job records. The site-wide Blob store is shared between deploys; never run a production-destructive cleanup from an untrusted preview.
- Preserve old synchronous bridge and Cloud Run image for rollback; reverting the front-end background flag and new job endpoints restores prior behaviour, though it may reintroduce the 30-second timeout.
