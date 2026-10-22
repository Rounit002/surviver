#!/usr/bin/env node
/**
 * CLI Test Runner for Pure Browser Minecraft Java Edition Voxel Engine
 * Executes 4-tier test suites in headless Node.js environment.
 */

const path = require('path');
const fs = require('fs');

// Load Test Harness
const TestHarness = require('./test_harness.js');

// Parse CLI arguments
const args = process.argv.slice(2);
let tierFilter = null;
let nameFilter = null;
let jsonOutput = false;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) {
    tierFilter = args[++i];
  } else if (args[i] === '--filter' && args[i + 1]) {
    nameFilter = args[++i];
  } else if (args[i] === '--json') {
    jsonOutput = true;
  } else if (args[i] === '--verbose' || args[i] === '-v') {
    verbose = true;
  }
}

// Load test suite files
const testFiles = [
  { tier: '1', file: './tier1_features.test.js' },
  { tier: '2', file: './tier2_boundaries.test.js' },
  { tier: '3', file: './tier3_pairwise.test.js' },
  { tier: '4', file: './tier4_workloads.test.js' }
];

for (const tf of testFiles) {
  if (tierFilter && tf.tier !== tierFilter) {
    continue;
  }
  const resolved = path.resolve(__dirname, tf.file);
  if (fs.existsSync(resolved)) {
    require(resolved);
  }
}

// Run test suites
(async function main() {
  if (!jsonOutput) {
    console.log('======================================================================');
    console.log('  MINECRAFT JAVA EDITION VOXEL GAME - E2E TEST RUNNER (NODE HEADLESS)');
    console.log('======================================================================');
    if (tierFilter) console.log(`  Filtered Tier: Tier ${tierFilter}`);
    if (nameFilter) console.log(`  Filtered Pattern: ${nameFilter}`);
    console.log('');
  }

  const results = await TestHarness.runAllSuites({
    filter: nameFilter,
    verbose: verbose,
    onProgress(testResult) {
      if (!jsonOutput && verbose) {
        const icon = testResult.status === 'passed' ? '✓' : '✗';
        console.log(`  [${icon}] ${testResult.suiteName} > ${testResult.name} (${testResult.durationMs}ms)`);
        if (testResult.error) {
          console.error(`      Error: ${testResult.error.message}`);
        }
      }
    }
  });

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(results.failed > 0 ? 1 : 0);
  }

  console.log('----------------------------------------------------------------------');
  console.log('TEST EXECUTION SUMMARY:');
  console.log(`  Total Suites:   ${results.suites.length}`);
  console.log(`  Total Tests:    ${results.total}`);
  console.log(`  Passed Tests:   ${results.passed}`);
  console.log(`  Failed Tests:   ${results.failed}`);
  console.log(`  Skipped Tests:  ${results.skipped}`);
  console.log(`  Total Duration: ${results.durationMs} ms`);
  console.log('----------------------------------------------------------------------');

  if (results.failed > 0) {
    console.log('\nFAILED TEST DETAILS:');
    for (const suite of results.suites) {
      for (const t of suite.tests) {
        if (t.status === 'failed') {
          console.log(`\n✖ ${t.suiteName} > ${t.name}:`);
          console.log(`  ${t.error.message}`);
          if (t.error.stack) {
            console.log(`  ${t.error.stack.split('\n').slice(1, 4).join('\n  ')}`);
          }
        }
      }
    }
    console.log('\nTEST RESULT: FAILED');
    process.exit(1);
  } else {
    console.log('\nTEST RESULT: ALL TESTS PASSED SUCCESSFULLY! (100% PASS)');
    process.exit(0);
  }
})();
