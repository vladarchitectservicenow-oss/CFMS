/**
 * CFMSReportRenderer.js
 * ServiceNow Catalog Field Mapping Scanner — Report Renderer
 * Generates HTML and CSV reports from scan results.
 */

var CFMSReportRenderer = Class.create();
CFMSReportRenderer.prototype = {
    initialize: function() {
        this.version = '1.0.0';
    },

    /**
     * Generate HTML report from scan result.
     * @param {Object} scanResult — result from CFMSScanner.runFullScan() or scanCatalogBatch()
     * @returns {string} HTML document
     */
    renderHTML: function(scanResult) {
        var html = [];
        var findings = scanResult.catalogFindings || [];
        var guides = scanResult.orderGuideFindings || [];
        var title = 'CFMS Audit Report — ServiceNow Catalog Scan';

        html.push('<html><head><title>' + title + '</title>');
        html.push('<style>');
        html.push('body{font-family:Segoe UI,Helvetica,Arial,sans-serif;margin:24px;background:#f7f9fb;color:#1b1b1b;}');
        html.push('h1{color:#0a2a5e;}h2{color:#15418c;}table{border-collapse:collapse;width:100%;background:#fff;margin-top:12px;}');
        html.push('th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #e1e4e8;}');
        html.push('th{background:#0a2a5e;color:#fff;font-weight:600;}');
        html.push('.severity-critical{color:#d93025;font-weight:700;}');
        html.push('.severity-high{color:#fa7b17;font-weight:600;}');
        html.push('.severity-medium{color:#f9ab00;font-weight:600;}');
        html.push('.severity-low{color:#188038;}');
        html.push('.summary{background:#fff;padding:16px;border-radius:8px;border:1px solid #e1e4e8;margin-bottom:16px;}');
        html.push('</style></head><body>');

        html.push('<h1>' + title + '</h1>');
        html.push('<div class="summary">');
        html.push('<p><strong>Scan Date:</strong> ' + (scanResult.scanDate || new Date().toISOString()) + '</p>');
        html.push('<p><strong>Total Items Scanned:</strong> ' + (scanResult.totalItems || 'N/A') + '</p>');
        html.push('<p><strong>Items with Deprecated Variables:</strong> ' + (scanResult.legacyItems || 'N/A') + '</p>');
        html.push('<p><strong>Version:</strong> ' + this.version + '</p>');
        html.push('</div>');

        // Catalog findings
        html.push('<h2>Catalog Item Findings</h2>');
        if (findings.length === 0) {
            html.push('<p>No deprecated variables detected.</p>');
        } else {
            html.push('<table><thead>');
            html.push('<tr><th>Item Name</th><th>Variable</th><th>Question Text</th><th>Type</th><th>Severity</th><th>Description</th></tr>');
            html.push('</thead><tbody>');
            for (var i = 0; i < findings.length; i++) {
                var item = findings[i];
                for (var j = 0; j < item.findings.length; j++) {
                    var f = item.findings[j];
                    var sevClass = 'severity-' + (f.severity || 'LOW').toLowerCase();
                    html.push('<tr>');
                    html.push('<td>' + this._escapeHtml(item.item_name || '') + '</td>');
                    html.push('<td>' + this._escapeHtml(f.variable || f.name || '') + '</td>');
                    html.push('<td>' + this._escapeHtml(f.question || '') + '</td>');
                    html.push('<td>' + this._escapeHtml(f.legacy_type || f.type || '') + '</td>');
                    html.push('<td class="' + sevClass + '"' + this._escapeHtml(f.severity || 'LOW') + '</td>');
                    html.push('<td>' + this._escapeHtml(f.type_description || f.missing || '') + '</td>');
                    html.push('</tr>');
                }
            }
            html.push('</tbody></table>');
        }

        // Order guide findings
        if (guides.length > 0) {
            html.push('<h2>Order Guide Findings</h2>');
            html.push('<table><thead>');
            html.push('<tr><th>Guide</th><th>Wizard</th><th>Severity</th></tr>');
            html.push('</thead><tbody>');
            for (var g = 0; g < guides.length; g++) {
                var og = guides[g];
                html.push('<tr>');
                html.push('<td>' + this._escapeHtml(og.guide || '') + '</td>');
                html.push('<td>' + this._escapeHtml(og.wizard || '') + '</td>');
                html.push('<td class="severity-medium">' + this._escapeHtml(og.severity || 'MEDIUM') + '</td>');
                html.push('</tr>');
            }
            html.push('</tbody></table>');
        }

        html.push('</body></html>');
        return html.join('');
    },

    /**
     * Generate CSV report from scan result.
     * @param {Object} scanResult
     * @returns {string} CSV content
     */
    renderCSV: function(scanResult) {
        var lines = [];
        var findings = scanResult.catalogFindings || [];
        var guides = scanResult.orderGuideFindings || [];

        lines.push('CFMS Audit Report');
        lines.push('Scan Date,' + (scanResult.scanDate || new Date().toISOString()));
        lines.push('Total Items,' + (scanResult.totalItems || 'N/A'));
        lines.push('Legacy Items,' + (scanResult.legacyItems || 'N/A'));
        lines.push('');
        lines.push('Item Name,Variable,Question Text,Type,Severity,Description');

        for (var i = 0; i < findings.length; i++) {
            var item = findings[i];
            for (var j = 0; j < item.findings.length; j++) {
                var f = item.findings[j];
                var cells = [
                    item.item_name || '',
                    f.variable || f.name || '',
                    f.question || '',
                    f.legacy_type || f.type || '',
                    f.severity || 'LOW',
                    f.type_description || f.missing || ''
                ];
                lines.push(cells.map(this._escapeCsv).join(','));
            }
        }

        if (guides.length > 0) {
            lines.push('');
            lines.push('Guide,Wizard,Severity');
            for (var g = 0; g < guides.length; g++) {
                var og = guides[g];
                lines.push([og.guide, og.wizard, og.severity].map(this._escapeCsv).join(','));
            }
        }

        return lines.join('\n') + '\n';
    },

    _escapeHtml: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/\u003c/g, '&lt;')
            .replace(/\u003e/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    _escapeCsv: function(str) {
        if (!str) return '';
        var s = String(str);
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    },

    type: 'CFMSReportRenderer'
};

if (typeof exports !== 'undefined') {
    exports.CFMSReportRenderer = CFMSReportRenderer;
}
