# The Hidden Catalog Tax: How Legacy Variables Kill Australia Upgrades

**Whitepaper — Catalog Field Mapping Scanner (CFMS)**  
**Date:** May 2026  
**Author:** Vladimir Kapustin

---

## 1. The Problem

Australia release enforces stricter catalog variable validation. Legacy types removed:
- `macro`, `break`, `container_start`, `container_end`
- Old `select_box` variants
- Deprecated order guide wizards

Platform teams discover these breakages **only during upgrade testing** — 2-3 weeks into the migration, not before.

## 2. Impact

| Risk | Cost |
|------|------|
| Service catalog unavailability | $5K-$15K per day |
| Manual audit (500 items) | 2-3 weeks |
| Customer-facing forms broken | Incident tickets, SLA penalties |

## 3. CFMS Solution

Autonomous scan of `sc_cat_item`, `item_option_new`, `sc_cat_item_guide`.

Outputs:
- Per-item severity score (0-100)
- Estimated remediation hours
- Ranked priority list

## 4. ROI

| Metric | Value |
|--------|-------|
| Manual audit effort | 80 hours → 4 hours (CFMS install + run) |
| Cost savings per upgrade | $12,000+ |
| Risk reduction | Pre-upgrade detection vs post-upgrade firefighting |

---
Vladimir Kapustin · AGPL-3.0-only
