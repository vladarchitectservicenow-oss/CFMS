/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * CFMSScanner.js
 * ServiceNow Catalog Field Mapping Scanner
 * Scans catalog items for deprecated legacy variable types.
 * Scope: x_cfms
 * v1.0.0
 */

var CFMSScanner = Class.create();
CFMSScanner.prototype = {
    initialize: function() {
        this.DEPRECATED_TYPES = [
            'reference',
            'lookup_select_box',
            'list_collector',
            'macro',
            'macroponent',
            'masked',
            'break',
            'container_end',
            'container_start',
            'formatter'
        ];

        this.TYPE_DESCRIPTIONS = {
            'reference': 'Legacy Reference variable — migrate to GlideAjax or Reference Lookup',
            'lookup_select_box': 'Lookup Select Box — deprecated in Utah, removed in Australia',
            'list_collector': 'Legacy List Collector — requires migration to Multi-Row Variable Sets or standard List field',
            'macro': 'Legacy UI Macro variable — migrate to UI Builder Components or scripted components',
            'macroponent': 'Deprecated macroponent — remove before Australia upgrade',
            'masked': 'Masked variable type — data loss risk during upgrade rollback',
            'break': 'Visual Break element — no functional impact',
            'container_end': 'Container End marker — verify container pairing post-upgrade',
            'container_start': 'Container Start marker — verify container pairing post-upgrade',
            'formatter': 'UI Formatter — removed in Australia, migrate to UI Builder'
        };

        this.MANDATORY_FIELDS = ['name', 'question_text', 'type', 'cat_item'];
    },

    /**
     * Initialize the scanner (alias for ServiceNow scripting).
     */
    initializeScanner: function() {
        gs.info('CFMSScanner initialized for scope x_cfms');
        return this;
    },

    /**
     * Scan a single catalog item for deprecated variables.
     * @param {GlideRecord} catalogItemGR
     * @returns {Object} scanResult
     */
    scanCatalogItem: function(catalogItemGR) {
        var result = {
            sys_id: catalogItemGR.getValue('sys_id'),
            name: catalogItemGR.getValue('name') || catalogItemGR.getValue('short_description'),
            category: catalogItemGR.getValue('category') || 'Uncategorized',
            deprecatedVariables: [],
            findings: [],
            scanTimestamp: new Date().toISOString(),
            status: 'ok'
        };

        if (!catalogItemGR.isValidRecord()) {
            result.status = 'error';
            result.errorMessage = 'Invalid catalog item record provided.';
            return result;
        }

        var varGR = new GlideRecord('item_option_new');
        varGR.addQuery('cat_item', catalogItemGR.getUniqueValue());
        varGR.query();

        while (varGR.next()) {
            var varType = String(varGR.getValue('type') || '').toLowerCase();
            var isDeprecated = this.DEPRECATED_TYPES.indexOf(varType) !== -1;

            if (isDeprecated) {
                var finding = {
                    sys_id: varGR.getValue('sys_id'),
                    name: varGR.getValue('name'),
                    question: varGR.getValue('question_text') || varGR.getValue('name'),
                    type: 'LEGACY_VARIABLE',
                    variable: varGR.getValue('name'),
                    legacy_type: varType,
                    type_description: this.TYPE_DESCRIPTIONS[varType] || 'Deprecated — no description available',
                    severity: 'HIGH',
                    order: parseInt(varGR.getValue('order') || '0', 10),
                    mandatory: varGR.getValue('mandatory') === 'true' || varGR.getValue('mandatory') === '1',
                    active: varGR.getValue('active') !== 'false'
                };
                result.deprecatedVariables.push(finding);
                result.findings.push(finding);
            }

            // Check mandatory fields (Australia enforces stricter validation)
            var missingFields = [];
            for (var j = 0; j < this.MANDATORY_FIELDS.length; j++) {
                var mf = this.MANDATORY_FIELDS[j];
                var fv = varGR.getValue(mf);
                if (!fv || fv === '') missingFields.push(mf);
            }
            if (missingFields.length > 0) {
                result.findings.push({
                    severity: 'MEDIUM',
                    type: 'MISSING_MANDATORY_FIELD',
                    variable: varGR.getValue('name') || '',
                    question: varGR.getValue('question_text') || '',
                    missing: missingFields.join(', ')
                });
            }
        }

        if (result.deprecatedVariables.length > 0) {
            result.status = 'deprecated_found';
        }

        return result;
    },

    /**
     * Batch scan across the entire catalog.
     * @param {string} [categorySysID] - Optional category filter
     * @returns {Object} batchResult
     */
    scanCatalogBatch: function(categorySysID) {
        var batch = {
            itemsScanned: 0,
            itemsWithDeprecated: 0,
            totalDeprecatedVariables: 0,
            results: [],
            scanTimestamp: new Date().toISOString()
        };

        var itemGR = new GlideRecord('sc_cat_item');
        if (categorySysID) {
            itemGR.addQuery('category', categorySysID);
        }
        itemGR.addQuery('active', true);
        itemGR.query();

        while (itemGR.next()) {
            var itemResult = this.scanCatalogItem(itemGR);
            batch.itemsScanned++;
            if (itemResult.status === 'deprecated_found') {
                batch.itemsWithDeprecated++;
                batch.totalDeprecatedVariables += itemResult.deprecatedVariables.length;
            }
            batch.results.push(itemResult);
        }

        gs.info('CFMS Batch Scan complete: ' + batch.itemsScanned + ' items scanned, ' +
            batch.itemsWithDeprecated + ' with deprecated variables.');
        return batch;
    },

    /**
     * Run full scan — compatible legacy entry point.
     * @returns {Object} findings per catalog item.
     */
    runFullScan: function() {
        var catalogFindings = [];
        var totalItems = 0;
        var legacyItems = 0;

        try {
            var gr = new GlideRecord('sc_cat_item');
            gr.query();
            while (gr.next()) {
                totalItems++;
                var itemResult = this.scanCatalogItem(gr);
                if (itemResult.findings.length > 0) {
                    legacyItems++;
                    catalogFindings.push({
                        item_sys_id: itemResult.sys_id,
                        item_name: itemResult.name,
                        findings: itemResult.findings
                    });
                }
            }
        } catch (e) {
            gs.error('CFMS runFullScan error: ' + e.message);
        }

        // Scan order guides for deprecated wizard references
        var ogFindings = this._scanOrderGuides();

        return {
            totalItems: totalItems,
            legacyItems: legacyItems,
            catalogFindings: catalogFindings,
            orderGuideFindings: ogFindings,
            scanDate: new GlideDateTime().getDisplayValueInternal()
        };
    },

    _scanOrderGuides: function() {
        var out = [];
        try {
            var og = new GlideRecord('sc_cat_item_guide');
            og.query();
            while (og.next()) {
                var wizard = og.getValue('wizard') || '';
                if (wizard !== '') {
                    out.push({
                        severity: 'MEDIUM',
                        type: 'DEPRECATED_ORDER_GUIDE_WIZARD',
                        guide: og.getValue('name') || '',
                        wizard: wizard
                    });
                }
            }
        } catch (e) {}
        return out;
    },

    /**
     * Export scan result to JSON string.
     */
    exportJSON: function(result) {
        return JSON.stringify(result, null, 2);
    },

    type: 'CFMSScanner'
};

// Node.js module compatibility
if (typeof exports !== 'undefined') {
    exports.CFMSScanner = CFMSScanner;
}
