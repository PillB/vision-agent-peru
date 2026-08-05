# Model Candidate Tournament — Vision Agent Peru
## Round 2

## Tournament Results

### 1. Person/Vehicle Detection (replacing COCO-SSD)

| Candidate | Size | Bboxes? | License | Browser-Ready | Verdict |
|---|---|---|---|---|---|
| COCO-SSD (baseline) | 27MB | ✅ | Apache-2.0 | ✅ | BASELINE — kept as fallback |
| onnx-community/yolov10n | 2.53MB | ✅ | AGPL-3.0 | ✅ | **ACCEPTED** — 10× smaller |
| onnx-community/yolo26n-ONNX | 2.72MB | ✅ | AGPL-3.0 | ✅ | Rejected — same as yolov10n but no transformers.js tag |
| Xenova/yolos-tiny | 7.12MB | ✅ | Apache-2.0 | ✅ | Backup — best non-AGPL option |
| Xenova/detr-resnet-50 | 41MB | ✅ | Apache-2.0 | ✅ | Rejected — too heavy (41MB) |

**Winner: yolov10n** (2.53MB, 10× smaller than COCO-SSD)
**Metric: model size + inference speed (smaller = faster on WASM)**

### 2. Fire/Smoke Detection

| Candidate | Size | Bboxes? | License | Browser-Ready | Verdict |
|---|---|---|---|---|---|
| prithivMLmods/Fire-Detection-Engine-ONNX (baseline) | 50MB | ❌ | Apache-2.0 | ✅ | BASELINE — kept (classification works) |
| rabahdev/fire-smoke-yolov8n | 3MB | ✅ | AGPL-3.0 | ❌ | Pending ONNX export — best localizer |
| pyronear/yolo11s_sensitive-detector | 31MB | ✅ | Apache-2.0 | ❌ | Needs config.json extraction |

**Winner: Fire Detection Engine (baseline retained)** — no browser-ready localizer available yet
**Action: Export rabahdev model to ONNX for Round 3**

### 3. Flood Detection

| Candidate | Size | Bboxes? | License | Browser-Ready | Verdict |
|---|---|---|---|---|---|
| CLIP zero-shot (baseline) | 153MB | ❌ | Apache-2.0 | ✅ | BASELINE — very heavy |
| Xenova/segformer-b0-ade | 4.21MB | mask ✅ | Apache-2.0 | ✅ | **ACCEPTED** — true segmentation, 36× smaller |

**Winner: segformer-b0-ade** (4.21MB, true water segmentation)
**Metric: pixel-level water mask vs. whole-frame classification**

### 4. Fall/Slip Detection

| Candidate | Size | Bboxes? | License | Browser-Ready | Verdict |
|---|---|---|---|---|---|
| CLIP zero-shot (baseline) | 153MB | ❌ | Apache-2.0 | ✅ | BASELINE — cannot detect actual falls |
| Xenova/yolov8n-pose | 3.58MB | ✅+keypoints | AGPL-3.0 | ✅ | **ACCEPTED** — 17 keypoints, fall kinematics |

**Winner: yolov8n-pose** (3.58MB, actual pose detection for fall kinematics)
**Metric: keypoint detection enables actual fall detection vs. CLIP guessing**

### 5. Crack Detection

| Candidate | Size | Bboxes? | License | Browser-Ready | Verdict |
|---|---|---|---|---|---|
| CLIP zero-shot (baseline) | 153MB | ❌ | Apache-2.0 | ✅ | BASELINE — no localization |
| cazzz307/yolov8-crack-detection | 3MB | ✅ | MIT | ❌ | Pending ONNX export — best crack localizer |

**Winner: CLIP (baseline retained)** — no browser-ready crack localizer yet
**Action: Export cazzz307 model to ONNX for Round 3**

## Summary

| Use Case | Baseline | Recommended | Size Reduction | Status |
|---|---|---|---|---|
| Person/vehicle | COCO-SSD (27MB) | yolov10n (2.5MB) | 91% | Ready to integrate |
| Fire/smoke | Fire ViT (50MB) | Keep baseline | 0% | Pending ONNX export |
| Flood | CLIP (153MB) | SegFormer-B0 (4.2MB) | 97% | Ready to integrate |
| Fall/slip | CLIP (153MB) | YOLOv8n-pose (3.6MB) | 98% | Ready to integrate |
| Crack | CLIP (153MB) | Keep baseline | 0% | Pending ONNX export |
| Graffiti/landslide | CLIP (153MB) | Keep baseline | 0% | No better browser-ready alternative |

## Rejected Candidates Registry
- YOLO26n: same as YOLOv10n, no transformers.js tag
- DETR-resnet-50: 41MB, too heavy
- AdamCodd/yolos-small-person: 117MB, no quant variant
- SHOU-ISD/fire-and-smoke: mAP 0.449 (weak)
- TommyNgx/YOLOv10-Fire: 61MB (too heavy)
- peyterho/flood-depth-unet: 93MB, PyTorch only
- All CSRNet/MCNN crowd counting: PyTorch only, 0 downloads

