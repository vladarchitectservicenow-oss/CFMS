# CFMS Architecture Summary

**Product:** ServiceNow Catalog Field Mapping Scanner (CFMS)
**Scope:** `x_cfms`
**Version:** 1.0.0
**Release Target:** Australia
**Author:** Vladimir Kapustin
**License:** AGPL-3.0-only

## Overview

CFMS is a scoped ServiceNow application that performs pre-upgrade catalog variable audits. It detects deprecated legacy variable types that the Australia release removes or breaks at runtime — including `macro`, `lookup_select_box`, `list_collector`, `container_start`/`container_end`, and `formatter`. Rather than discovering these silently broken catalog items during UAT or production, CFMS provides a deterministic, repeatable scan engine that produces a ranked remediation report with per-item severity scores and estimated effort hours.

## Component Architecture

```
┌─────────────────────────────────────────────┐
│                 x_cfms Scope                 │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │ CFMSScanner  │  │  CFMSReportRenderer  │ │
│  │              │  │                      │ │
│  │ • runFull()  │  │  • renderHTML()      │ │
│  │ • scanItem() │  │  • renderCSV()       │ │
│  │ • scanBatch()│  │  • _escapeHtml()     │ │
│  │ • _scanOG()  │  │  • _escapeCsv()      │ │
│  │ • exportJSON │  │                      │ │
│  └──────┬───────┘  └──────────────────────┘ │
│         │                                    │
│  ┌──────▼───────┐                            │
│  │  CFMSEngine  │                            │
│  │              │                            │
│  │ • calcScore()│                            │
│  │ • rankItems()│                            │
│  └──────────────┘                            │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  Node.js Test Harness (tests/)       │    │
│  │  • MockGR — GlideRecord mock         │    │
│  │  • MockGS — gs.info/warn/error mock  │    │
│  │  • 5 unit + integration tests        │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Data Flow

1. **Background Script** or **Scheduled Job** instantiates `CFMSScanner`
2. Scanner iterates `sc_cat_item` → queries `item_option_new` per item
3. Each variable's `type` is checked against a hardcoded deprecated type registry (10 types)
4. Missing mandatory fields (`name`, `question_text`, `type`, `cat_item`) also flagged as `MEDIUM` severity
5. Scanner queries `sc_cat_item_guide` for deprecated wizard references
6. Raw findings array passed to `CFMSEngine.rankItems()`:
   - Weighted severity conversion: CRITICAL=8, HIGH=5, MEDIUM=2, LOW=0.5
   - Formula: `score = max(0, 100 - raw * 8)`
   - Estimated hours: `ceil(raw * 0.75)`
7. Ranked results passed to `CFMSReportRenderer`:
   - HTML: self-contained document with severity color-coding
   - CSV: RFC-4180 compatible export
8. Output: attachment, email, or REST API response

## Deprecated Type Registry

| Type | Severity | Business Impact |
|------|----------|-----------------|
| `reference` | HIGH | Legacy reference lookups break |
| `lookup_select_box` | HIGH | Deprecated Utah, removed Australia |
| `list_collector` | HIGH | Migrate to Multi-Row Variable Sets |
| `macro` | HIGH | UI Macros no longer render |
| `macroponent` | HIGH | Proprietary wrapper removed |
| `masked` | MEDIUM | Data mask behavior changes |
| `break` | LOW | Visual separator only |
| `container_start` | MEDIUM | Container pairing validation required |
| `container_end` | MEDIUM | Container pairing validation required |
| `formatter` | HIGH | UI Formatters removed |

## Runtime Dependencies

- **ServiceNow:** Utah+, Australia for full feature set. Runs on any instance with `sc_cat_item` and `item_option_new` tables.
- **Plugins:** None required. Zero external plugins.
- **Cross-scope access:** Standard GlideRecord ACL enforcement. No cross-scope privilege grants needed — all tables queried (`sc_cat_item`, `item_option_new`, `sc_cat_item_guide`) are globally readable by default.
- **No REST/external calls:** Zero data egress.

## Error Handling

- `scanCatalogItem()` returns `status: "error"` with `errorMessage` for invalid records
- `runFullScan()` wraps `sc_cat_item_guide` scan in try/catch — old instances missing this table won't crash
- `_scanOrderGuides()` silently catches all exceptions
- Export methods return well-formed JSON even on empty input

## Design Decisions

1. **Server-side only** — No Client Scripts, UI Policies, or AngularJS dependencies. 100% Business Rule / Background Script compatible.
2. **Read-only guarantee** — Scanner never modifies records. Safe for production.
3. **Configurable weights** — `SEVERITY_WEIGHT` and `MANDATORY_FIELDS` are prototype properties. Organizations can tune without forking.
4. **Self-contained CI** — Node.js test harness with full mock runtime. No ServiceNow instance required for validation.
5. **Dual output** — HTML for human review, CSV for data teams and spreadsheets.
