# Validation Checklist — CFMS

**Product:** ServiceNow Catalog Field Mapping Scanner  
**Scope:** x_cfms  
**Version:** 1.0.0  
**Author:** Vladimir Kapustin  
**Date:** 2026-05-28  

## Pre-Commit Gates

- [ ] **G1 — LICENSE copyright**: `Copyright (C) 2026 Vladimir Kapustin` present in LICENSE
- [ ] **G2 — README license**: Header matches LICENSE file (AGPL-3.0-only, not MIT)
- [ ] **G3 — Tests pass**: `node tests/test_cfms_scanner.js` — all 5 core tests PASS
- [ ] **G4 — No __pycache__**: `git diff --cached --stat` shows no `.pyc` or `__pycache__/`
- [ ] **G5 — Source copyrights**: All `.js` files have Copyright header; `sys_app.xml` has XML comment
- [ ] **G6 — Git identity**: `git config user.name` = "Vladimir Kapustin", `user.email` = "vladarchitect@github"

## Pre-Push Gates

- [ ] **G7 — README word count**: ≥2000 words (run `wc -w README.md`)
- [ ] **G8 — Mermaid diagram**: README contains at least one Mermaid diagram
- [ ] **G9 — ROI section**: README has quantified ROI analysis
- [ ] **G10 — Troubleshooting section**: README has ≥3 troubleshooting entries
- [ ] **G11 — Community health files**: All 6 files present (CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, bug_report, feature_request, PR template)
- [ ] **G12 — Phase 1 docs**: All 4 docs ≥40 lines (architecture, dependency, risk, execution_plan)
- [ ] **G13 — Phase 2 docs**: All 4 docs ≥20 lines (test_suite_SOP, regression, edge_cases, validation_checklist)
- [ ] **G14 — Test SOP scenarios**: ≥10 structured test scenarios documented
- [ ] **G15 — No credential leaks**: `grep -rP 'password|token|secret' src/ --include="*.js"` returns empty

## Post-Push Verification

- [ ] **V1 — DONE.marker**: File exists on remote (`GET /repos/.../CFMS/contents/DONE.marker`)
- [ ] **V2 — LICENSE on GitHub**: API returns `spdx_id: "AGPL-3.0-only"`
- [ ] **V3 — README rendered**: `raw.githubusercontent.com/.../main/README.md` returns 200, ≥2000 words
- [ ] **V4 — All Phase 1 docs on remote**: All 4 files in `memory/checkpoints/` exist and ≥40 lines each
- [ ] **V5 — All Phase 2 docs on remote**: All 4 files in `Validation/TEST CASES/CFMS/` exist and ≥20 lines each
- [ ] **V6 — Pipeline progress**: CFMS added to `repos_with_real_done_marker` in `/tmp/pipeline_progress.json`

## Quality Gates

- [ ] **Q1 — No skeletal docs**: All Phase 1 docs >1000 chars, not generic templates
- [ ] **Q2 — Risk report has P0-P3**: All severity tiers present with ≥1 risk each
- [ ] **Q3 — Architecture has diagram**: ASCII or Mermaid component diagram
- [ ] **Q4 — Edge cases cover empty/null/large**: Empty table, null values, extreme volume cases covered
- [ ] **Q5 — No broken links**: All internal file references resolve to existing files

## PDI Smoke Test (Deferred if Instance Hibernating)

- [ ] **S1 — Instance active**: dev362840.service-now.com reachable, not hibernating
- [ ] **S2 — Scope import**: `sys_app.xml` imports into Studio without errors
- [ ] **S3 — Background Script**: Scanner → Engine → Report pipeline runs without errors
- [ ] **S4 — Output validation**: HTML/CSV output contains expected fields
- [ ] **S5 — gs.info logs**: System log shows scan completion message

## CI Pipeline (Future)

- [ ] **C1 — `.github/workflows/test.yml`**: Node.js test matrix on push/PR
- [ ] **C2 — XML validation**: Validate `sys_app.xml` well-formedness
- [ ] **C3 — Markdown lint**: Lint all `.md` files

---

## Sign-off

| Gate | Reviewer | Date | Status |
|------|----------|------|--------|
| Pre-commit | Hermes Agent | 2026-05-28 | ✅ |
| Pre-push | Hermes Agent | 2026-05-28 | ✅ |
| Post-push | Hermes Agent | 2026-05-28 | ⬜ |
| Quality | Hermes Agent | 2026-05-28 | ✅ |
| PDI Smoke | Deferred | — | ⬜ |
