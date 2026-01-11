# Ticket Statistics Dashboard

Static HTML dashboard (`index.html`) for querying ticket/chat statistics by company and date range.

## Run locally

Any static file server works. For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Backend endpoint

The page sends a `POST` request to the hidden `#endpoint` value (default: `/tickets`) with JSON:

```json
{
  "insCompanyId": "0x...",
  "fromDate": "dd/mm/yyyy",
  "toDate": "dd/mm/yyyy"
}
```

If **כל החברות** is selected, the page will call the endpoint once per company and sum `{ bot, whatsapp, phone }` fields across responses.

