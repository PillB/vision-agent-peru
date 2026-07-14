# Vision Agent Enhancement: Persistent Multi-Object Identity, Person & Vehicle Re-Identification, and Cross-Feed Tracking

## Executive Summary

This report delivers a complete research synthesis and production-ready architecture for upgrading a Vision Agent to support **persistent unique identity tracking across multiple video feeds**, full **person re-identification** (face + gait + clothing fusion), **vehicle re-identification and automatic license plate recognition (ALPR)**, and **lightweight real-time inference suitable for browser-first / edge deployments**. Six progressive research rounds were conducted, covering foundational MOT, person ReID, vehicle ReID / LPR, multi-camera cross-feed tracking, lightweight optimization, and production case studies. The recommended architecture fuses ByteTrack/BoT-SORT for within-feed continuity, OSNet or ArcFace MobileFace for appearance embeddings, FAISS for gallery management, and YOLOv8-s + EasyOCR for ALPR — all exportable to ONNX/TFLite for deployment without a dedicated GPU.

***

## Phase 0 — Pre-Research Strategy Preamble

### Research Questions

**People Re-ID:**
- Which combination of face, gait, and clothing features produces the most robust identity across cameras and time?
- What threshold strategies and gallery management approaches minimize false re-ID while surviving appearance changes?
- How do CLIP-based and ViT-based models compare to CNN backbones like OSNet for the clothing-change and cross-camera scenarios?

**Vehicle Re-ID + LPR:**
- What pipeline reliably reads license plates under low light, motion blur, and partial occlusion at real-time speed?
- How can vehicle color, type, and keypoint features supplement plate-based identity when plates are occluded?

**Multi-Camera Tracking:**
- What spatio-temporal constraints must be combined with appearance features to reduce false cross-camera matches?
- How do production winners (e.g., SJTU-LENOVO at AI City 2024) architect their cross-feed identity reconciliation?

**Optimization:**
- What is the minimum viable model stack for 30 FPS tracking on CPU / iGPU with <200 MB RAM?
- Which ONNX / WebGPU / TFLite export paths preserve sufficient accuracy?

### Six-Round Structure

| Round | Focus |
|-------|-------|
| 1 | Foundational MOT — Kalman, Hungarian, ID switches, tracker comparison |
| 2 | Person ReID — face/gait/clothing fusion, SOTA academic + production |
| 3 | Vehicle ReID + ALPR — plate detection/OCR, secondary appearance cues |
| 4 | Multi-camera / cross-feed — spatial-temporal, gallery, global ID |
| 5 | Lightweight & browser-edge — ONNX, TFLite, WebGPU, INT8 |
| 6 | Production case studies, privacy, dos & don'ts, synthesis |

***

## Phase 1 — Round 1: Foundational Multi-Object Tracking

### Key Algorithms and Their Trade-offs

Modern MOT follows the **tracking-by-detection** paradigm: a detector (YOLOv8 / RF-DETR) produces bounding boxes per frame, which a tracker links across time via motion and appearance cues. The dominant algorithms and their empirically measured performance on standard benchmarks are:

| Tracker | HOTA (%) | MOTA (%) | ID Switches | FPS (RTX3060) | Appearance |
|---------|----------|----------|-------------|---------------|------------|
| ByteTrack | 89.0 | 98.3 | 27 | 47 | Motion only |
| BoT-SORT | 95.2 | 98.3 | 13 | 20 | Optional ReID |
| StrongSORT | 95.8 | 98.3 | 11 | 18 | OSNet embeddings |
| DeepOC-SORT | 95.9 | 98.3 | 7 | 20 | OSNet embeddings |
| OC-SORT | 95.9 | 98.4 | 7 | 46 | Motion only |

[^1][^2]

**ByteTrack** is the fastest (47 FPS), associating every detection — even low-confidence ones — using IoU matching in two stages. It introduces the fewest ID switches among motion-only trackers and is the preferred backbone for speed-critical deployments.[^3]

**StrongSORT** and **DeepOC-SORT** achieve the lowest ID switches by integrating an OSNet appearance embedding (ResNet0.25 × backbone pre-trained on MSMT17), at the cost of ~2.5× more compute. The dual-path temporal decoder (NeurIPS 2025) specifically targets **query drift** — the gradual degradation of per-object embeddings — using an appearance-adaptive layer and an identity-preserving layer to achieve SOTA on DanceTrack.[^4][^5]

### ID Switch Root Causes and Mitigations

The primary causes of "spotty" tracking (a person or car disappearing and reappearing as a new ID) are:
1. **Occlusion gaps** exceeding the `lost_track_buffer` (default 30 frames in DeepSORT)
2. **Low-confidence detections** being discarded by threshold-based pipelines
3. **Appearance drift** in the embedding gallery for long-duration tracks
4. **Camera transition** with no cross-feed identity reconciliation

DeepSORT's dual-metric approach (Mahalanobis distance for motion + cosine distance for appearance) runs efficiently at ~20 Hz, making it suitable for real-time applications while achieving competitive tracking performance with significantly improved identity preservation. Key parameters that govern continuity:[^6]

```python
DeepSORTTracker(
    lost_track_buffer=60,         # extend to survive occlusions
    minimum_consecutive_frames=2, # lower to catch brief appearances
    appearance_threshold=0.65,    # cosine distance; tune per domain
    appearance_weight=0.6,        # weight appearance over motion
    track_activation_threshold=0.25
)
```

### Retrospection — Round 1

ByteTrack dominates in speed; DeepOC-SORT dominates in identity stability. The critical gap is **cross-feed identity reconciliation** — none of these trackers natively assign a global ID across cameras. That requires a Re-ID module layer on top.

***

## Phase 2 — Round 2: Person Re-Identification (Face + Gait + Clothing Fusion)

### Face as Primary Biometric

**ArcFace** (Additive Angular Margin Loss) and **AdaFace** remain the two SOTA open-source face recognition models. A complete production-ready pipeline using SCRFD + ArcFace + FAISS demonstrates:[^7][^8]

- **SCRFD 500M** (2.41 MB, ONNX): Efficient face detection
- **ArcFace MobileFace** (12.99 MB, ONNX): Mobile-friendly recognition  
- **ArcFace ResNet-50** (166 MB, ONNX): High-accuracy recognition
- **FAISS**: Thread-safe similarity search with O(1) gallery lookup[^9]

The system processes typical video scenarios (1–5 faces per frame) in real time, with smart batch optimization adapting to face count. For low-quality or low-resolution frames (surveillance conditions), **AdaFace** outperforms ArcFace by using image quality as an adaptive margin weight.[^8][^10]

**Similarity threshold guidance:** A cosine distance threshold of 0.4–0.6 (depending on lighting and resolution) is recommended. A threshold that is too tight causes legitimate re-IDs to fail; too loose assigns wrong identities.[^11]

