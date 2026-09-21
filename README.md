# Drug Shortage Tracker: Live openFDA Shortage Data

```json
{
  "genericName": "Sodium Chloride",
  "brandNames": ["SODIUM CHLORIDE"],
  "manufacturer": "Hospira, Inc., a Pfizer Company",
  "status": "To Be Discontinued",
  "dosageForm": "Injection",
  "presentation": "Sodium Chloride 0.9%, Injection, 50 mL ADD-Vantage Flexible Container (NDC 0409-7101-66)",
  "therapeuticCategory": ["Gastroenterology", "Other", "Renal"],
  "reason": "Discontinuation of the manufacture of the drug",
  "contactInfo": "844-646-4398",
  "initialPostingDate": "12/03/2025",
  "updateDate": "12/03/2025",
  "discontinuedDate": "12/03/2025",
  "route": ["INTRAVENOUS"],
  "ndc": "0409-7101-66"
}
```

That's a real record. Give it a generic drug name and/or status, get back current and recent US drug shortages straight from the FDA's own shortage database, most recently posted first.

## Who this is for

- **Hospital and retail pharmacy supply chain teams** checking weekly which drugs on their formulary are affected before they run out.
- **Healthcare procurement and purchasing teams** screening a drug before committing to a supplier or contract.
- **Clinical and regulatory affairs teams** monitoring a therapeutic category for emerging shortages.

## Input

| Field | Type | Description |
|---|---|---|
| `genericName` | string | Filter to shortages matching this generic drug name (partial match, case-insensitive). Leave blank for all current shortages. |
| `status` | string | One of `Current`, `To Be Discontinued`, `Resolved`. Leave blank for all statuses. |
| `maxResults` | integer (default `25`) | Cap on records returned, most recently posted first. |

```json
{
  "genericName": "amoxicillin",
  "status": "Current",
  "maxResults": 25
}
```

## Output

One record per shortage entry, fields as shown above: generic name, brand names, manufacturer, status, dosage form, full presentation text, therapeutic category, the FDA-stated reason, a manufacturer contact number, the relevant dates, route of administration, and package NDC code.

## How it works

Direct calls to the FDA's official openFDA drug shortages endpoint (`api.fda.gov/drug/shortages`), no scraping, no key, no proxy. Results are sorted by most recent posting date and status-filtered server-side; the generic name filter is applied client-side against a larger recency-sorted batch, since openFDA's own search syntax on this endpoint only reliably supports exact-phrase matching, not partial or wildcard terms (verified directly against the live API, not assumed from docs).

Retries with exponential backoff on transient failures (rate limits, 5xx errors), the same defensive fetch pattern used across every actor in this portfolio, so a single upstream hiccup doesn't fail your run.

## Pricing note

Billed per **search**, not per shortage record returned, one charge whether the search returns 1 record or several hundred.

## Related products

- [Medical Device Adverse Event Tracker](https://github.com/timmKal01/medical-device-adverse-event-tracker): a different openFDA dataset (device adverse events, not shortages)
- [Product Recall Alert](https://github.com/timmKal01/product-recall-alert): FDA drug, food, and device recalls, a related but distinct signal from shortages
