# Edge Cases — CFMS

**Product:** ServiceNow Catalog Field Mapping Scanner  
**Scope:** x_cfms  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  

---

## EC-01: Empty Catalog — Zero Records

**Description:** Instance has no catalog items in `sc_cat_item`.

**Expected behavior:**
- `totalItems` = 0
- `legacyItems` = 0  
- `catalogFindings` = `[]`
- `orderGuideFindings` may be populated (order guides can exist without catalog items)
- No exception thrown
- Report generates normally (HTML shows "No deprecated variables detected")

**Risk if unhandled:** Division by zero in report calculations, null reference errors in ranking.

**Handling:** `runFullScan()` initializes `totalItems = 0` and only increments on records found.

---

## EC-02: Single Item — 50,000+ Variables

**Description:** One catalog item with an extreme number of `item_option_new` variables (50,000+). GlideRecord query and JavaScript array operations may hit platform limits.

**Expected behavior:**
- Scanner iterates all variables without crash
- GlideRecord `.query()` returns all records (platform handles pagination internally)
- Report generation may be slow (50,000 rows in HTML/CSV) but succeeds
- `legacyItems` may be 1 even if only one deprecated variable exists among 50,000

**Risk if unhandled:** JavaScript heap exhaustion, GlideRecord transaction timeout, report file size exceeding email attachment limits.

**Handling:** 
- Scanner uses streaming GlideRecord iteration, not array load-all
- CSV recommended over HTML for >1,000 findings
- Category-batch scanning documented in README as mitigation for large catalogs

---

## EC-03: Null/Missing Column Values

**Description:** `item_option_new` rows where `type`, `name`, or `cat_item` is null or undefined.

**Expected behavior:**
- `getValue('type')` returns empty string → `toLowerCase()` yields `""` → not in `DEPRECATED_TYPES` → no false positive
- `getValue('name')` returns empty string → `MISSING_MANDATORY_FIELD` detection triggers correctly
- `getValue('cat_item')` returns empty string → `addQuery` still works (empty string equality match)

**Risk if unhandled:** `String(null).toLowerCase()` = `"null"` — if scanner uses `.toString()` instead of `String()`, null coerces to string "null" which could accidentally match a deprecated type named "null". CFMS uses `String(...)` which returns `"null"` not `null`, so this is safe. However, `String(undefined)` = `"undefined"` — same issue.

**Handling:** CFMSScanner explicitly casts: `String(varGR.getValue('type') || '').toLowerCase()`. The `|| ''` fallback ensures null/undefined become empty string before case conversion.

---

## EC-04: Malformed XML — sys_app.xml Corruption

**Description:** `sys_app.xml` contains truncated or malformed XML (incomplete tags, unescaped entities, BOM markers).

**Expected behavior:**
- XML import into Studio fails with descriptive error
- Does NOT silently create a partial application
- Repository CI should validate XML well-formedness

**Risk if unhandled:** Studio accepts partially valid XML, creates orphaned records.

**Handling:** Not applicable at scanner runtime — XML is only consumed during installation. Add `.github/workflows/validate-xml.yml` for CI validation (future).

---

## EC-05: Race Condition — Concurrent Scans

**Description:** Two scheduled jobs or Background Scripts run `runFullScan()` simultaneously.

**Expected behavior:**
- Each scan produces independent results
- No shared state corruption (GlideRecord cursors are per-instance, not global)
- No database locking issues (read-only operations)

**Risk if unhandled:** Minimal — all operations are read-only. The only risk is duplicate log output making debugging harder.

**Handling:** No explicit lock needed for read-only operations. The scanner does not maintain any global state — each instantiation creates independent state.

---

## EC-06: Unicode/Special Characters in Names

**Description:** Catalog item names or variable names contain Unicode characters (CJK, emoji, RTL text, null bytes).

**Expected behavior:**
- `renderHTML()` escapes all special characters via `_escapeHtml()` (handles `&`, `<`, `>`, `"`)
- `renderCSV()` properly quotes fields containing commas, quotes, or newlines
- Scanner's string comparisons (`toLowerCase()`) handle Unicode correctly per JavaScript

**Risk if unhandled:** HTML injection via unescaped `<script>` in item names, CSV injection via formula characters (`=`, `@`, `+`), broken report display.

**Handling:** 
- `_escapeHtml()` escapes `&`, `<`, `>`, `"` but NOT single quotes — minor gap
- `_escapeCsv()` wraps in double quotes if the value contains comma, double quote, or newline
- Missing: CSV formula injection protection (prefix `'` for cells starting with `=`, `@`, `+`, `-`)

---

## EC-07: Instance Without sc_cat_item_guide Table

**Description:** Pre-Geneva instance or intentionally removed table.

**Expected behavior:**
- `_scanOrderGuides()` catches the exception
- `orderGuideFindings` returns `[]`
- Full scan completes successfully with only catalog findings
- No crash or partial report

**Risk if unhandled:** `runFullScan()` throws uncaught exception, entire scan fails, no report generated.

**Handling:** `_scanOrderGuides()` is wrapped in try/catch block. Verified in source:
```javascript
try { var og = new GlideRecord('sc_cat_item_guide'); ... } catch (e) {}
```

---

## EC-08: Score Overflow — Item with All 10 Deprecated Types

**Description:** Single catalog item uses all 10 deprecated variable types simultaneously.

**Expected behavior:**
- `raw` score = weighted sum of 10 findings
- `score = max(0, 100 - raw * 8)` — with all HIGH (5×7 + 2×2 + 1×0.5) = 39.5 raw → score = max(0, 100 - 316) = 0
- Severity = "critical"
- Hours = ceil(29.625) = 30

**Risk if unhandled:** Score going negative before `max(0, ...)` normalization. Actually, this is handled — `Math.max(0, ...)` floors at 0.

**Handling:** `Math.max(0, 100 - raw * 8)` ensures non-negative.

---

## EC-09: Inactive Catalog Items — active=false

**Description:** `sc_cat_item.active` is set to `false` for some items.

**Expected behavior:**
- `scanCatalogBatch()` filters `active = true` → inactive items excluded
- `runFullScan()` does NOT filter by `active` → scans ALL items including inactive
- This is intentional: inactive items may still have legacy variables that would break if the item is reactivated after upgrade

**Risk if unhandled:** Inactive items with deprecated variables are missed in pre-upgrade audit, then reactivated post-upgrade → broken form. This is actually the LESS dangerous behavior (item is inactive anyway), but the safer approach is to scan everything.

**Handling:** `runFullScan()` does not filter by `active`. `scanCatalogBatch()` does — documented difference in API reference.

---

## EC-10: sys_app.xml Import Conflict — Scope Already Exists

**Description:** Attempting to import `sys_app.xml` into an instance where `x_cfms` scope already has records.

**Expected behavior:**
- ServiceNow's XML import shows conflict dialog
- User can choose to merge or overwrite
- No data loss for existing scan logs unless user chooses overwrite

**Risk if unhandled:** Duplicate application records, Studio error on publish.

**Handling:** Not handled at scanner level — installation concern. Documented in README installation section.