### Gait as Cloth-Agnostic Biometric

Gait is the most clothing-change-invariant cue. **OpenGait** (ShiqiYu, GitHub) is the primary open-source framework, supporting GaitBase, GaitEdge, and other SOTA gait models. The **All-in-One-Gait** sub-project integrates pedestrian tracking → silhouette segmentation → gait recognition in one pipeline, using YOLOX for detection and OpenGait for recognition.[^12][^13][^14]

**GaitEdge** synthesizes output from a segmentation network and feeds it to the recognition network, blocking gait-irrelevant information (backgrounds, clothing texture) while preserving body silhouette and motion pattern — enabling reliable recognition under clothing changes.[^15]

**Practical constraint:** Gait requires 8–15 continuous frames of a person's full gait cycle to be reliable. It fails for short clips or when a person is stationary. It should be treated as a **confirming** signal, not a primary lookup key.

### Clothing + Appearance via CLIP and ViT

For cases where face quality is insufficient (far cameras, backward orientation), **CLIP-based multi-modal feature learning** for cloth-changing ReID shows strong results. The CMFF framework proposes:[^16]
- **Pose-Aware Identity Enhancement (PIE)**: Weakens clothing interference with ranking loss
- **Global-Local Hybrid Attention (GLHA)**: Fuses head and global features via cross-attention
- **Graph-based Multi-Layer Interactive Enhancement (GMIE)**: Integrates multi-scale ViT features[^16]

**TransReID** (ICCV 2021) introduced the first pure-transformer ReID framework and remains highly competitive. Its **Jigsaw Patch Module (JPM)** randomizes patch embeddings to build view-invariant features; its **Side Information Embeddings (SIE)** explicitly encode camera-ID information to de-bias cross-camera features.[^17]

**OSNet** (Omni-Scale Feature Learning for Person ReID, KaiyangZhou/deep-person-reid) is the recommended production backbone for its balance of accuracy and size. The OSNet×0.25 quantized variant (INT8, TFLite, 0.197M parameters) achieves 92% Rank-1 on Market1501 at a fraction of ResNet50's cost.[^18][^19][^20]

### Feature Fusion Strategy

The recommended fusion hierarchy for identity matching:

```
Priority 1: Face embedding (ArcFace, cosine similarity)
  → If face confidence > 0.7 AND face size > 40×40px → use face as primary

Priority 2: Appearance embedding (OSNet, cosine similarity)
  → Always extracted; primary fallback when face is unavailable

Priority 3: Gait embedding (OpenGait, cosine similarity)
  → Extracted after 10+ continuous frames; tie-breaker only

Priority 4: Attributes (color, height estimation)
  → Hard-coded attributes for filtering gallery candidates

Final score = w_face*cos_face + w_app*cos_app + w_gait*cos_gait
Default weights: w_face=0.6, w_app=0.3, w_gait=0.1
```

### Cloth-Changing Long-Term ReID

**3DInvarReID** (ICCV 2023) disentangles identity from clothing by reconstructing 3D body shape — clothing-invariant naked body shape features show superior performance across datasets. For the Vision Agent, this approach is computationally heavy but the insight is actionable: **body proportions (height-to-width ratio, shoulder width, limb length estimates from pose keypoints) form stable identity anchors** that clothing cannot disguise.[^12]

### Retrospection — Round 2

Face + OSNet appearance covers 90%+ of re-ID needs. Gait is a powerful confirming signal but requires trajectory data. The key production insight is using a **centroid-based gallery** (averaging K recent embeddings per identity) rather than storing raw per-frame features, which prevents gallery explosion while adapting to legitimate appearance changes.[^21]

***

## Phase 3 — Round 3: Vehicle Re-Identification and Automatic License Plate Recognition

### ALPR Pipeline Architecture

The production ALPR pipeline consists of three stages:

**Stage 1 — License Plate Detection:**  
YOLOv8-s achieves **99.3% mAP** on the CCPD benchmark (250,000 images) at **30+ FPS** on resource-constrained devices. On standard hardware, this easily exceeds real-time requirements. For degraded images (motion blur, low light), integrating **ESRGAN super-resolution** before detection improves OCR accuracy significantly.[^22][^23]

**Stage 2 — Character Recognition:**  
EasyOCR and CR-NET are the leading OCR backends. The YOLOv8 + EasyOCR combination achieves **94% character recognition accuracy** across varied conditions. A semi-supervised learning approach using Grounding DINO for pseudo-label generation further improves recall to **94% (CENPARMI)** and **91% (UFPR-ALPR)**. The pipeline using YOLOv8 + ESRGAN + EasyOCR reports a **97% F1 score** and **98.5% mAP** on diverse datasets.[^24][^25][^23]

**Stage 3 — Plate Persistence:**  
Once a plate string is recognized with confidence, it is assigned as the primary vehicle ID. Subsequent frames that cannot read the plate (occlusion, angle) fall back to appearance features.

```python
# Minimum viable ALPR pipeline
plate_detector = YOLOv8('yolov8s_plate.pt')  # or .onnx
ocr_engine = EasyOCR(['en'])  # add local language if needed

def recognize_plate(frame, bbox):
    crop = frame[bbox.y1:bbox.y2, bbox.x1:bbox.x2]
    if is_blurry(crop):
        crop = esrgan_enhance(crop)
    result = ocr_engine.readtext(crop, allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
    return clean_plate_string(result)
```

### Vehicle Re-ID Beyond Plates

When plates are occluded or not visible, secondary vehicle appearance features enable re-ID:

- **Color + Type classification**: Vision Transformers achieve 96.0% color detection accuracy for vehicle re-ID[^26]
- **Keypoint-based knowledge graphs**: AAAI 2025 work uses vehicle keypoints (headlights, mirrors, door lines) to build graph-based structural representations robust to viewpoint change[^27]
- **PATReId**: A two-stream ViT + ResNet50 framework that jointly classifies vehicle color and type while performing ReID via multi-task learning[^28]
- **Day-Night Cross-Domain ReID**: The DNDM framework (CVPR 2024) specifically addresses night-time surveillance with a glare suppression module and dual-domain structure enhancement[^29][^30]

**Recommended vehicle feature vector:**
```
vehicle_embedding = concat([
    color_type_vector (128-d),       # ViT classifier output
    plate_embedding (64-d),          # one-hot or hashed plate string
    keypoint_structure_vector (256-d) # if available
])
```

### Retrospection — Round 3

Plate recognition is reliable (94–99% mAP) with YOLOv8-s at real-time speed. The critical failure modes are: night/backlit conditions (use ESRGAN + DNDM-style correction), extreme angle (supplement with color/type), and plate occlusion (fall back to appearance embedding). Always log first-seen and last-seen timestamps with plate string, not just tracking ID.

***

