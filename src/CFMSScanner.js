/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * CFMS — Catalog Field Mapping Scanner
 * Scope: x_cfms
 * Problem: Australia removes legacy catalog variable types (e.g. macro, break, container start/end).
 * Teams manually auditing 500+ catalog items discover breakage only post-upgrade.
 */

var CFMSScanner = Class.create();
CFMSScanner.prototype = {
    initialize: function() {
        this.LEGACY_VAR_TYPES = ["macro", "break", "container_start", "container_end", "select_box", "list_collector_legacy"];
        this.DEPRECATED_TABLES = ["sc_item_variable_mapping", "sc_item_option_old"];
        this.MANDATORY_FIELDS  = ["name", "question", "type", "cat_item"];
        this.version = "1.0.0";
    },

    /**
     * Run full scan of catalog items, variables, and order guides.
     * @return {Object} findings per catalog item.
     */
    runFullScan: function() {
        var findings = [];
        var totalItems = 0;
        var legacyItems = 0;

        try {
            var gr = new GlideRecord("sc_cat_item");
            gr.query();
            while (gr.next()) {
                totalItems++;
                var itemSysId = gr.getUniqueValue();
                var itemName  = gr.getValue("name") || "";

                var itemFindings = this._scanItemVariables(itemSysId, itemName);
                if (itemFindings.length > 0) {
                    legacyItems++;
                    findings.push({
                        item_sys_id: itemSysId,
                        item_name: itemName,
                        findings: itemFindings
                    });
                }
            }
        } catch (e) {}

        // Scan order guides for deprecated wizard references
        var ogFindings = this._scanOrderGuides();
        return {
            totalItems: totalItems,
            legacyItems: legacyItems,
            catalogFindings: findings,
            orderGuideFindings: ogFindings,
            scanDate: new GlideDateTime().getDisplayValueInternal()
        };
    },

    _scanItemVariables: function(itemSysId, itemName) {
        var out = [];
        try {
            var v = new GlideRecord("item_option_new");
            v.addQuery("cat_item", itemSysId);
            v.query();
            while (v.next()) {
                var varType = (v.getValue("type") || "").toLowerCase();
                var varName = v.getValue("name") || "";
                var question = v.getValue("question_text") || "";
                for (var i = 0; i < this.LEGACY_VAR_TYPES.length; i++) {
                    if (varType === this.LEGACY_VAR_TYPES[i] || varName.indexOf(this.LEGACY_VAR_TYPES[i]) >= 0) {
                        out.push({
                            severity: "HIGH",
                            type: "LEGACY_VARIABLE",
                            variable: varName,
                            question: question,
                            legacy_type: this.LEGACY_VAR_TYPES[i]
                        });
                    }
                }
                // Check for missing mandatory fields (Australia enforces stricter validation)
                var missingFields = [];
                for (var j = 0; j < this.MANDATORY_FIELDS.length; j++) {
                    var mf = this.MANDATORY_FIELDS[j];
                    var fv = v.getValue(mf);
                    if (!fv || fv === "") missingFields.push(mf);
                }
                if (missingFields.length > 0) {
                    out.push({
                        severity: "MEDIUM",
                        type: "MISSING_MANDATORY_FIELD",
                        variable: varName,
                        question: question,
                        missing: missingFields.join(", ")
                    });
                }
            }
        } catch (e) {}
        return out;
    },

    _scanOrderGuides: function() {
        var out = [];
        try {
            var og = new GlideRecord("sc_cat_item_guide");
            og.query();
            while (og.next()) {
                var wizard = og.getValue("wizard") || "";
                if (wizard !== "") {
                    out.push({
                        severity: "MEDIUM",
                        type: "DEPRECATED_ORDER_GUIDE_WIZARD",
                        guide: og.getValue("name") || "",
                        wizard: wizard
                    });
                }
            }
        } catch (e) {}
        return out;
    },

    type: "CFMSScanner"
};
