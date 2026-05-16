// Copyright (c) 2026 Vladimir Kapustin
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * test_cfms_scanner.js
 * Unit + E2E tests for CFMSScanner + CFMSEngine.
 * Self-contained mocks.
 */

const fs = require('fs');
const assert = require('assert');

// === Mock ServiceNow Runtime (reused pattern) ===
global.Class = {
  create: function() {
    var cls = function() { if (this.initialize) this.initialize.apply(this, arguments); };
    return cls;
  }
};

function MockGR(table, rows) { this._rows = rows||[]; this._idx = -1; this._filters = {}; this._limit = null; this._filtered = []; }
MockGR.prototype.addQuery = function(f,v) { this._filters[f] = v; };
MockGR.prototype.setLimit = function(n) { this._limit = n; };
MockGR.prototype.query = function() { this._idx = -1; this._filtered = this._rows.filter((r)=>{ for(var k in this._filters){ if(String(r[k]||'') !== String(this._filters[k])) return false; } return true; }); };
MockGR.prototype.next = function() { this._idx++; if(this._limit&&this._idx>=this._limit) return false; return this._idx<this._filtered.length; };
MockGR.prototype.getValue = function(f) { if(this._idx>=0&&this._idx<this._filtered.length) return String(this._filtered[this._idx][f]||""); return ""; };
MockGR.prototype.getUniqueValue = function() { if(this._idx>=0&&this._idx<this._filtered.length) return this._filtered[this._idx]["sys_id"]||"mock-id"; return "mock-id"; };
MockGR.prototype.isValidRecord = function() { return this._idx>=0&&this._idx<this._filtered.length; };

global.GlideRecord = function(table) { if(DB[table]) return new MockGR(table, DB[table]); return new MockGR(table); };
global.GlideDateTime = function(v){ this._v=v||new Date().toISOString(); this.getDisplayValue=function(){return this._v;}; this.getDisplayValueInternal=function(){return this._v.replace(/[-:T.Z]/g,"");}; };
global.gs = {
  info: function(msg){ console.log('[gs.info] ' + msg); },
  warn: function(msg){ console.log('[gs.warn] ' + msg); },
  error: function(msg){ console.log('[gs.error] ' + msg); }
};

function stripHeader(code){ return code.replace(/^\/\*.*?\*\//s, ''); }

// === Mock Database ===
var DB = {
  "sc_cat_item": [
    { sys_id: "item1", name: "Laptop Request" },
    { sys_id: "item2", name: "Access Request" },
    { sys_id: "item3", name: "Legacy Macro Form" }
  ],
  "item_option_new": [
    { cat_item: "item1", name: "laptop_model", type: "choice", question_text: "Choose model", sys_id: "opt1" },
    { cat_item: "item1", name: "macro_field", type: "macro", question_text: "Macro", sys_id: "opt2" },
    { cat_item: "item2", name: "manager_approval", type: "break", question_text: "Break", sys_id: "opt3" },
    { cat_item: "item3", name: "macro_var", type: "macro", question_text: "Legacy macro", sys_id: "opt4" },
    { cat_item: "item3", name: "container_start", type: "container_start", question_text: "Start", sys_id: "opt5" }
  ],
  "sc_cat_item_guide": [
    { name: "Onboarding Guide", wizard: "legacy_wizard" },
    { name: "Offboarding Guide", wizard: "" }
  ]
};

// Load modules
eval(stripHeader(fs.readFileSync('/home/crixus/agentic-loop/output/CFMS/src/CFMSScanner.js','utf8')));
eval(stripHeader(fs.readFileSync('/home/crixus/agentic-loop/output/CFMS/src/CFMSEngine.js','utf8')));

// ============================================================================
// TESTS
// ============================================================================

function testScannerDetectsLegacyVars() {
  var scanner = new CFMSScanner();
  var result = scanner.runFullScan();

  console.log("  totalItems:", result.totalItems);
  console.log("  legacyItems:", result.legacyItems);

  assert.strictEqual(result.totalItems, 3, "Expected 3 catalog items");
  assert.strictEqual(result.legacyItems, 3, "Expected all 3 have legacy var findings");

  var item1 = result.catalogFindings.find(function(f){ return f.item_sys_id === "item1"; });
  assert(item1, "item1 should have findings");
  assert(item1.findings.some(function(f){ return f.type === "LEGACY_VARIABLE"; }), "item1 should have LEGACY_VARIABLE");
  console.log("  testScannerDetectsLegacyVars PASSED");
}

function testScannerFindsOrderGuideWizards() {
  var scanner = new CFMSScanner();
  var result = scanner.runFullScan();
  assert.strictEqual(result.orderGuideFindings.length, 1, "Expected 1 deprecated guide wizard");
  assert.strictEqual(result.orderGuideFindings[0].guide, "Onboarding Guide");
  console.log("  testScannerFindsOrderGuideWizards PASSED");
}

function testEngineCalculatesScore() {
  var scanner = new CFMSScanner();
  var result = scanner.runFullScan();
  var engine = new CFMSEngine();
  var item3 = result.catalogFindings.find(function(f){ return f.item_sys_id === "item3"; });
  assert(item3, "item3 should exist");
  var score = engine.calculateItemScore(item3.findings);
  assert(score.score >= 0 && score.score <= 100, "Score should be 0-100");
  assert(score.severity !== "low", "item3 has 3 findings, severity should be >= medium");
  assert(score.hours > 0, "Should estimate remediation hours");
  console.log("  testEngineCalculatesScore PASSED (score=" + score.score + ", severity=" + score.severity + ", hours=" + score.hours + ")");
}

function testEngineRanksItems() {
  var scanner = new CFMSScanner();
  var result = scanner.runFullScan();
  var engine = new CFMSEngine();
  var ranked = engine.rankItems(result.catalogFindings);
  assert.strictEqual(ranked.length, result.catalogFindings.length, "Ranked count should match");
  assert(ranked[0].score <= ranked[ranked.length-1].score, "Should be sorted ascending by score (worst first)");
  console.log("  testEngineRanksItems PASSED");
}

function testFindingsHaveMandatoryMissing() {
  // Create a DB where a var has empty name (missing mandatory)
  DB["item_option_new_backup"] = DB["item_option_new"];
  DB["item_option_new"] = [
    { cat_item: "item1", name: "", type: "choice", question_text: "", sys_id: "opt_missing" }
  ];
  var scanner = new CFMSScanner();
  var result = scanner.runFullScan();
  var item1 = result.catalogFindings.find(function(f){ return f.item_sys_id === "item1"; });
  assert(item1, "item1 still found");
  assert(item1.findings.some(function(f){ return f.type === "MISSING_MANDATORY_FIELD"; }), "Should detect missing mandatory fields");
  // restore
  DB["item_option_new"] = DB["item_option_new_backup"];
  delete DB["item_option_new_backup"];
  console.log("  testFindingsHaveMandatoryMissing PASSED");
}

// === RUN ALL ===
console.log("Running CFMS tests...\n");
testScannerDetectsLegacyVars();
testScannerFindsOrderGuideWizards();
testEngineCalculatesScore();
testEngineRanksItems();
testFindingsHaveMandatoryMissing();
console.log("\nAll 5 CFMS tests PASSED");