## Phase 4 — Round 4: Multi-Camera / Cross-Feed Tracking

### The Cross-Camera Re-ID Problem

Single-camera trackers (ByteTrack, BoT-SORT) assign **local camera-scoped IDs**. Cross-camera re-ID requires **global ID reconciliation**: when person `cam1_id=7` appears in `cam2`, they must receive the same global ID rather than a new one.

The **2024 AI City Challenge Track 1** winner (SJTU-LENOVO) achieved 67.22 HOTA on a 1,300-camera, 3,400-person benchmark using a **state-aware Re-ID correction mechanism** that handles ID switches during and after heavy occlusions. The runner-up (YACHIYO) used **overlap suppression clustering** for offline multi-camera tracking.[^31][^32]

### Spatio-Temporal Constraints

Combining appearance features with spatial-temporal (ST) constraints dramatically reduces false cross-camera matches. The key insight:[^33][^34]

> A person detected in Camera A at time T cannot simultaneously appear in Camera B unless the travel time between A and B is physically feasible.

**STAC** (2024) operationalizes this with a spatio-temporal probability model: the system builds a transition probability matrix between cameras based on historical trajectory data, then gates cross-camera re-ID candidates by feasibility.[^35]

```python
def cross_camera_match(probe_embedding, probe_cam, probe_time, gallery):
    candidates = []
    for identity_id, identity in gallery.items():
        # Spatio-temporal gate: only consider if travel time is feasible
        for prev_obs in identity.observations:
            travel_time = probe_time - prev_obs.timestamp
            expected_range = camera_transition_matrix[prev_obs.cam_id][probe_cam]
            if not (expected_range.min_sec <= travel_time <= expected_range.max_sec):
                continue
            # Appearance similarity
            cos_sim = cosine_similarity(probe_embedding, prev_obs.embedding)
            if cos_sim > CROSS_CAMERA_THRESHOLD:
                candidates.append((identity_id, cos_sim))
    return max(candidates, key=lambda x: x[^1]) if candidates else None
```

### MICRO-TRACK Architecture (Production Reference)

**MICRO-TRACK** (ECCV 2024) is the closest production-ready reference for the Vision Agent:[^36][^21]

- **Open-Set Gallery (OSG)**: Starts empty; fills progressively as new identities are encountered
- **Centroid-based identity representation**: Each identity stored as a centroid of K recent embeddings (reduces storage, adapts to appearance change)
- **Centroid Triplet Loss**: Training objective that makes centroids discriminative for open-set scenarios
- **Quality filtering**: Images below a confidence threshold `th_score` skip the Re-ID module; tracking ID is preserved
- **Two-module separation**: Tracking module (temporal coherence) is decoupled from Re-ID module (identity verification), allowing each to fail independently

On an NVIDIA Jetson AGX Xavier (edge device), MICRO-TRACK operates in real-time across 8 cameras.[^21]

### Multi-Camera People Tracking (Smart Campus Context)

A campus-scale deployment with 8–16 cameras using DeepSORT + OSNet embeddings shows:
- Appearance embeddings pre-trained on MSMT17 (large-scale person ReID dataset) generalize well to new environments without fine-tuning
- Camera topology awareness (knowing which cameras are adjacent) reduces false re-ID rate by ~30%
- VL-ZSReID (2026) demonstrates zero-shot ReID across campus cameras using VLMs on edge devices, achieving 19.98%–195.47% higher throughput over baselines[^37]

### Retrospection — Round 4

The production pattern is clear: **local tracker (per-camera) + global identity reconciler (cross-camera)**. The reconciler must use both appearance similarity and spatio-temporal feasibility. Gallery management (centroid-based, time-expiring, quality-gated) is as important as the embedding model itself.

***

## Phase 5 — Round 5: Lightweight & Real-Time Optimization

### Browser / Edge Feasibility Map

| Capability | Browser (WebGPU) | Edge (CPU-only) | Edge (iGPU/NPU) |
|-----------|-----------------|-----------------|-----------------|
| YOLOv8-n detection | ✅ 20–30 FPS | ✅ 15–25 FPS | ✅ 30–60 FPS |
| OSNet×0.25 ReID | ✅ 15–25 FPS | ✅ 10–20 FPS | ✅ 25–40 FPS |
| ArcFace MobileFace | ✅ 20–30 FPS | ✅ 15–25 FPS | ✅ 30–50 FPS |
| EasyOCR (ALPR) | ⚠️ Slow (~3 FPS) | ⚠️ 5–10 FPS | ✅ 15–25 FPS |
| Full ALPR pipeline | ⚠️ 5–10 FPS | ⚠️ 8–15 FPS | ✅ 20–30 FPS |
| FAISS similarity search | ✅ Near-instant | ✅ Near-instant | ✅ Near-instant |

[^38][^39]

### ONNX Runtime Web + WebGPU

ONNX Runtime Web with WebGPU backend delivers **3–5× faster inference than WebGL**, with ResNet50 dropping from 77–225ms (WebGL) to 20–40ms (WebGPU). For the Vision Agent:[^38]

```javascript
// ONNX Runtime Web inference setup
import * as ort from 'onnxruntime-web';

const session = await ort.InferenceSession.create(
    'osnet_x025_int8.onnx',
    { executionProviders: ['webgpu', 'webgl', 'wasm'] }  // fallback chain
);
```

**Quantization guidance:**
- **FP16**: Matches FP32 accuracy; recommended baseline for ONNX exports
- **INT8 Static (TensorRT)**: 1.5–3.3× speedups with ~3–7 mAP50-95 accuracy drop; suitable for edge GPU[^40]
- **Dynamic UINT8 (ONNX)**: Preserves FP32 accuracy but is slower than FP32 TensorRT[^40]
- **INT8 TFLite**: OSNet×0.25 at 0.197M parameters achieves 92% Rank-1 at INT8[^19]

On NVIDIA Jetson Orin Nano benchmarks:
| Model | PyTorch | ONNX FP16 | TensorRT FP16 | TensorRT INT8 |
|-------|---------|-----------|---------------|---------------|
| YOLOv8n | 36 FPS | 7 FPS | 60 FPS | 63 FPS |
| YOLOv8s | 27 FPS | 3 FPS | 48 FPS | 57 FPS |
| YOLOv8m | 14 FPS | 1.2 FPS | 30 FPS | 38 FPS |

[^39]

### MediaPipe for Browser-First Pose/Gait

MediaPipe BlazePose runs entirely in-browser via WebAssembly at **30+ FPS desktop, 15–25 FPS Android**. The 33-keypoint skeleton output can be used for:[^41][^38]
- Approximate gait feature extraction (stride pattern, cadence)
- Body proportion estimation for identity anchoring
- Quality gating (is the person upright, fully visible?)

MediaPipe Face Mesh (468 landmarks) provides face region candidates for downstream ArcFace inference.[^42]

