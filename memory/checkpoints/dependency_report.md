# CFMS Dependency Report

**Product:** ServiceNow Catalog Field Mapping Scanner
**Scope:** `x_cfms`
**Author:** Vladimir Kapustin
**Date:** 2026-05-28

## Internal Dependencies (ServiceNow Platform)

### Required Tables (Read-Only)
| Table | Purpose | Availability |
|-------|---------|--------------|
| `sc_cat_item` | Catalog item enumeration | All instances |
| `item_option_new` | Variable definitions per item | All instances |
| `sc_cat_item_guide` | Order guide wizard detection | Geneva+ |

**Note:** `sc_cat_item_guide` may be absent on pre-Geneva instances. The scanner wraps `_scanOrderGuides()` in try/catch and gracefully handles its absence.

### Required Roles
| Role | Purpose | Fallback |
|------|---------|----------|
| `admin` | Full scanner execution | Required |
| `catalog_admin` | Catalog read access | Falls through to admin |
| `x_cfms.admin` | Scoped app admin | Auto-created by app installation |

### GlideRecord APIs Used
- `GlideRecord(table)` — record creation
- `.addQuery(field, value)` — filtering (2 forms: with/without operator)
- `.query()` — execution
- `.next()` — iteration
- `.getValue(field)` — field read
- `.getUniqueValue()` — sys_id retrieval
- `.isValidRecord()` — null-check before scanning

### GlideDateTime APIs Used
- `new GlideDateTime()` — current timestamp
- `.getDisplayValueInternal()` — ISO-like timestamp for scan date

### Logging APIs Used
- `gs.info(msg)` — informational (scan summaries)
- `gs.warn(msg)` — warnings (items with deprecated variables)
- `gs.error(msg)` — errors (scan failures)

### System Properties
None required. The scanner is configuration-free out of the box.

### Plugins
None required. The scanner depends only on core platform tables and APIs available since the Jakarta release.

## External Dependencies

### None
CFMS has **zero external dependencies**. It does not:
- Call REST APIs
- Connect to external databases
- Require MID Server
- Use IntegrationHub spokes
- Access internet resources
- Import third-party libraries

All processing stays inside the ServiceNow instance boundary.

## Test Dependencies (Node.js CI)

### Runtime
| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | 16+ | Test execution |
| `assert` | Built-in | Unit test assertions |
| `fs` | Built-in | Source file loading |

### Mock Runtime
The test harness implements a self-contained mock of the ServiceNow runtime:
- `global.Class.create()` — ServiceNow prototype pattern
- `global.GlideRecord(table)` — constructor with DB routing
- `global.GlideDateTime(value)` — timestamp wrapper
- `global.gs.{info,warn,error}` — logging mock

### Test Database Fixtures
Three catalog items with five variables:
- `item1` (Laptop Request): `choice` + `macro` (2 vars)
- `item2` (Access Request): `break` (1 var)
- `item3` (Legacy Macro Form): `macro` + `container_start` (2 vars)
- One order guide with deprecated wizard, one without

## Dependency Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| `sc_cat_item_guide` missing | LOW | try/catch in `_scanOrderGuides()` |
| `item_option_new` schema change | LOW | All queried fields are stable since Jakarta |
| Node.js version mismatch | LOW | Only uses `assert` and `fs` — stable since Node 4 |
| Scoped app isolation | NONE | All code runs in `x_cfms` scope |

## Dependency Graph

```
CFMS (x_cfms)
│
├── ServiceNow Platform (Utah+)
│   ├── sc_cat_item table
│   ├── item_option_new table
│   ├── sc_cat_item_guide table (optional)
│   ├── GlideRecord API
│   ├── GlideDateTime API
│   └── gs logging API
│
└── [CI only] Node.js 16+
    ├── assert (built-in)
    └── fs (built-in)
```

**Verdict:** Zero external dependencies. The scanner is fully self-contained within the ServiceNow platform and works on any instance from Utah forward.
