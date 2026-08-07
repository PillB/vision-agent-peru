# Round retrospectives and gate decisions

## Round 0 — baseline and rollback

Red: live routes and local scripts reproduced the suspected defects. Green was intentionally forbidden. Gate: pass; baseline commit and measurements captured before edits.

## Round 1 — truthfulness and safety

Red: negative controls showed concurrency, unrelated-person hazards, fake frame difference, threshold zero, allowlist bypass, production hooks, and unsupported claims. Green: authoritative sequential orchestrator, actual temporal pixels, rule isolation, static capability profile, and corrected copy. Refactor: active UI no longer imports the legacy prototype. Gate: pass on contract tests; model quality not promoted.

## Round 2 — reproducible verification

Red: missing `tsx`, hard-coded paths, Chromium-only shallow scripts, waits/force/direct-store mutation. Green: pinned test dependencies, Node test suites, five Playwright projects, accessible locators, deterministic labeled fixtures, failure artifacts, and CI. Refactor: package scripts are the canonical entry points. Gate: local non-browser suites pass; browser execution is gated on CI because authoring-environment browser binaries could not be downloaded.

## Round 3 — local semantic evidence search

Red: memory-only evidence and decorative selectors. Green: multi-video preflight, approval-before-hash, adaptive samples, YOLOS proposals, local two-stage tracks, crops, optional pinned CLIP, IndexedDB, query/filter/ranking, near misses, reference image, timeline, export, and delete. Refactor: adapters are explicit and revision-bearing. Gate: structure/control validated; model retrieval remains experimental.

## Round 4 — candidate association and absence

Red: appearance proxies were labeled identity and absence could be overconfident. Green: candidate-only vocabulary, open-set rejection, topology/time conflicts, visible human confirm/reject, mandated safe wording, coverage/failure reporting, inconclusive default. Refactor: the weighted score is named experimental fusion, not calibrated. Gate: pass for deterministic contracts; threshold calibration remains unresolved.

## Round 5 — agentic control and hardening

Red: advisory judge did not gate and missing APIs could be shown as successful. Green: ordered state machine, validated judge output, false-positive suppression, approvals, idempotency, verification, retry/compensation, circuit breaker, and unavailable external actions. Gate: source/unit/build pass; deployment and two quiet hosted rounds must append their evidence before release closure.