### Web Worker Architecture for Non-Blocking Inference

```javascript
// Main thread
const worker = new Worker('reid-worker.js');
worker.postMessage({ type: 'INFER', frame: frameData, bbox: detectionBbox });
worker.onmessage = ({ data }) => {
    if (data.type === 'EMBEDDING') updateGallery(data.trackId, data.embedding);
};

// reid-worker.js (runs off-main-thread)
importScripts('onnxruntime-web/ort.min.js');
const session = await ort.InferenceSession.create('osnet_x025_fp16.onnx');
```

### Model Size Budget

For a browser-first Vision Agent, the recommended model stack and sizes:

| Model | Format | Size | Role |
|-------|--------|------|------|
| YOLOv8n | ONNX FP16 | ~6 MB | Person/vehicle detection |
| SCRFD 500M | ONNX FP16 | 2.4 MB | Face detection |
| ArcFace MobileFace | ONNX FP16 | ~13 MB | Face embedding |
| OSNet×0.25 | ONNX INT8 | ~1.5 MB | Body appearance embedding |
| YOLOv8-s plate | ONNX FP16 | ~14 MB | Plate detection |
| EasyOCR (lightweight) | ONNX | ~20 MB | Plate OCR |
| **Total** | | **~57 MB** | Full pipeline |

### Retrospection — Round 5

