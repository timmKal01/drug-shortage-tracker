import { Actor, log } from 'apify';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { genericName, status, maxResults = 25 } = input;

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const SHORTAGE_SEARCH_EVENT = 'shortage-search';

const API_URL = 'https://api.fda.gov/drug/shortages.json';

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 15_000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let res;
        try {
            res = await fetch(url, { signal: controller.signal });
        } catch (err) {
            lastError = err.name === 'AbortError' ? new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms: ${url}`) : err;
            if (attempt < MAX_ATTEMPTS) {
                await sleep(1000 * 2 ** (attempt - 1));
                continue;
            }
            throw lastError;
        } finally {
            clearTimeout(timeoutId);
        }
        if (res.status === 404) return res;
        if (res.ok) return res;
        if (!TRANSIENT_STATUSES.has(res.status)) {
            throw new Error(`openFDA request failed: ${res.status} ${res.statusText}`);
        }
        lastError = new Error(`openFDA request failed: ${res.status} ${res.statusText}`);
        if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
    }
    throw lastError;
}

// openFDA's search query param doesn't reliably support partial/wildcard matches on this
// endpoint (verified live: exact phrase search works, trailing/leading wildcards return
// "No matches found" even for terms known to exist). Filtering generic name client-side
// against a large, recency-sorted batch is more reliable than depending on that.
const params = new URLSearchParams({
    limit: '1000',
    sort: 'initial_posting_date:desc',
});
if (status) params.set('search', `status:"${status}"`);

log.info('Fetching drug shortages from openFDA', { genericName: genericName || '(any)', status: status || '(any)' });

const res = await fetchWithRetry(`${API_URL}?${params.toString()}`);

let results = [];
let totalAvailable = null;

if (res.status === 404) {
    log.info('No shortages matched the status filter.');
} else {
    const data = await res.json();
    results = data.results ?? [];
    totalAvailable = data.meta?.results?.total ?? null;

    if (genericName) {
        const needle = genericName.toLowerCase();
        results = results.filter((r) => (r.generic_name ?? '').toLowerCase().includes(needle));
    }

    results = results.slice(0, Math.min(maxResults, 500));

    for (const r of results) {
        await Actor.pushData({
            genericName: r.generic_name ?? null,
            brandNames: r.openfda?.brand_name ?? [],
            manufacturer: r.company_name ?? null,
            status: r.status ?? null,
            dosageForm: r.dosage_form ?? null,
            presentation: r.presentation ?? null,
            therapeuticCategory: r.therapeutic_category ?? [],
            reason: r.related_info ?? null,
            contactInfo: r.contact_info ?? null,
            initialPostingDate: r.initial_posting_date ?? null,
            updateDate: r.update_date ?? null,
            discontinuedDate: r.discontinued_date ?? null,
            route: r.openfda?.route ?? [],
            ndc: r.package_ndc ?? null,
        });
    }
}

await Actor.charge({ eventName: SHORTAGE_SEARCH_EVENT });

log.info(`Found ${results.length} shortage record(s)`, { totalAvailable });

await Actor.exit();
