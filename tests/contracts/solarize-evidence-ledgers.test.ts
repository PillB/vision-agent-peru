import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const evidenceRoot = join(process.cwd(), 'docs/solarize/vision-agent-evidence-search-rebuild')

const requiredLedgers = [
  'research_ledger.json',
  'competitor_capability_matrix.json',
  'capability_truth_ledger.json',
  'use_case_registry.json',
  'use-case-evidence-contracts.json',
  'model_registry.json',
  'model_supply_chain.json',
  'model_license_registry.json',
  'runtime_adapter_registry.json',
  'dataset_registry.json',
  'retrieval_benchmark_ledger.json',
  'tracking_benchmark_ledger.json',
  'association_benchmark_ledger.json',
  'absence_benchmark_ledger.json',
  'agent_policy_registry.json',
  'action_tool_registry.json',
  'claim_registry.json',
  'privacy_risk_registry.json',
  'playwright_coverage_ledger.json',
  'issue_registry.json',
  'decision_registry.json',
  'rejected_hypotheses.json',
  'test_ledger.json',
  'failure_registry.json',
  'evidence_ledger.json',
  'deployment_verification.json',
]

test('all Solarize persistent JSON ledgers exist and parse', () => {
  for (const filename of requiredLedgers) {
    const parsed = JSON.parse(readFileSync(join(evidenceRoot, filename), 'utf8')) as { schemaVersion?: string }
    assert.ok(parsed.schemaVersion, `${filename} must declare schemaVersion`)
  }
})

test('every advertised capability has the complete truth-ledger contract', () => {
  const ledger = JSON.parse(readFileSync(join(evidenceRoot, 'capability_truth_ledger.json'), 'utf8')) as {
    capabilities: Array<Record<string, unknown>>
  }
  const fields = [
    'capabilityId', 'userProblem', 'implementation', 'executionMode', 'modelOrRule',
    'modelRevision', 'adapter', 'input', 'output', 'validationDataset', 'metrics',
    'limitations', 'privacyClass', 'status', 'tests', 'evidence',
  ]
  for (const capability of ledger.capabilities) {
    for (const field of fields) assert.ok(field in capability, `${String(capability.capabilityId)} missing ${field}`)
  }
})

test('benchmark ledgers preserve unknown quality metrics as null', () => {
  const retrieval = JSON.parse(readFileSync(join(evidenceRoot, 'retrieval_benchmark_ledger.json'), 'utf8')) as { metrics: Record<string, unknown> }
  const tracking = JSON.parse(readFileSync(join(evidenceRoot, 'tracking_benchmark_ledger.json'), 'utf8')) as { metrics: Record<string, unknown> }
  const association = JSON.parse(readFileSync(join(evidenceRoot, 'association_benchmark_ledger.json'), 'utf8')) as { metrics: Record<string, unknown> }
  assert.equal(retrieval.metrics.recallAt1, null)
  assert.equal(tracking.metrics.hota, null)
  assert.equal(association.metrics.calibrationError, null)
})