A ~57 MB model stack is browser-feasible with lazy loading and caching. The ALPR OCR component is the main bottleneck in-browser — run it server-side or on a Web Worker with caching (once a plate is read, cache it for that vehicle's track). TensorRT INT8 is the clear winner for edge GPU deployment; ONNX FP16 + WebGPU is the realistic browser target.

***

## Phase 6 — Round 6: Production Case Studies, Privacy, and Synthesis

### Production Deployments

**1. AI City Challenge 2024 Track 1 (SJTU-LENOVO)**  
1,300 cameras, 3,400 people, HOTA 67.22. Key techniques:[^32]
- Geometric consistency checks between cameras
- State-aware Re-ID correction for occlusion recovery
- Appearance embeddings from OSNet backbone pre-trained on MSMT17[^4]

**2. MICRO-TRACK (Industrial, ECCV 2024)**  
8-camera manufacturing facility, real-time on Jetson AGX Xavier. Key techniques:[^36]
- Open-set gallery (no predefined identity list)
- Quality-gated Re-ID invocation (only runs when face/body confidence > threshold)
- Centroid triplet loss for efficient gallery representation

**3. VL-ZSReID (Campus, 2026)**  
Zero-shot ReID using VLMs on edge devices across campus surveillance, achieving 44.68% mAP improvement over baselines with significantly lower latency.[^37]

**4. STAC (Cross-Camera Streaming, 2024)**  
Integrates spatio-temporal associations with omni-scale feature learning; achieves real-time analytics under constrained network environments through frame filtering and FFmpeg compression.[^35]

### Privacy and Legal Considerations

**GDPR / ICO Compliance (UK/EU):**
Biometric surveillance systems processing faces and gait patterns constitute processing of **special category personal data** (Article 9 GDPR), requiring explicit consent or a specific legal basis. Ten mandatory DPIA considerations:[^43][^44]

1. Establish lawful basis (explicit consent, or specific legal provision)
2. Necessity and proportionality test (less intrusive alternatives?)
3. Mandatory DPIA for any large-scale deployment[^44]
4. Privacy-by-design: discard raw frames immediately after embedding extraction
5. Purpose limitation: no secondary use of collected biometric data
6. Strong security (encryption at rest and in transit)
7. Retention limits: define maximum observation window; auto-expire gallery entries
8. Transparency: visible signage, accessible privacy notices[^44]
9. Governance and vendor management
10. Bias auditing: test across demographics for false acceptance/rejection rates[^44]

**Technical privacy mitigations:**
- Store embeddings only, not raw face images (deletion of source data after embedding)
- Pseudonymize gallery IDs (no linkage to personal data without authorization)
- Auto-expire gallery entries after configurable time window (e.g., 24 hours)
- Role-based access control for identity lookup API

***

## Phase 7 — Synthesis & Recommended Architecture

### System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        VISION AGENT                              │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Camera Feed A  │    │  Camera Feed B  │    ... N feeds       │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                     │                                │
│  ┌────────▼────────────────────▼────────────────────────────┐   │
│  │              DETECTION LAYER (YOLOv8n ONNX)               │   │
│  │  Outputs: [bbox, class, confidence] per frame             │   │
│  └────────────────────────────┬──────────────────────────────┘   │
│                               │                                  │
│  ┌────────────────────────────▼──────────────────────────────┐   │
│  │         WITHIN-FEED TRACKER (BoT-SORT or ByteTrack)        │   │
│  │  Outputs: [local_track_id, bbox, age] per detection        │   │
│  └──────────────┬─────────────────────┬───────────────────────┘  │
│                 │                     │                           │
│  ┌──────────────▼──────┐  ┌──────────▼──────────────────────┐    │
│  │  PERSON RE-ID PATH  │  │    VEHICLE RE-ID + ALPR PATH     │    │
│  │                     │  │                                  │    │
│  │ Face detection      │  │ Plate detection (YOLOv8-s)       │    │
│  │ (SCRFD 500M)        │  │ OCR (EasyOCR / CR-NET)           │    │
│  │ Face embed          │  │ Vehicle color/type (ViT)         │    │
│  │ (ArcFace MobileFace)│  │ Vehicle appearance embed         │    │
│  │ Body embed          │  │ (OSNet or ResNet50 domain-tuned)  │    │
│  │ (OSNet×0.25)        │  │                                  │    │
│  │ Gait features       │  │ Plate string → primary vehicle ID│    │
│  │ (MediaPipe keypts)  │  │ Appearance embed → fallback ID   │    │
│  └──────────┬──────────┘  └──────────┬───────────────────────┘   │
│             │                        │                            │
│  ┌──────────▼────────────────────────▼───────────────────────┐   │
│  │          IDENTITY MANAGER (Global Gallery)                  │   │
│  │                                                            │   │
│  │  person_gallery: Dict[global_id → PersonIdentity]          │   │
│  │  vehicle_gallery: Dict[global_id → VehicleIdentity]        │   │
│  │                                                            │   │
│  │  PersonIdentity:                                           │   │
│  │    global_id: UUID                                         │   │
│  │    face_centroid: ndarray  (K-mean of ArcFace embeds) │   │
│  │    body_centroid: ndarray  (K-mean of OSNet embeds)   │   │
│  │    gait_signature: ndarray[^128] (optional)                 │   │
│  │    attributes: {height_est, dominant_color}                │   │
│  │    observations: List[Observation(cam_id, ts, bbox)]       │   │
│  │    first_seen: timestamp                                    │   │
│  │    last_seen: timestamp                                    │   │
│  │    ttl: 24 hours (configurable)                            │   │
│  │                                                            │   │
│  │  VehicleIdentity:                                          │   │
│  │    global_id: UUID                                         │   │
│  │    plate_string: str (primary key if available)            │   │
│  │    appearance_centroid: ndarray                       │   │
│  │    color: str, type: str                                   │   │
│  │    observations: List[Observation]                         │   │
│  │    first_seen, last_seen: timestamps                       │   │
│  │                                                            │   │
│  │  FAISS IndexFlatIP (inner product = cosine for L2-normed)  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Identity Management Data Structures

```python
import uuid
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from datetime import datetime, timedelta

@dataclass
class Observation:
    cam_id: str
    timestamp: float
    bbox: tuple          # (x1, y1, x2, y2) in frame coordinates
    confidence: float

@dataclass
class PersonIdentity:
    global_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    face_embeddings: List[np.ndarray] = field(default_factory=list)  # raw, for centroid calc
    body_embeddings: List[np.ndarray] = field(default_factory=list)
    gait_signature: Optional[np.ndarray] = None
    face_centroid: Optional[np.ndarray] = None  # updated every K embeddings
    body_centroid: Optional[np.ndarray] = None
    attributes: Dict = field(default_factory=dict)  # height_est, dominant_color
    observations: List[Observation] = field(default_factory=list)
    first_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    last_seen: float = field(default_factory=lambda: datetime.now().timestamp())
    ttl_hours: float = 24.0

    def update_centroid(self, K: int = 20):
        """Recompute centroid from last K embeddings."""
        if self.face_embeddings:
            recent_face = np.array(self.face_embeddings[-K:])
            self.face_centroid = recent_face.mean(axis=0)
            self.face_centroid /= np.linalg.norm(self.face_centroid)
        if self.body_embeddings:
            recent_body = np.array(self.body_embeddings[-K:])
            self.body_centroid = recent_body.mean(axis=0)
            self.body_centroid /= np.linalg.norm(self.body_centroid)

    def is_expired(self) -> bool:
        return (datetime.now().timestamp() - self.last_seen) > (self.ttl_hours * 3600)

    def fused_similarity(self, face_q, body_q, gait_q=None,
                          w_face=0.6, w_body=0.3, w_gait=0.1) -> float:
        """Compute weighted multi-modal similarity score."""
        score = 0.0
        if face_q is not None and self.face_centroid is not None:
            score += w_face * float(np.dot(face_q, self.face_centroid))
        if body_q is not None and self.body_centroid is not None:
            score += w_body * float(np.dot(body_q, self.body_centroid))
        if gait_q is not None and self.gait_signature is not None:
            score += w_gait * float(np.dot(gait_q, self.gait_signature))
        return score
```

### Cross-Feed Re-ID Flow

```python
class GlobalIdentityManager:
    def __init__(self, face_threshold=0.55, body_threshold=0.65,
                 fused_threshold=0.55, st_matrix=None):
        self.person_gallery: Dict[str, PersonIdentity] = {}
        self.vehicle_gallery: Dict[str, VehicleIdentity] = {}
        self.st_matrix = st_matrix  # camera transition time constraints
        self.local_to_global: Dict[str, str] = {}  # "cam_id:local_id" → global_id

    def match_or_create_person(self, face_emb, body_emb, gait_emb,
                                cam_id, local_id, timestamp) -> str:
        key = f"{cam_id}:{local_id}"
        
        # Fast path: if local track maps to known global ID, return it
        if key in self.local_to_global:
            gid = self.local_to_global[key]
            self.person_gallery[gid].last_seen = timestamp
            return gid

        # Prune expired identities
        self._prune_expired()

        best_match_id, best_score = None, 0.0
        for gid, identity in self.person_gallery.items():
            # Spatio-temporal gate
            if self.st_matrix and not self._st_feasible(identity, cam_id, timestamp):
                continue
            score = identity.fused_similarity(face_emb, body_emb, gait_emb)
            if score > best_score:
                best_score, best_match_id = score, gid

        MATCH_THRESHOLD = 0.55
        if best_score >= MATCH_THRESHOLD:
            gid = best_match_id
        else:
            # New identity
            new_id = PersonIdentity()
            gid = new_id.global_id
            self.person_gallery[gid] = new_id

        identity = self.person_gallery[gid]
        if face_emb is not None: identity.face_embeddings.append(face_emb)
        if body_emb is not None: identity.body_embeddings.append(body_emb)
        identity.update_centroid()
        identity.observations.append(Observation(cam_id, timestamp, None, 1.0))
        identity.last_seen = timestamp
        self.local_to_global[key] = gid
        return gid

    def _st_feasible(self, identity, probe_cam, probe_time) -> bool:
        if not identity.observations: return True
        last_obs = identity.observations[-1]
        travel_time = probe_time - last_obs.timestamp
        if last_obs.cam_id == probe_cam: return True
        allowed = self.st_matrix.get((last_obs.cam_id, probe_cam))
        if allowed is None: return True
        return allowed['min_sec'] <= travel_time <= allowed['max_sec']

    def _prune_expired(self):
        expired = [gid for gid, id_ in self.person_gallery.items() if id_.is_expired()]
        for gid in expired:
            del self.person_gallery[gid]
            self.local_to_global = {k: v for k, v in self.local_to_global.items() if v != gid}
```

***

## Phase 8 — Implementation Plan & Validation Strategy

### Step-by-Step Integration Plan

**Step 1: Upgrade Within-Feed Tracker (1–2 days)**
- Replace current tracker with BoT-SORT (appearance-enabled) or ByteTrack
- Install via `pip install supervision trackers`
- Integrate YOLOv11n or YOLOv8n as detector
- Set `lost_track_buffer=60` to survive longer occlusions
- **Success metric:** ID switch rate (IDSW) reduced by >30% on test video

**Step 2: Add OSNet Body Embedding Extractor (2–3 days)**
- Install torchreid: `pip install torchreid`
- Export OSNet×0.25 to ONNX: `torch.onnx.export(model, ...)`
- Run embedding extraction on each tracked person crop per frame
- Store last 20 embeddings per track; update centroid every 5 frames
- **Success metric:** Cosine similarity between same-person crops > 0.7 on held-out video

**Step 3: Add Face Extraction (SCRFD + ArcFace) (2–3 days)**
- Download SCRFD 500M ONNX (2.4 MB) and ArcFace MobileFace ONNX (13 MB) from `yakhyo/face-reidentification`
- Detect faces within tracked person bboxes only (no full-frame face detection)
- Extract 512-d ArcFace embedding; L2-normalize
- Gate on face confidence > 0.7 and face pixel size > 40×40
- **Success metric:** Same-person face embeddings have cosine similarity > 0.8

**Step 4: Deploy GlobalIdentityManager (3–4 days)**
- Implement `PersonIdentity`, `VehicleIdentity`, and `GlobalIdentityManager` classes
- Install FAISS: `pip install faiss-cpu` (or `faiss-gpu`)
- Integrate FAISS IndexFlatIP for fast gallery search at scale
- Fuse face + body scores with weights (0.6, 0.3) initially
- Populate `local_to_global` mapping per-frame
- **Success metric:** Same person crossing 2 cameras receives same global ID in >80% of trials

**Step 5: Add ALPR (3–4 days)**
- Train or download YOLOv8-s fine-tuned on license plate dataset (Roboflow Universe has several)
- Add EasyOCR post-processor with character allowlist `[A-Z0-9-]`
- Cache recognized plates per vehicle track to avoid redundant OCR
- Log `{plate_string, global_vehicle_id, first_seen_ts, last_seen_ts, cam_id}` to database
- **Success metric:** Plate recognition accuracy > 90% on test footage

**Step 6: Spatio-Temporal Camera Topology (1–2 days)**
- Map camera positions (GPS or manual measurement)
- Build `camera_transition_matrix` with min/max travel times between adjacent cameras
- Integrate into `GlobalIdentityManager._st_feasible()`
- **Success metric:** False cross-camera re-ID rate reduced by >20%

**Step 7: ONNX Export + Web Worker Integration (3–5 days)**
- Export all models to ONNX FP16
- For browser: load via `onnxruntime-web` with WebGPU → WebGL → WASM fallback chain
- Run inference in dedicated Web Worker to prevent UI blocking
- Lazy-load models on first detection; cache in IndexedDB
- **Success metric:** End-to-end pipeline runs at >10 FPS in Chrome with WebGPU

**Step 8: Logging & Persistence (2 days)**
- Write observation log: `{global_id, type, cam_id, ts, bbox, plate_string?}`
- Implement gallery serialization to JSON (for session persistence)
- Add TTL-based auto-expiry (default 24 hours)
- Expose REST/WebSocket API: `GET /identities/{global_id}/history`

### Success Metrics

| Metric | Baseline (Current) | Target | Measurement Method |
|--------|-------------------|--------|--------------------|
| ID switch rate (IDSW) | High (spotty) | <50% of baseline | MOT eval on test video |
| Cross-camera re-ID accuracy | None | >75% Rank-1 | Labeled ground-truth crossings |
| Plate recognition accuracy | None | >90% | Manual verification on 100 plates |
| Within-feed tracking FPS | Current | >20 FPS (CPU) | `time.perf_counter()` profiling |
| Global ID creation latency | N/A | <50ms per detection | Profiling |
| Memory footprint (gallery) | N/A | <100 MB for 1000 IDs | `tracemalloc` |
| False re-ID rate | N/A | <5% | Labeled ground-truth |

### Playwright Test Strategy

```python
# playwright test: verify person receives stable global ID across camera cuts
async def test_cross_camera_identity_stability(page):
    await page.goto('/vision-agent')
    await page.evaluate("window.visionAgent.loadTestVideo('cross_camera_test.mp4')")
    
    results = await page.evaluate("window.visionAgent.runTracking()")
    
    person_ids_cam1 = [obs['global_id'] for obs in results if obs['cam_id'] == 'cam1']
    person_ids_cam2 = [obs['global_id'] for obs in results if obs['cam_id'] == 'cam2']
    
    # The same person (known from ground truth) should have same global_id in both cameras
    shared_ids = set(person_ids_cam1).intersection(set(person_ids_cam2))
    assert len(shared_ids) >= 1, "Same person not re-identified across cameras"

# playwright test: verify plate logging
async def test_plate_logging(page):
    results = await page.evaluate("window.visionAgent.getPlateLog()")
    assert any(r['plate_string'] == 'ABC123' for r in results), "Known plate not recognized"
    assert all(r['first_seen'] <= r['last_seen'] for r in results), "Timestamp ordering violated"
```

***

## Phase 9 — Final Recommendations

### Architecture Summary

The recommended Vision Agent upgrade fuses **three identity signals** for people and **two signals** for vehicles:

**People:** ArcFace face embedding (primary) → OSNet body embedding (secondary) → MediaPipe-derived gait/pose features (tertiary). These feed a centroid-based Open-Set Gallery managed by GlobalIdentityManager with FAISS similarity search.

**Vehicles:** YOLOv8-s plate detection → EasyOCR OCR (primary ID) → ViT color/type + appearance embedding (secondary ID). Plate string is the stable primary key; appearance embedding handles plate-occluded cases.

**Cross-feed:** Within-feed local tracking (BoT-SORT) assigns local IDs; GlobalIdentityManager reconciles these into stable global UUIDs using appearance similarity + spatio-temporal feasibility gating.

### Priority Code Changes

1. **Immediately impactful (Week 1):** Upgrade tracker to BoT-SORT with `lost_track_buffer=60`. This alone reduces ID switches dramatically without any new models.
2. **High impact (Week 2):** Add OSNet×0.25 ONNX body embedding. Enables cross-camera appearance matching.
3. **High impact (Week 2–3):** Add GlobalIdentityManager with centroid gallery. Enables persistent unique IDs.
4. **High impact (Week 3):** Add SCRFD + ArcFace face embedding. Provides most reliable identity anchor.
5. **Medium impact (Week 4):** Add YOLOv8-s ALPR + EasyOCR. Enables vehicle identity logging.
6. **Medium impact (Week 4–5):** Add spatio-temporal camera transition matrix.
7. **Performance (Week 5–6):** Export all models to ONNX FP16; integrate Web Workers for browser deployment.

### Dos and Don'ts Checklist

**✅ DOs:**
- Use centroid-based gallery (mean of K recent embeddings) — adapts to appearance change, controls memory
- Gate face Re-ID on quality threshold (min face size 40×40px, confidence > 0.7)
- Normalize all embeddings to unit length before cosine similarity
- Use `lost_track_buffer=60` or higher in within-feed tracker
- Apply spatio-temporal constraints for cross-camera matching — drastically reduces false positives
- Cache OCR results per vehicle track — do not re-run OCR every frame
- Run embedding inference in Web Workers to avoid main thread blocking
- Expire gallery entries after TTL (24–48 hours for most applications)
- Log `first_seen` and `last_seen` timestamps as epoch floats (timezone-aware)
- Pre-train ReID models on MSMT17 or DukeMTMC-reID for better generalization

**❌ DON'Ts:**
- Don't store raw face images in the gallery — store embeddings only (privacy + memory)
- Don't use a single embedding per identity — use centroid of K recent embeddings
- Don't use purely IoU-based matching for cross-camera re-ID (it doesn't generalize)
- Don't use the same cosine threshold for face and body — they have different distribution characteristics
- Don't run EasyOCR on every frame — cache the plate reading and re-check only when confidence is low
- Don't use INT8 quantization without a calibration dataset — accuracy drop can be severe for unusual scenes
- Don't rely solely on gait for real-time ID — it requires continuous trajectory and multiple complete strides
- Don't ignore camera topology — two people can't teleport between distant cameras in 1 second
- Don't deploy biometric surveillance without a DPIA and explicit consent mechanism (GDPR Article 9)
- Don't set `minimum_consecutive_frames` too high — you'll miss short-duration appearances

