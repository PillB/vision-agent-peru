# Use-Case Truth Matrix — Vision Agent Peru
## Round 1 Audit (frozen baseline)

| # | Use Case | Phenomenon | Positive Event | Negative | Model/Heuristic | Rule | Claim Discrepancy | Readiness |
|---|----------|-----------|----------------|----------|-----------------|------|-------------------|-----------|
| 1 | intrusion | Person/vehicle enters ROI | Detection centroid inside polygon | Outside ROI | COCO-SSD person/car/truck | roi_breach | None | Working |
| 2 | after_hours | Vehicle detected 20:00-06:00 | Vehicle in time window | Outside time window | COCO-SSD car/truck/bus | time_gate | None | Working |
| 3 | crowd_surge | Sudden person count increase | z-score > 2.5 sustained 3 cycles | Normal traffic | COCO-SSD person count + z-score | density_anomaly | None | Working |
| 4 | parking | Vehicle count in parking ROI | Count change = space freed/occupied | No change | COCO-SSD car/truck | count_threshold | Claims "available spaces" but only counts vehicles, no per-slot logic | Partial |
| 5 | queue_anomaly | Long queue at ATM zone | z-score > 2 sustained 2 cycles | Normal queue | COCO-SSD person count + z-score | density_anomaly | None | Working |
| 6 | abandoned_object | Static luggage > 60s | Object detected sustained 5 ticks | Person nearby | COCO-SSD backpack/suitcase/handbag | sustain_verify | Claims 60s but sustainTicks=5 = 7.5s; no owner-separation logic | Partial |
| 7 | graffiti | Vandalism on wall | CLIP detects graffiti labels | Clean wall | CLIP zero-shot | frame_diff | Cannot distinguish pre-existing graffiti from new vandalism | Partial |
| 8 | fire_smoke | Fire/smoke in frame | Fire Detection ViT > 50% or CLIP > 15% | Normal scene | Fire Detection Engine + CLIP + pixel-anomaly | sustain_verify | None | Working |
| 9 | slip_hazard | Wet surface or person falling | CLIP detects slip/fall labels | Dry floor, standing person | CLIP zero-shot | frame_diff | Wet surfaces and falls are different phenomena; no pose estimation | Partial |
| 10 | incident_description | LLM describes incident | Any detection triggers LLM | No detection | COCO-SSD + LLM judge | count_threshold | None | Working |
| 11 | auto_report | Auto-generate incident report | Density anomaly triggers report | Normal | COCO-SSD + LLM | density_anomaly | None | Working |
| 12 | visual_memory | Similar incident search | Claims CLIP embeddings | N/A | COCO-SSD only (no embeddings) | density_anomaly | Claims "CLIP embeddings" but has NO embedding/retrieval code; roadmap only | NOT WORKING |
| 13 | flood_watch | Water/flood in scene | CLIP detects flood labels | Dry street | CLIP zero-shot + pixel-anomaly | frame_diff | Claims "water segmentation + level measurement" but only has classification | Partial |
| 14 | landslide_watch | Terrain movement | CLIP detects landslide labels | Stable terrain | CLIP zero-shot + pixel-anomaly | frame_diff | Claims "optical flow" but not implemented | Partial |
| 15 | post_quake | Structural crack/spall | CLIP detects crack labels | Intact wall | CLIP zero-shot + pixel-anomaly | frame_diff | Claims "YOLOv11 crack/spall/rebar" but uses CLIP; no YOLO model | Partial |

## Summary
- **Working correctly:** 6 use cases (1,2,3,5,8,10)
- **Partial (claim discrepancy):** 8 use cases (4,6,7,9,11,13,14,15)
- **NOT WORKING:** 1 use case (12 — visual_memory has no embedding code)

## Critical Claim-to-Code Discrepancies (must fix)
1. **post_quake** description says "YOLOv11" but uses CLIP — MISLEADING
2. **flood_watch** description says "segmentation + level measurement" but only has classification — MISLEADING
3. **visual_memory** claims "CLIP embeddings" but has no embedding code — NON-FUNCTIONAL
4. **slip_hazard** combines wet surfaces and falls — should be separate signals
5. **abandoned_object** claims 60s but actually uses 7.5s — INCORRECT
6. **parking** claims "available spaces" but only counts vehicles — INCOMPLETE
