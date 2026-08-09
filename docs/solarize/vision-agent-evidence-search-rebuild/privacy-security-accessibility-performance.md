# Privacy, security, accessibility, and performance report

## Privacy

The normal evidence index is local IndexedDB and contains identifiable scene crops, track IDs, source/camera metadata, timestamps, and optional embeddings. It excludes facial templates, watchlists, age, perceived gender, race, body-proportion, and gait fields. Sensitive or research-only queries are rejected before retrieval. Track IDs reset per video; association candidates never establish identity. Startup purging enforces a best-effort 24-hour window for evidence, video, track, and association stores, while explicit reset deletes the local database. Browser eviction, backups, screen capture, downloaded exports, and devices shared by multiple people remain privacy risks.

## Security

GitHub Pages has a static capability profile. Removed API routes are not called; PowerPoint server-export controls are disabled. External actions require both a secure-service profile and explicit approval. Policy and allowlist checks occur again at execution. Idempotency keys, circuit breakers, verification, retry bounds, and compensation are implemented. Remaining risks include supply-chain delivery of browser model files, malicious video decoder inputs, XSS elsewhere in the host application, and unencrypted exported JSON at rest.

## Accessibility

The canonical suite uses visible controls and accessible roles/labels. It includes keyboard destination navigation, Chromium/Firefox/WebKit desktop, tablet/mobile Chromium, reduced motion, 200% zoom, and axe checks for serious/critical violations. Local execution could list all 55 project cases, but installed browser binaries were unavailable in the authoring sandbox; CI installation and results are the release gate. Manual screen-reader and cognitive walkthrough remain required before any production-readiness claim.

## Performance

Round 0 measured the old live prototype at about 0.1 cycles/s and 7301 ms displayed latency. The rebuild does not claim 10 FPS, fixed latency, or speedup. Adaptive sampling bounds work to 240 frames per video in the UI and reports an estimate before approval. Model load, decoding, device memory, source resolution/duration, WebGPU availability, IndexedDB quotas, and thermal throttling dominate. The immutable YOLOS and CLIP adapters have no completed held-out browser benchmark; their metrics are deliberately `null` in the benchmark artifact.

## Acceptance status

Static/local control correctness is validated by unit and contract tests. Accessibility and browser behavior are pending CI/deployment evidence until the hosted run completes. Model accuracy and performance remain experimental. This report does not convert missing evidence into a pass.