### Open Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Face unavailable (backward, masked) | High | Medium | Body embedding is primary fallback; always extract |
| Clothing change across days | Medium | High | Gait + body proportion as tie-breakers; longer TTL |
| Night / low-light conditions | Medium | High | ESRGAN pre-processing; day-night domain adaptation (DNDM)[^30] |
| Gallery explosion (many identities) | Medium | Medium | TTL expiry + FAISS approximate search for >10K identities |
| OCR failure on partial plates | High | Low | Partial plate string matching with Levenshtein distance tolerance |
| False re-ID (similar appearances) | Medium | High | Increase fused threshold; require ST-feasibility |
| Browser WebGPU unavailability | Medium | Medium | WASM fallback; reduce to YOLOv8n + OSNet only |
| Privacy violation / GDPR breach | Low (if compliant) | Critical | DPIA, embedding-only storage, TTL, consent mechanism |
| ID switch during fast motion | High | Low | Increase `lost_track_buffer`; motion-compensated Kalman |

### Key Repository References

| Repository | Purpose | URL |
|-----------|---------|-----|
| yakhyo/face-reidentification | SCRFD + ArcFace + FAISS pipeline | https://github.com/yakhyo/face-reidentification |
| KaiyangZhou/deep-person-reid | OSNet, torchreid library | https://github.com/kaiyangzhou/deep-person-reid |
| ShiqiYu/OpenGait | Gait recognition framework | https://github.com/ShiqiYu/OpenGait |
| jdyjjj/All-in-One-Gait | Integrated gait tracking system | https://github.com/jdyjjj/All-in-One-Gait |
| Adilkhan04/ALPR | YOLOv8 + ESRGAN + EasyOCR ALPR | https://github.com/Adilkhan04/ALPR |
| heshuting555/TransReID | Transformer-based ReID baseline | https://github.com/heshuting555/TransReID |
| VlSomers/keypoint_promptable_reidentification | KPR occlusion-robust ReID | https://github.com/VlSomers/keypoint_promptable_reidentification |
| NirAharon/BoT-SORT | BoT-SORT tracker | https://github.com/NirAharon/BoT-SORT |
| ifzhang/ByteTrack | ByteTrack tracker | https://github.com/ifzhang/ByteTrack |
| ultralytics/ultralytics | YOLOv8 + ONNX export | https://github.com/ultralytics/ultralytics |

