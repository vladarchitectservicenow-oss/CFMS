# Regression Cases — CFMS

**Product:** ServiceNow Catalog Field Mapping Scanner  
**Scope:** x_cfms  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  

## What Regressions Are Tested

Regressions occur when a code change (fix, enhancement, platform upgrade) causes previously-working functionality to break. This document defines the regression test cases that must pass after any source modification.

---

## RC-01: Idempotent Execution — Same Result on Re-run

**Trigger:** Run `CFMSScanner.runFullScan()` twice on the same database state.

**What could break:** Caching side effects, stateful counters, or GlideRecord cursor reuse.

**Expected:**
```javascript
var r1 = scanner.runFullScan();
var r2 = scanner.runFullScan();
assert.strictEqual(r1.totalItems, r2.totalItems);
assert.strictEqual(r1.legacyItems, r2.legacyItems);
assert.strictEqual(r1.orderGuideFindings.length, r2.orderGuideFindings.length);
assert.strictEqual(r1.catalogFindings.length, r2.catalogFindings.length);
```

**Status:** TO VERIFY

---

## RC-02: Report Format Consistency Across Runs

**Trigger:** Generate HTML and CSV reports from two identical scan results.

**What could break:** Non-deterministic sorting, timestamp format changes, or floating-point rounding in score calculation.

**Expected:**
```javascript
var html1 = renderer.renderHTML(identicalPayload);
var html2 = renderer.renderHTML(identicalPayload);
assert.strictEqual(html1, html2);
```

**Status:** TO VERIFY

---

## RC-03: Backward Compatibility — Pre-Australia Instances

**Trigger:** Run scanner on an instance that does NOT have Australia-specific tables or columns.

**What could break:** References to columns or tables that only exist in Australia+. The scanner must gracefully handle missing `sc_cat_item_guide.wizard` without crashing.

**Expected:**
- Scanner completes without exception
- `orderGuideFindings` may be empty (graceful degradation)
- Error logged but scan continues

**Status:** TO VERIFY (try/catch wrapper exists in `_scanOrderGuides()`)

---

## RC-04: Score Multiplier Stability

**Trigger:** Change `SEVERITY_WEIGHT` values, verify the scoring formula still produces 0–100 range.

**What could break:** Score normalization going negative or exceeding 100; severity tier boundaries shifting unexpectedly.

**Expected:** For any valid SEVERITY_WEIGHT configuration, `calculateItemScore()`:
- Returns `score` in range [0, 100]
- Returns a valid severity string ("critical", "high", "medium", or "low")
- Returns a non-negative `hours` estimate

**Status:** TO VERIFY

---

## RC-05: Deprecated Type Registry Integrity

**Trigger:** Add or remove a type from `DEPRECATED_TYPES`, verify all existing tests still pass.

**What could break:** Type removal silently creates false negatives (items with that type no longer flagged). Type addition may inflate scores beyond expected ranges.

**Expected:**
- Removing a type → `legacyItems` count may decrease (expected)
- Adding a type → scores may change (expected), but no crashes
- All type descriptions in `TYPE_DESCRIPTIONS` match registry

**Status:** TO VERIFY

---

## RC-06: GlideRecord Mock Fidelity After Node.js Upgrade

**Trigger:** Upgrade Node.js version used for test harness (e.g., 16 → 22).

**What could break:** `eval()` behavior changes in strict mode, `var` scoping in module context, or `Class.create()` prototype chain behavior.

**Expected:** All 12 test scenarios pass without modification.

**Status:** TO VERIFY

---

## RC-07: PDI Smoke Test After Australia Upgrade

**Trigger:** Run scanner via Background Script on a PDI that has been upgraded from Zurich to Australia.

**What could break:** `item_option_new.type` column behavior, `sc_cat_item_guide.wizard` deprecation, or GlideRecord API changes in Australia.

**Expected:**
- Scanner completes and produces results
- No new `undefined` type errors on column access
- Order guide scan path does not throw new errors

**Status:** TO VERIFY (PDI smoke test — requires active instance)

---

## Regression Test Protocol

1. **Before every commit:** Run existing 5 test suite + add any new regression cases from this file
2. **Before every release:** Run full 12-scenario suite on both Node.js mock and PDI smoke test
3. **After platform upgrade:** Re-run PDI smoke test and verify no new errors

## Failed Regression — Rollback Procedure

If a regression is detected:
1. Identify the commit that introduced the failure (`git bisect`)
2. Revert the commit or fix the root cause
3. Add the specific regression case to the automated suite (prevent recurrence)
4. Re-run full suite before re-pushing
