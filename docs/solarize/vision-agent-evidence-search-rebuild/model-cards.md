# Model cards

## YOLOS-tiny detector — experimental

Purpose: COCO object proposals for authorized, user-provided videos. Revision: `1a00cc14a139ff40bac9aa00c745915cb7b5b751`. Backend: WASM. Output: label, confidence, bounding box. It does not detect fire, flood, graffiti, landslide, slips, or structural safety from a person box. Known limits: small/occluded objects, domain shift, decoder quality, browser memory, and unvalidated thresholds. It may propose a local track; it cannot establish identity or authorize an action.

## CLIP ViT-B/32 retrieval — experimental

Purpose: optional text-to-crop and reference-image-to-crop similarity. Revision: `91f7a4bfa256ca85b019500008a355e2da0fe641`. Backend: WASM by default, WebGPU only when available. Scores are cosine similarities, not probabilities. No surveillance-domain precision/recall, demographic fairness, or open-set calibration result exists. The deterministic query parser rejects sensitive traits before embedding.

## Two-stage local tracker — experimental

Purpose: within-video track continuity. The implementation first associates high-confidence detections, then permits low-confidence detections to recover an existing track without creating one. IDs reset for every video. It has no Kalman filter or globally optimal assignment and is not described as full ByteTrack or BoT-SORT.

## Pixel temporal difference — validated rule primitive

Purpose: motion/scene-change sampling. It compares actual pixels between consecutive frames scoped to source and use case. It is not an object detector and cannot, alone, prove a hazardous event.