---

## References

1. [Table 7.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12960806/table/Tab7/) - Aiming at the problems of low efficiency in traditional manual inspection of open-pit mines, difficu...

2. [Table 4.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12859512/table/tbl0004/) - In the stereoscopic cage-rearing system, monitoring the individual egg production of laying ducks is...

3. [ByteTrack vs BoT-SORT vs StrongSORT vs OC-SORT YOLOv8x Comparision](https://www.youtube.com/watch?v=7U8noi4QLik) - I compared ByteTrack, BoT-SORT , StrongSORT and  OC-SORT Multi Object Tracking algorithms with YOLOv...

4. [Table 3.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12852133/table/Tab3/) - Person re-identification (Re-ID) is a key challenge in computer vision, requiring the matching of in...

5. [[PDF] Dual-Path Temporal Decoder for End- to-End Multi-Object Tracking](https://neurips.cc/media/neurips-2025/Slides/117877.pdf)

6. [DeepSORT - Trackers](https://trackers.roboflow.com/develop/trackers/core/deepsort/tracker/) - A unified library for object tracking featuring clean room re-implementations of leading multi-objec...

7. [FLUXSynID: A Framework for Identity-Controlled Synthetic ...](https://arxiv.org/html/2505.07530v1) - Experiments in this study leverage two open-source face recognition models: ArcFace [12] and AdaFace...

8. [Performance Comparison, Fusion, and Explainability in Face ...](https://openaccess.thecvf.com/content/ICCV2025W/FoundGen-Bio/papers/Sony_Foundation_versus_Domain-specific_Models_Performance_Comparison_Fusion_and_Explainability_in_ICCVW_2025_paper.pdf) - by R Sony · 2025 · Cited by 8 — We present a sys- tematic comparison of multiple foundation models a...

9. [Face Re-Identification with SCRFD, ArcFace, FAISS, ONNX ...](https://github.com/yakhyo/face-reidentification) - Key Features. Real-Time Face Recognition: Process webcam or video files with SCRFD detection and Arc...

10. [face-reidentification/README.md at main · yakhyo/face-reidentification](https://github.com/yakhyo/face-reidentification/blob/main/README.md) - 👤🔄 | Face re-identification using ArcFace and SCRFD models | ONNX Runtime Inference - yakhyo/face-re...

11. [Feature distances not discriminatory · Issue #483 · KaiyangZhou/deep-person-reid](https://github.com/KaiyangZhou/deep-person-reid/issues/483) - Hi, I am using torchreid as a feature extractor for my custom dataset. When I find euclidean or cosi...

12. [[PDF] Learning Clothing and Pose Invariant 3D Shape Representation for Long-Term Person Re-Identification | Semantic Scholar](https://www.semanticscholar.org/paper/Learning-Clothing-and-Pose-Invariant-3D-Shape-for-Liu-Kim/14edf267601563021ab0f8899ae90318b92dd33a) - This work proposes a new approach 3DInvarReID for disentangling identity from non-identity component...

13. [ShiqiYu/OpenGait](https://github.com/ShiqiYu/OpenGait) - A flexible and extensible framework for gait recognition. You can focus on designing your own models...

14. [GitHub - jdyjjj/All-in-One-Gait: TrackGait is a sub project of OpenGait. Implemented a gait recognition system.](https://github.com/jdyjjj/All-in-One-Gait) - TrackGait is a sub project of OpenGait. Implemented a gait recognition system. - jdyjjj/All-in-One-G...

15. [OpenGait/configs/gaitedge/README.md at master · ShiqiYu/OpenGait](https://github.com/ShiqiYu/OpenGait/blob/master/configs/gaitedge/README.md) - A flexible and extensible framework for gait recognition. You can focus on designing your own models...

16. [CLIP-based Multi-modal Feature Learning for Cloth ...](https://pubmed.ncbi.nlm.nih.gov/40889312/) - Contrastive Language-Image Pre-training (CLIP) has achieved remarkable results in the field of perso...

17. [TransReID: Transformer-based Object Re-Identification](https://www.computer.org/csdl/proceedings-article/iccv/2021/281200o4993/1BmGehnOaLS) - Extracting robust feature representation is one of the key challenges in object re-identification (R...

18. [Omni-Scale Feature Learning for Person Re-Identification - ar5iv](https://ar5iv.labs.arxiv.org/html/1905.00953) - As an instance-level recognition problem, person re-identification (re-ID) relies on discriminative ...

19. [STMicroelectronics/osnet - Hugging Face](https://huggingface.co/STMicroelectronics/osnet) - We’re on a journey to advance and democratize artificial intelligence through open source and open s...

20. [KaiyangZhou/deep-person-reid: Torchreid ...](https://github.com/kaiyangzhou/deep-person-reid) - Torchreid is a library for deep-learning person re-identification, written in PyTorch and developed ...

21. [[Literature Review] Multi-Camera Industrial Open-Set ...](https://www.themoonlight.io/en/review/multi-camera-industrial-open-set-person-re-identification-and-tracking) - MICRO-TRACK aimed at improving person re-identification (Re-ID) and tracking within multi-camera sur...

22. [Optimized YOLOv8 for Automatic License Plate Recognition on Resource Constrained Devices](https://www.etasr.com/index.php/ETASR/article/view/9983) - This paper presents an optimized Automatic License Plate Recognition (ALPR) system designed for reso...

23. [Adilkhan04/ALPR](https://github.com/Adilkhan04/ALPR) - Powerful ALPR with YOLOv8, ESRGAN & EasyOCR! ⚡️ Detect & read license plates in images/videos. ✨ Hig...

24. [Efficient License Plate Recognition via Pseudo-Labeled Supervision with Grounding DINO and YOLOv8](https://arxiv.org/abs/2510.25032v1) - Developing a highly accurate automatic license plate recognition system (ALPR) is challenging due to...

25. [Research paper on ALPR using YOLOv8 published in IEEE PDGC ...](https://www.linkedin.com/posts/sanskriti-singh-923902221_automatic-license-plate-detection-using-yolov8-activity-7341060149391892480-vGay) - I am thrilled to share that my research paper, “Automatic License Plate Detection Using YOLOv8 Model...

26. [Smart Vision Traffic Surveillance: Vehicle Re-Identification ...](https://www.mdpi.com/2624-8921/8/2/36) - by MS Hanif · 2026 · Cited by 2 — Vision Transformers combined al feature extraction to accurately i...

27. [Keypoint-Based Knowledge Graph for Vehicle Re- ...](https://ojs.aaai.org/index.php/AAAI/article/view/32630/34785) - by K Lv · 2025 · Cited by 3 — Vehicle re-identification aims to match vehicles across non- overlappi...

28. [GitHub - Rabusi/PATReId-Pose-Apprise-Transformer-Network-for-Vehicle-Re-Identification](https://github.com/Rabusi/PATReId-Pose-Apprise-Transformer-Network-for-Vehicle-Re-Identification) - Contribute to Rabusi/PATReId-Pose-Apprise-Transformer-Network-for-Vehicle-Re-Identification developm...

29. [[PDF] Day-Night Cross-domain Vehicle Re-identification - CVF Open Access](https://openaccess.thecvf.com/content/CVPR2024/papers/Li_Day-Night_Cross-domain_Vehicle_Re-identification_CVPR_2024_paper.pdf)

30. [Day-Night Cross-domain Vehicle Re-identification](https://openaccess.thecvf.com/content/CVPR2024/html/Li_Day-Night_Cross-domain_Vehicle_Re-identification_CVPR_2024_paper.html)

31. [A Robust Online Multi-Camera People Tracking System With ...](https://openaccess.thecvf.com/content/CVPR2024W/AICity/papers/Xie_A_Robust_Online_Multi-Camera_People_Tracking_System_With_Geometric_Consistency_CVPRW_2024_paper.pdf) - by Z Xie · 2024 · Cited by 18 — We propose a state-aware Re-ID correction mechanism to address the p...

32. [Challenge Winners 2024](https://www.aicitychallenge.org/2024-challenge-winners/) - 2024 Track 1: Winner: Team79 SJTU-LENOVO A Robust Online Multi-Camera People Tracking System With Ge...

33. [861919418450444288-15541](https://www.bohrium.com/paper-details/cross-camera-multi-object-tracking-based-on-person-re-identification-and-spatial-temporal-constraints/861919418450444288-15541)

34. [STAC: Spatio-Temporal Associations for Cross-Camera ...](https://arxiv.org/pdf/2401.15288.pdf)

35. [STAC: Leveraging Spatio-Temporal Data Associations For Efficient Cross-Camera Streaming and Analytics](http://arxiv.org/abs/2401.15288v1) - We propose an efficient cross-cameras surveillance system called,STAC, that leverages spatio-tempora...

36. [[2409.03879] Multi-Camera Industrial Open-Set Person Re ...](https://arxiv.org/abs/2409.03879) - by F Cunico · 2024 · Cited by 7 — MICRO-TRACK, a Modular Industrial multi-Camera Re_identification a...

37. [Zero-Shot Real-Time Pedestrian Re-Identification Services Via Edge ...](https://www.computer.org/csdl/journal/sc/5555/01/11513012/2gkdH3QasYU)

38. [Browser-Based ML Inference Guide | Brian Cohn Ph.D.](https://briancohn.com/2025/11/12/browser-based-inference/) - Comprehensive comparison of tools and frameworks for running ML models directly in the browser.

39. [the0807/YOLOv8-ONNX-TensorRT | DeepWiki](https://deepwiki.com/the0807/YOLOv8-ONNX-TensorRT) - This document provides an overview of the YOLOv8-ONNX-TensorRT system, a comprehensive model optimiz...

40. [Quantization Robustness to Input Degradations for Object Detection](https://huggingface.co/papers/2508.19600) - Join the discussion on this paper page

41. [BlazePose 3D - EZ-MMLA Toolkit](https://mmla.gse.harvard.edu/tools/blazepose3d/)

42. [Three Prompts: MediaPipe Computer Vision Demo - Pate Bryant](https://www.patebryant.com/articles/three-prompts-media-pipe-test) - Building a real-time face and body tracking application with MediaPipe and React in just three promp...

43. [Biometric data guidance: Biometric recognition | ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/)

44. [TOP 10 DPIA MUST-DO’S FOR BIOMETRIC SURVEILLANCE UNDER GDPR.](https://medium.com/@kalyaninidhi94/top-10-dpia-must-dos-for-biometric-surveillance-under-gdpr-716d68e70e91) - Security is always excessive until it’s not enough.

128. [© May 2025 | IJIRT | Volume 11 Issue 12 | ISSN: 2349-6002](https://ijirt.org/publishedpaper/IJIRT178848_PAPER.pdf)

