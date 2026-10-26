/**
 * POST /api/index.php — the legacy endpoint's literal PHP path.
 * Existing clients (and upstream's test/api.bats) post here; the
 * Next panel serves the same dispatcher as /api (see ../route.ts).
 */
export { POST } from "../route";
