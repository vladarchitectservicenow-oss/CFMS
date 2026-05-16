/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * CFMSEngine — Score engine for Catalog Field Mapping Scanner.
 * Calculates remediation effort per catalog item.
 */
var CFMSEngine = Class.create();
CFMSEngine.prototype = {
    initialize: function() {
        this.SEVERITY_WEIGHT = { CRITICAL: 8, HIGH: 5, MEDIUM: 2, LOW: 0.5 };
    },

    /**
     * Calculate score for a catalog item based on its findings.
     * @param {Array} itemFindings — findings from CFMSScanner for one item
     * @return {Object} { score (0-100), severity (critical/high/medium/low), hours }
     */
    calculateItemScore: function(itemFindings) {
        var raw = 0;
        for (var i = 0; i < itemFindings.length; i++) {
            var f = itemFindings[i];
            var w = this.SEVERITY_WEIGHT[f.severity] || 1;
            raw += w;
        }
        // Normalize: score = max(0, 100 - raw*10), capped
        var score = Math.max(0, 100 - raw * 8);
        var severity = score < 40 ? "critical" : (score < 60 ? "high" : (score < 80 ? "medium" : "low"));
        var hours = Math.ceil(raw * 0.75);
        return { score: Math.round(score), severity: severity, hours: hours, totalFindings: itemFindings.length };
    },

    /**
     * Rank all catalog items by remediation urgency.
     * @param {Array} allFindings — output from CFMSScanner.runFullScan().catalogFindings
     * @return {Array} sorted descending by raw risk
     */
    rankItems: function(allFindings) {
        var out = [];
        for (var i = 0; i < allFindings.length; i++) {
            var item = allFindings[i];
            var calc = this.calculateItemScore(item.findings);
            out.push({
                item_sys_id: item.item_sys_id,
                item_name: item.item_name,
                findings_count: item.findings.length,
                score: calc.score,
                severity: calc.severity,
                est_hours: calc.hours
            });
        }
        out.sort(function(a, b) { return a.score - b.score; });
        return out;
    },

    type: "CFMSEngine"
};
