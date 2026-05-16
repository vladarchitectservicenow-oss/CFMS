# ServiceNow Catalog Field Mapping Scanner (CFMS)

**Pre-upgrade catalog variable audit. Detects deprecated legacy variable types before Australia breaks them.**

| | |
|:---|:---|
| **Scope** | `x_cfms` |
| **PID** | CFMS |
| **Author** | Vladimir Kapustin |
| **License** | MIT |
| **Compatibility** | ServiceNow Utah and later (pre-Australia upgrade scanning) |
| **Repository** | [github.com/vladarchitectservicenow-oss/CFMS](https://github.com/vladarchitectservicenow-oss/CFMS) |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Security & Compliance](#security--compliance)
9. [Release Notes](#release-notes)
10. [Contributing](#contributing)
11. [Support](#support)

---

## Executive Summary

The **ServiceNow Catalog Field Mapping Scanner (CFMS)** is a scoped application designed to eliminate the single most expensive hidden risk in Australia release upgrades: legacy catalog variable types. When ServiceNow shipped the Australia release, it silently deprecated and removed several variable types that had been in use since the Jakarta and Kingston eras — including `macro`, `lookup_select_box`, `list_collector`, and container markers such as `container_start` and `container_end`. The platform no longer renders these variables at runtime, which means any catalog item that still relies on them will appear broken to end users immediately after upgrade.

Post-upgrade discovery is catastrophically expensive. Organizations with 500+ catalog items routinely face 2–3 week manual audits, emergency rollback windows, and SLA penalties because the deprecated variables were only noticed during UAT or, worse, in production. CFMS solves this by providing a deterministic, repeatable scan engine that runs *before* the upgrade and produces a ranked remediation report with per-item severity scores and estimated effort.

CFMS ships as a single scoped application (`x_cfms`) with three server-side modules — **Scanner**, **Engine**, and **Report Renderer** — plus a self-contained Node.js test harness for continuous integration.

---

## Architecture

### Design Principles

1. **Deterministic Scanning** — Every catalog item receives the same evaluation logic regardless of category, ownership, or age. No heuristic guessing; every deprecated type is mapped to an explicit allow-list.
2. **Zero Client-Side Footprint** — All logic runs in server-side Business Rules or Background Scripts. There are no UI Policies, no Client Scripts, and no dependencies on AngularJS or Service Portal components.
3. **Ranked Output** — Raw counts of deprecated variables are meaningless to project managers. CFMS converts raw findings into a 0–100 risk score, severity tier (critical / high / medium / low), and estimated remediation hours so that sprints can be prioritized by business impact.
4. **Extensibility** — New deprecated types can be added to the scanner by updating a single array constant. The scoring engine weights are exposed as prototype properties for per-organization tuning.

### Module Overview

| Module | File | Responsibility |
|:---|:---|:---|
| **Scanner** | `src/CFMSScanner.js` | Iterates `sc_cat_item` → `item_option_new`, detects deprecated types and missing mandatory fields, scans `sc_cat_item_guide` for deprecated wizards. |
| **Engine** | `src/CFMSEngine.js` | Converts raw findings into normalized risk scores, severity tiers, and hour estimates. Ranks items by urgency. |
| **Report Renderer** | `src/CFMSReportRenderer.js` | Generates enterprise-ready HTML and CSV reports from scan results. |
| **Application Metadata** | `src/sys_app.xml` | Scoped application definition for ServiceNow Studio import. |

### Data Flow

```
Background Script or Scheduled Job
         |
         v
   CFMSScanner.runFullScan()
         |
         +---> GlideRecord(sc_cat_item)
         |            |
         |            +---> item_option_new (per item)
         |            |
         |            +---> Missing mandatory field detection
         |
         +---> GlideRecord(sc_cat_item_guide)
                  |
                  +---> Deprecated wizard detection
         |
         v
   Raw findings Array {item_sys_id, item_name, findings[]}
         |
         v
   CFMSEngine.rankItems(findings)
         |
         +---> calculateItemScore() per item
         +---> Sort ascending by score (worst first)
         |
         v
   CFMSReportRenderer.renderHTML() or renderCSV()
         |
         v
   Attachment on sys_attachment / Email / REST export
```

### Deprecated Type Registry

The scanner maintains an explicit allow-list of types that Australia removes. Do not modify this list unless your organization has received explicit guidance from ServiceNow Support.

| Type | Severity | Business Impact |
|:---|:---|:---|
| `reference` | HIGH | Legacy reference lookups break; migrate to GlideAjax or standard Reference fields |
| `lookup_select_box` | HIGH | Deprecated in Utah, fully removed in Australia |
| `list_collector` | HIGH | Must migrate to Multi-Row Variable Sets or List fields |
| `macro` | HIGH | UI Macros no longer render; migrate to UI Builder components |
| `macroponent` | HIGH | Proprietary macro wrapper removed |
| `masked` | MEDIUM | Data mask behavior changes; verify encryption posture post-upgrade |
| `break` | LOW | Visual separator only; no functional impact but may clutter layout |
| `container_start` / `container_end` | MEDIUM | Container pairing must be validated or forms collapse |
| `formatter` | HIGH | UI Formatters removed; migrate to UI Builder |

---

## Installation

### Prerequisites

- ServiceNow instance with **Studio** enabled
- `admin` or `sn_app_creator` role
- Familiarity with Update Sets or direct XML import

### Method A — Import via Studio (Recommended)

1. Navigate to **System Applications > Studio**.
2. Click **Import from Source Control** or **Import from XML**.
3. If using XML, upload `src/sys_app.xml` and all supporting files (`CFMSScanner.js`, `CFMSEngine.js`, `CFMSReportRenderer.js`) into the scoped application.
4. Studio will resolve dependencies automatically. There are no external dependencies.
5. Publish the application to the local app repository.

### Method B — Background Script Bootstrap (Emergency)

If you need to run CFMS *today* and cannot wait for a full Studio import cycle, copy the contents of `src/CFMSScanner.js`, `src/CFMSEngine.js`, and `src/CFMSReportRenderer.js` into three separate Background Scripts and execute them in order. The classes will register in the global scope for the duration of the session. Note that this is not persistent across node restarts and should only be used for ad-hoc audits.

### Method C — Node.js CI Harness (For Test / Validation)

```bash
git clone https://github.com/vladarchitectservicenow-oss/CFMS.git
cd CFMS
node tests/test_cfms_scanner.js
```

The Node.js harness uses a self-contained mock of `GlideRecord`, `Class.create`, and `GlideDateTime` so that every logic path can be validated without a live instance.

---

## Configuration

### Tuning Severity Weights

Open `src/CFMSEngine.js` and adjust the prototype weights:

```javascript
this.SEVERITY_WEIGHT = { CRITICAL: 8, HIGH: 5, MEDIUM: 2, LOW: 0.5 };
```

- Increase `CRITICAL` if your risk posture requires immediate remediation of `reference` or `macro` types.
- Decrease `LOW` if visual breaks are accepted as cosmetic and should not inflate the score.

### Mandatory Field Validation

`CFMSScanner.prototype.MANDATORY_FIELDS` defaults to `['name', 'question_text', 'type', 'cat_item']`. Australia enforces stricter non-null checks on these fields than previous releases. Add additional fields if your organization has custom mandatory policies.

### Scheduled Scan (Optional)

Create a **Scheduled Job** with the following script to run CFMS weekly:

```javascript
var scanner = new CFMSScanner();
var result = scanner.runFullScan();
var engine = new CFMSEngine();
var ranked = engine.rankItems(result.catalogFindings);
var renderer = new CFMSReportRenderer();
var html = renderer.renderHTML({
    catalogFindings: ranked,
    orderGuideFindings: result.orderGuideFindings,
    totalItems: result.totalItems,
    legacyItems: result.legacyItems,
    scanDate: result.scanDate
});
// Attach HTML to a record or email it
gs.info('CFMS scheduled scan complete. Legacy items: ' + result.legacyItems);
```

---

## Usage

### Single Catalog Item Audit

```javascript
var scanner = new CFMSScanner();
var gr = new GlideRecord('sc_cat_item');
gr.addQuery('sys_id', 'YOUR_SYS_ID_HERE');
gr.query();
if (gr.next()) {
    var result = scanner.scanCatalogItem(gr);
    gs.info(JSON.stringify(result, null, 2));
}
```

### Full Catalog Batch Audit

```javascript
var scanner = new CFMSScanner();
var batch = scanner.scanCatalogBatch(); // optional SysID for category filter
for (var i = 0; i < batch.results.length; i++) {
    var item = batch.results[i];
    if (item.status === 'deprecated_found') {
        gs.warn('DEPRECATED: ' + item.name + ' has ' + item.deprecatedVariables.length + ' legacy variables');
    }
}
```

### Full Scan with Risk Ranking and HTML Report

```javascript
var scanner = new CFMSScanner();
var engine = new CFMSEngine();
var renderer = new CFMSReportRenderer();

var raw = scanner.runFullScan();
var ranked = engine.rankItems(raw.catalogFindings);

var reportPayload = {
    catalogFindings: ranked,
    orderGuideFindings: raw.orderGuideFindings,
    totalItems: raw.totalItems,
    legacyItems: raw.legacyItems,
    scanDate: raw.scanDate
};

var htmlReport = renderer.renderHTML(reportPayload);
var csvReport = renderer.renderCSV(reportPayload);

// Example: create a sys_attachment on the current user record
// (Omitting GlideSysAttachment boilerplate for brevity)

gs.info('CFMS report generated. Items: ' + raw.totalItems + ', Legacy: ' + raw.legacyItems);
```

---

## API Reference

### `CFMSScanner`

#### `initialize()`
Sets up the scanner with default deprecated type registry and mandatory field list.

#### `runFullScan() → Object`
Iterates all active catalog items and order guides. Returns structured object with counts and nested findings.

| Property | Type | Description |
|:---|:---|:---|
| `totalItems` | Number | Count of `sc_cat_item` records scanned |
| `legacyItems` | Number | Count of items with findings > 0 |
| `catalogFindings` | Array | Per-item findings array |
| `orderGuideFindings` | Array | Per-guide deprecated wizard findings |
| `scanDate` | String | ISO timestamp of scan |

#### `scanCatalogItem(catalogItemGR) → Object`
Scans a single `sc_cat_item` GlideRecord.

| Property | Type | Description |
|:---|:---|:---|
| `sys_id` | String | Catalog item sys_id |
| `name` | String | Item name |
| `category` | String | Category reference |
| `deprecatedVariables` | Array | Full metadata for each deprecated variable |
| `findings` | Array | Unified findings (legacy + missing mandatory) |
| `status` | String | `ok`, `deprecated_found`, or `error` |

#### `scanCatalogBatch(categorySysID) → Object`
Batch wrapper around `scanCatalogItem`. Optionally filter by category.

#### `exportJSON(result) → String`
Convenience method for `JSON.stringify(result, null, 2)`.

### `CFMSEngine`

#### `calculateItemScore(itemFindings) → Object`
Given an array of findings for one catalog item, returns:

| Property | Description |
|:---|:---|
| `score` | 0–100 (100 is perfect, 0 is catastrophic) |
| `severity` | `critical`, `high`, `medium`, `low` |
| `hours` | Estimated remediation hours (ceil) |
| `totalFindings` | Raw count |

#### `rankItems(allFindings) → Array`
Sorts all catalog items by score ascending (worst first). Each element is enriched with `score`, `severity`, `est_hours`.

### `CFMSSReportRenderer`

#### `renderHTML(scanResult) → String`
Generates a self-contained HTML document with styled tables, severity color-coding, and executive summary.

#### `renderCSV(scanResult) → String`
Generates RFC-4180 compatible CSV with escaped fields.

---

## Troubleshooting

### Scanner returns `totalItems: 0`

- Verify the Background Script user has `catalog_admin`, `admin`, or `x_cfms.admin` role.
- Check that `sc_cat_item` ACLs do not restrict read access for the running user.
- If running in a sub-production instance, confirm that catalog demo data has not been purged.

### `MISSING_MANDATORY_FIELD` floods the report

- Review `MANDATORY_FIELDS`. If `question_text` is frequently blank in your environment because you rely on `name` alone, remove `question_text` from the array or bulk-update the data.
- Use list editing to back-fill empty `question_text` values before upgrade.

### Score seems inflated / deflated

- Adjust `SEVERITY_WEIGHT` in `CFMSEngine` to match your organization's risk tolerance.
- Remember that the formula `score = max(0, 100 - raw * 8)` means that 13 critical findings will cap at 0. Tune the multiplier (currently 8) if your typical catalog items have >20 variables.

### HTML report is too large to email

- The HTML renderer does not paginate. For environments with >500 items, consider emitting CSV instead, or splitting the batch by category.
- Use `scanCatalogBatch(categorySysID)` and generate one report per category.

### Order guide scan throws exception

- `sc_cat_item_guide` may not exist on very old instances (pre-Geneva). The scanner wraps this block in `try/catch`; you can ignore the error, or comment out `_scanOrderGuides` if your instance predates order guides.

---

## Security & Compliance

- **No data egress** — CFMS does not call external endpoints, web services, or REST APIs. All processing stays inside your instance boundary.
- **Read-only scanning** — The scanner does not modify catalog items, variables, or order guides. It is safe to run in production during business hours.
- **Scoped isolation** — All code runs inside `x_cfms` and respects ServiceNow's scoped application sandbox. Cross-scope table access follows standard GlideRecord ACL enforcement.
- **Logging** — Scan results are emitted via `gs.info` / `gs.warn` / `gs.error`. Ensure your instance's system log retention policy captures these for audit trails.

---

## Release Notes

### v1.0.0 — May 2026
- Initial release
- Full scanner, engine, and renderer
- Node.js self-contained test harness
- HTML + CSV report generation
- Deprecated type registry aligned with Australia release notes

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Add tests to `tests/test_cfms_scanner.js`.
4. Ensure `node tests/test_cfms_scanner.js` passes.
5. Submit a pull request to `main`.

---

## Support

- **Issues**: [github.com/vladarchitectservicenow-oss/CFMS/issues](https://github.com/vladarchitectservicenow-oss/CFMS/issues)
- **Discussions**: Use GitHub Discussions for architecture questions.
- **Direct**: Open a ticket via your ServiceNow support channel if you need a guided implementation.

---

Copyright (c) 2026 Vladimir Kapustin. Licensed under the MIT License.
