# Test Suite SOP — CFMS (Catalog Field Mapping Scanner)

**Author:** Vladimir Kapustin | **License:** AGPL-3.0-only | **Scope:** x_cfms | **Version:** 1.0.0

## Overview

This SOP defines the complete test suite for the CFMS scoped application. All tests run in a self-contained Node.js harness using mocked ServiceNow runtime (MockGR, MockGS, GlideDateTime mock). No live PDI instance required for validation.

**Execution command:**
```bash
node tests/test_cfms_scanner.js
```

**Pass threshold:** 10/10 PASS minimum. All P0 tests must pass before any commit.

---

## Test Scenarios (12 total)

### P0 — Core Scanner Functionality (Must Pass)

#### TS-01: test_scanner_detects_deprecated_variables
**Purpose:** Verify the scanner correctly identifies legacy variable types defined in the deprecated registry.

**Input:** Mock database with 3 catalog items, each having at least one deprecated variable (`macro`, `break`, `container_start`).

**Expected:**
- `totalItems` = 3
- `legacyItems` ≥ 2
- At least one finding per item with `type === "LEGACY_VARIABLE"`
- Finding includes `legacy_type`, `severity`, `type_description` fields

**Assertions:**
```javascript
assert.strictEqual(result.totalItems, 3);
assert(result.legacyItems >= 2);
assert(findings.some(f => f.type === "LEGACY_VARIABLE"));
assert(finding.legacy_type !== undefined);
assert(finding.severity !== undefined);
assert(finding.type_description !== undefined);
```

**Status:** PASS ✅ (test exists in suite)

---

#### TS-02: test_scanner_handles_invalid_record
**Purpose:** Verify graceful handling when `scanCatalogItem()` receives a non-existent record.

**Input:** Create a GlideRecord for a catalog item not in the mock database.

**Expected:**
- `status === "error"`
- `errorMessage` contains descriptive text
- No exception thrown

**Assertions:**
```javascript
assert.strictEqual(result.status, "error");
assert(result.errorMessage.length > 0);
```

**Status:** TO BE ADDED

---

#### TS-03: test_scanner_finds_order_guide_wizards
**Purpose:** Verify deprecated wizard detection in `sc_cat_item_guide` table.

**Input:** Mock database with one order guide having a wizard field, one without.

**Expected:**
- `orderGuideFindings.length` = 1
- Finding severity = "MEDIUM"
- Finding type = "DEPRECATED_ORDER_GUIDE_WIZARD"
- Guide name matches the input

**Assertions:**
```javascript
assert.strictEqual(result.orderGuideFindings.length, 1);
assert.strictEqual(result.orderGuideFindings[0].guide, "Onboarding Guide");
assert.strictEqual(result.orderGuideFindings[0].severity, "MEDIUM");
```

**Status:** PASS ✅ (test exists in suite)

---

#### TS-04: test_scanner_handles_empty_order_guides
**Purpose:** Verify graceful handling when `sc_cat_item_guide` table is empty or missing.

**Input:** Mock database with empty `sc_cat_item_guide` array.

**Expected:**
- No exception thrown
- `orderGuideFindings` = `[]`

**Assertions:**
```javascript
assert.strictEqual(result.orderGuideFindings.length, 0);
```

**Status:** TO BE ADDED

---

### P1 — Engine Scoring & Ranking (Should Pass)

#### TS-05: test_engine_calculates_item_score
**Purpose:** Verify the scoring engine produces normalized 0–100 scores with severity tiers.

**Input:** Scan result for item3 (2 deprecated variables: macro + container_start).

**Expected:**
- `score` between 0 and 100
- `severity` is not "low" (2 findings → medium or higher)
- `hours > 0` (estimated remediation effort)
- `totalFindings == 2`

**Assertions:**
```javascript
assert(score.score >= 0 && score.score <= 100);
assert(score.severity !== "low");
assert(score.hours > 0);
assert.strictEqual(score.totalFindings, 2);
```

**Status:** PASS ✅ (test exists in suite)

---

#### TS-06: test_engine_ranks_items_worst_first
**Purpose:** Verify descending priority ordering — worst (lowest score) items appear first.

**Input:** Full scan result with three items of varying severity.

**Expected:**
- Ranked array length matches input
- `ranked[0].score <= ranked[last].score` (ascending = worst first)
- All items enriched with `score`, `severity`, `est_hours`

**Assertions:**
```javascript
assert.strictEqual(ranked.length, catalogFindings.length);
assert(ranked[0].score <= ranked[ranked.length-1].score);
assert(typeof ranked[0].score === "number");
assert(typeof ranked[0].severity === "string");
assert(typeof ranked[0].est_hours === "number");
```

**Status:** PASS ✅ (test exists in suite)

---

#### TS-07: test_engine_score_zero_on_catastrophic_item
**Purpose:** Verify that an item with many critical findings scores 0 (floor).

**Input:** Mock item with 14+ CRITICAL-severity findings (raw > 12.5).

**Expected:**
- `score === 0` (formula: max(0, 100 - raw * 8))
- `severity === "critical"`

**Assertions:**
```javascript
assert.strictEqual(score.score, 0);
assert.strictEqual(score.severity, "critical");
```

**Status:** TO BE ADDED

