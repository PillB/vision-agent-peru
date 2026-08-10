# Visualization and tracking architecture review — 2026-08-09

## Scope and safety boundary

This review covers local, within-feed track IDs, annotations, and co-occurrence visualization. A track ID is not a verified identity. Unknown people must remain unknown; automatic bystander enrollment and cross-camera identity claims are out of scope. Deliberate owner enrollment requires a separate, consent-gated one-to-one verification flow with revocation, retention, audit, and false-accept/false-reject evaluation.

## Primary evidence

- [ByteTrack (ECCV 2022)](https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136820001.pdf) associates lower-confidence detections with existing tracklets rather than discarding them. Design implication: low-confidence boxes may preserve a track but must not create a new track. The repository's `byte-track.ts` contract follows this distinction.
- [HOTA](https://pmc.ncbi.nlm.nih.gov/articles/PMC7881978/) separates detection accuracy from association accuracy and combines them geometrically. Design implication: do not present a single opaque “tracking accuracy” number; retain component metrics and benchmark detection and association separately.
- [Temporal constraints for ReID (WACV 2022)](https://openaccess.thecvf.com/content/WACV2022W/RWS/html/Dietlmeier_Improving_Person_Re-Identification_With_Temporal_Constraints_WACVW_2022_paper.html) reports substantial gains from timestamp-aware re-ranking. Design implication: time gaps and camera/source continuity are first-class association inputs, not display-only metadata.
- [Domain shifts in person ReID (CVPRW 2024)](https://openaccess.thecvf.com/content/CVPR2024W/CLVISION/html/Nguyen_Tackling_Domain_Shifts_in_Person_Re-Identification_A_Survey_and_Analysis_CVPRW_2024_paper.html) identifies cross-dataset and attribute shifts as unresolved deployment risks. Design implication: appearance similarity must abstain under lighting, viewpoint, clothing, and camera changes until locally calibrated.
- [Privacy-enhancing ReID (WACV 2024)](https://openaccess.thecvf.com/content/WACV2024/html/Kansal_Privacy-Enhancing_Person_Re-Identification_Framework_-_A_Dual-Stage_Approach_WACV_2024_paper.html) demonstrates that ReID features can encode personally identifiable information. Design implication: embeddings require local-only storage, retention limits, deletion, access controls, and privacy evaluation; “embeddings are anonymous” is not an acceptable claim.
- [face-api.js browser recognition](https://github.com/justadudewhohacks/face-api.js/) provides aligned face detection, 128-value descriptors, and Euclidean one-to-one matching. Its published LFW result is evidence about the upstream benchmark, not calibration evidence for this application, population, camera, or threshold. Design implication: keep the owner flow opt-in, session-memory-only, exact-one-face, reject-capable, revocable, and explicitly outside access control until local false-accept, false-reject, and liveness testing exists.
- [Geometry-based edge clustering (IEEE TVCG 2008)](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/bundling.pdf) reduces graph clutter through edge grouping and opacity/color techniques. [Edge-Path Bundling (IEEE VIS 2021)](https://virtual.ieeevis.org/year/2021/paper_v-full-1368.html) warns that bundling can imply nonexistent connections. Design implication: filter weak edges before considering bundling, preserve inspectable pair rows, and use detail-on-demand for dense networks.

## Ranked strategy

1. **Local tracking-by-detection with explicit uncertainty — selected.** It is browser-feasible, inspectable, compatible with existing detectors, and does not claim identity. Measure DetA/AssA-style components on labeled clips before tuning thresholds.
2. **Consent-gated owner one-to-one verification — conditional.** Architect separately from tracking. Require explicit enrollment and a reject/unknown result; never convert it into open-set identification.
3. **Appearance-assisted tracklet association — experimental.** Use only to propose local candidates with calibrated thresholds and temporal constraints. Keep the permanent appearance-similarity disclaimer.
4. **Open-world or cross-camera person identification — rejected for this product boundary.** It creates privacy, consent, domain-shift, and false-match risks that the current local prototype cannot substantiate.

## Visualization decisions implemented

- Bounding boxes are drawn before labels so label text remains on top.
- Labels are compact, canvas-clamped, and placed in a stable candidate order to reduce jitter.
- Higher-confidence labels reserve space first; a lower-priority label is hidden when every placement would collide. Its box remains visible, preventing silent removal of the observation.
- Graph nodes expose appearance-session count and observed duration.
- Graph edges expose joint encounter count, shared frames, shared duration, average normalized proximity, and a component-based weight:

  `weight = 0.35 × frame Jaccard + 0.25 × duration ratio + 0.25 × proximity + 0.15 × encounter recurrence`

  The weights are an initial explainable heuristic, not calibrated probabilities. Calibration must compare alternatives on labeled local clips and report sensitivity.
- Dense graphs rank subjects by observation count, show at most 12 nodes, retain at most three displayed links per node, and label only the five strongest edges. The complete network counts and strongest pair table remain visible, avoiding both a hairball and a false claim that filtered entities disappeared from the data.
- Owner verification is separate from appearance tracking. It requires explicit consent, three aligned enrollment samples, an exact-one-face quality gate, a conservative native-descriptor distance threshold of 0.50, an unknown/reject state, memory-only storage, and immediate deletion. Playwright validates same-face acceptance, different-face rejection, no-face rejection, permission denial, and media-track cleanup. It does not provide liveness and is not an access-control credential.

## Next validation gates

1. Build a labeled fixture matrix for every use case with expected positive class, negative controls, localization expectation, and acceptable threshold range.
2. Measure detection and association separately (including fragmentation, ID switches, false tracks, and abstentions).
3. Stress annotations at multiple canvas sizes and object densities; quantify hidden-label rate and ensure selected/hover detail can reveal suppressed labels.
4. Compare graph-weight sensitivity across balanced, duration-heavy, proximity-heavy, and recurrence-heavy formulations.
5. Before owner verification is promoted beyond prototype status, build a consented local evaluation set and report false accepts and false rejects across lighting, pose, masks, hats, occlusion, replay attempts, demographic slices, revocation, and retention deletion. Add liveness or retain the explicit non-credential boundary.
