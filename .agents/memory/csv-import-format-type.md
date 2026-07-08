---
name: CSV import format type
description: Trade CSV import format union type location and gotcha for functions that accept it
---

The trade CSV import format type (`"mt4" | "mt5" | "csv" | "exness" | "unknown"`) is defined as `CsvFormat` in `artifacts/api-server/src/lib/csv-parser.ts`.

**Why:** Any new helper function that takes the parsed format as a parameter must import and use `CsvFormat` directly rather than re-declaring an inline narrower union (e.g. omitting `"exness"`) — the parser can emit `"exness"` and a narrower inline type will fail `tsc` at the call site.

**How to apply:** When adding functions in `trades.ts` (or similar import-handling code) that accept the detected CSV format, always type the parameter as `CsvFormat` imported from `../lib/csv-parser`.