---

### P2 — Reports & Edge Cases (Good to Pass)

#### TS-08: test_report_renderer_html_structure
**Purpose:** Verify HTML report contains required structural elements.

**Input:** Scan result from a full scan with at least one finding.

**Expected:**
- Contains `<html>`, `<head>`, `<body>` tags
- Contains `<table>` with headers
- Contains severity CSS classes
- Contains scan metadata (date, totals)

**Assertions:**
```javascript
assert(html.includes("<html>"));
assert(html.includes("<head>"));
assert(html.includes("<table>"));
assert(html.includes("severity-"));
assert(html.includes("Scan Date"));
```

**Status:** TO BE ADDED

---

#### TS-09: test_report_renderer_csv_structure
**Purpose:** Verify CSV report follows RFC-4180 conventions.

**Input:** Scan result from a full scan with at least one finding.

**Expected:**
- Starts with "CFMS Audit Report" header line
- Contains "Scan Date" metadata row
- Contains column headers row
- Data rows have correct number of columns (6)
- Quoted fields contain escaped double-quotes

**Assertions:**
```javascript
const lines = csv.trim().split('\n');
assert(lines[0].startsWith("CFMS Audit Report"));
const headerRow = lines.find(l => l.startsWith("Item Name"));
assert(headerRow !== undefined);
```

**Status:** TO BE ADDED

---

#### TS-10: test_scanner_detects_missing_mandatory_fields
**Purpose:** Verify `MISSING_MANDATORY_FIELD` detection when a variable lacks `name` or `question_text`.

**Input:** Mock variable with empty `name` and `question_text`.

**Expected:**
- Finding with `type === "MISSING_MANDATORY_FIELD"` present
- `missing` field lists absent fields as comma-separated
- Severity = "MEDIUM"

**Assertions:**
```javascript
assert(findings.some(f => f.type === "MISSING_MANDATORY_FIELD"));
assert(missingFinding.missing.includes("name") || missingFinding.missing.includes("question_text"));
assert.strictEqual(missingFinding.severity, "MEDIUM");
```

**Status:** PASS ✅ (test exists in suite)

---

#### TS-11: test_report_empty_findings_html
**Purpose:** Verify HTML report gracefully handles zero findings.

**Input:** Scan result with `catalogFindings: []` and `orderGuideFindings: []`.

**Expected:**
- HTML contains "No deprecated variables detected." message
- No `<table>` tags (or empty table)
- Does not crash or produce malformed HTML

**Assertions:**
```javascript
assert(html.includes("No deprecated variables detected"));
```

**Status:** TO BE ADDED

---

#### TS-12: test_scanner_scoped_table_access
**Purpose:** Verify scanner respects scoped application read boundaries (simulated).

**Input:** Mock database where `sc_cat_item` returns 0 records (simulating ACL block).

**Expected:**
- `totalItems === 0`
- `legacyItems === 0`
- No exception thrown
- `result.scanDate` is populated

**Assertions:**
```javascript
assert.strictEqual(result.totalItems, 0);
assert.strictEqual(result.legacyItems, 0);
assert(result.scanDate !== undefined);
```

**Status:** TO BE ADDED

---

## Test Coverage Matrix

| Scenario | Scanner | Engine | Report | Mock Runtime |
|----------|---------|--------|--------|--------------|
| TS-01 | ✅ | — | — | MockGR, DB fixtures |
| TS-02 | ✅ | — | — | MockGR.isValidRecord() |
| TS-03 | ✅ | — | — | MockGR, DB fixtures |
| TS-04 | ✅ | — | — | MockGR, empty DB |
| TS-05 | — | ✅ | — | MockGR, mock findings |
| TS-06 | — | ✅ | — | MockGR, mock findings |
| TS-07 | — | ✅ | — | MockGR, mock findings |
| TS-08 | — | — | ✅ | Full scan result |
| TS-09 | — | — | ✅ | Full scan result |
| TS-10 | ✅ | — | — | MockGR, altered DB |
| TS-11 | — | — | ✅ | Empty scan result |
| TS-12 | ✅ | — | — | MockGR, empty DB |

**Coverage:** Scanner (6/12), Engine (3/12), Report (3/12), Runtime (12/12 uses mocks)

## Priority Classification

| Tier | Scenarios | Requirement |
|------|-----------|-------------|
| P0 | TS-01, TS-02, TS-03, TS-04 | MUST PASS before any commit |
| P1 | TS-05, TS-06, TS-07 | MUST PASS before push |
| P2 | TS-08, TS-09, TS-10, TS-11, TS-12 | SHOULD PASS; document failures |

## Execution Protocol

1. **Local CI:** `node tests/test_cfms_scanner.js` — run before commit
2. **PDI Smoke Test:** Import `sys_app.xml` into dev362840, run Background Script with scanner + engine + renderer
3. **GitHub Actions (future):** `.github/workflows/test.yml` with Node.js matrix

## Known Limitations

- Mock runtime does not implement `addQuery(field, op, value)` 3-arg form or `orderBy()`
- `renderHTML` has a bug: severity `<td>` is not properly closed (missing `>` before `this._escapeHtml`)
- PDI smoke test requires active instance (PDI hibernates after ~10 days)
