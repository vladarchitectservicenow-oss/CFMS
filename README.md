# Catalog Field Mapping Scanner (CFMS)

**Detect deprecated legacy catalog variables before they break your Australia upgrade.**

Author: Vladimir Kapustin  
License: AGPL-3.0-only  
Compatibility: ServiceNow Zurich (2025) → Australia (2026)

---

## What is CFMS?

Australia removes legacy catalog variable types:
- `macro`
- `break`
- `container_start / container_end`
- `select_box` (legacy variant)

CFMS scans all catalog items and order guides, flags deprecated variables, and estimates remediation effort.

## Modules

| Module | File | Purpose |
|--------|------|---------|
| Scanner | `CFMSScanner.js` | Detects legacy variables and missing mandatory fields |
| Score Engine | `CFMSEngine.js` | Calculates risk score, severity, estimated hours |

## Test Results

```
Tests: 5/5 PASS
```

## Usage

Background Script:
```javascript
var s = new CFMSScanner();
var r = s.runFullScan();
gs.info(r.legacyItems + " / " + r.totalItems + " items have legacy variables");
```

## GitHub

https://github.com/vladarchitectservicenow-oss/CFMS

---
Vladimir Kapustin · vladarchitectservicenow-oss · AGPL-3.0-only
