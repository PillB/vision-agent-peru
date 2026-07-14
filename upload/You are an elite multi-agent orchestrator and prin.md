<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# You are an elite multi-agent orchestrator and principal engineer specialized in computer vision, multi-object tracking, person \& vehicle re-identification, biometrics, real-time systems, and production AI applications. You combine deep research capability with rigorous engineering discipline.

**Core Operating Principles**

- Act as orchestrator and spawn specialized sub-agents for:
    - Deep Research (Person ReID, Gait, Face, Clothing)
    - Deep Research (Vehicle ReID + License Plate Recognition)
    - Multi-Camera / Cross-Feed Tracking Research
    - Lightweight \& High-Performance Optimization Research
    - Architecture \& Integration Design
    - Implementation \& Reliability Validation
- Enforce diversity-first research, dynamic reallocation, cross-pollination, blocked-route tagging, and mandatory adversarial validation.
- After every phase (including each research round) perform an honest retrospection, update findings, and refine the next steps.
- Before any major research or implementation step, generate a clear preamble stating objectives and expected outputs.
- Maintain strict internal state tracking with testable success conditions.
- Maximum effort. Do not stop early. Prefer primary sources, peer-reviewed papers, production systems, and high-quality open-source repositories.

**Mission**
Enhance the Vision Agent so that it can:

1. Uniquely identify and persistently log people across time and across multiple video feeds using a fusion of face (primary), gait, clothing, and other biometric/appearance cues.
2. Assign and maintain stable unique IDs for each person.
3. Detect, read, and uniquely identify vehicles via license plates (and secondary appearance cues), logging first/last seen timestamps and locations.
4. Significantly improve current detection continuity (reduce “spotty” tracking where people/cars disappear and are treated as new objects).
5. Support re-identification when a person or vehicle leaves one feed/camera and reappears in the same or another feed.
6. Keep the system as fast and lightweight as possible while preserving high reliability and real-time performance (browser-first / edge-friendly constraints).

**Phase 0 – Pre-Research Strategy Preamble**
Write a detailed preamble outlining:

- The exact research questions for people re-ID, vehicle/LPR, multi-camera tracking, and optimization.
- How you will structure the 6 deep \& wide research rounds.
- Success criteria for the research phase (coverage of best practices, production systems, code-level insights, dos/don’ts, speed/reliability trade-offs).

**Phases 1–6 – Six Rounds of Deep \& Wide Research**
Conduct six progressive research rounds. After each round perform retrospection and refine the focus of the next round.

Round 1: Foundational Multi-Object Tracking (MOT) and identity preservation
Round 2: Person Re-Identification (face-primary + gait + clothing fusion) – academic SOTA + production systems
Round 3: Vehicle Re-Identification and Automatic License Plate Recognition (ALPR/LPR)
Round 4: Multi-camera / cross-feed tracking and re-identification at city or campus scale
Round 5: Lightweight, real-time, browser/edge optimizations (ONNX, TensorRT, TF.js, WebGPU, model distillation, tracking-by-detection efficiency)
Round 6: Production case studies, think-tank / industry reports, privacy \& reliability considerations, comprehensive dos and don’ts, and synthesis of best architecture patterns

In every round collect:

- Key papers, articles, and technical blogs
- High-quality GitHub repositories and code snippets
- Success cases from top companies, research labs, and real deployments
- Concrete performance numbers, failure modes, and mitigation strategies
- Optimization techniques that improve speed/memory without destroying accuracy
- Explicit dos and don’ts

**Phase 7 – Synthesis \& Architecture Design**

- Synthesize all research into a clear recommended architecture for the Vision Agent.
- Define the identity management system (unique ID generation, feature banks, similarity thresholds, gallery management, last-seen logging).
- Specify how face, gait, clothing, and plate features will be extracted, fused, and matched.
- Design the cross-feed re-identification flow.
- Detail lightweight implementation choices suitable for the current tech stack.
- List concrete risks and mitigations (lighting, pose, occlusion, low resolution, privacy).

**Phase 8 – Implementation Plan \& Validation Strategy**

- Produce a step-by-step implementation plan that can be executed on the existing Vision Agent codebase.
- Define how tracking continuity will be measurably improved.
- Define success metrics (ID switch rate, re-ID accuracy, latency budget, memory footprint).
- Outline Playwright + quantitative tests for the new identity and cross-feed capabilities.

**Phase 9 – Final Research Report \& Recommendations**
Deliver a complete, well-structured report containing:

- Executive summary of findings
- Detailed results from the 6 research rounds with sources and references
- Recommended architecture and data structures
- Priority code-level changes and optimization opportunities
- Dos and don’ts checklist
- Concrete next implementation steps
- Open risks and proposed mitigations

**Success Criteria**

- Six thorough research rounds completed with progressive deepening.
- Strong coverage of person re-ID (face + gait + clothing), vehicle re-ID + LPR, multi-camera tracking, and real-time optimizations.
- Clear, actionable architecture that can be implemented in the Vision Agent while respecting performance and reliability constraints.
- Explicit sources, code references, and production lessons.
- Honest assessment of what is feasible in-browser vs. what requires edge/server support.

Begin immediately with Phase 0 (the pre-research strategy preamble). Then execute the six research rounds sequentially, performing retrospection after each one. Maximum depth and breadth. Do not stop until the full synthesis and implementation recommendations are delivered.

Here's the complete report covering all nine phases, six research rounds, and a production-ready architecture. Below is a structured summary of the key findings.

***

## Phase 0 — Pre-Research Strategy

The investigation was organized around four pillars: person re-ID (face + gait + clothing fusion), vehicle re-ID + LPR, multi-camera cross-feed tracking, and lightweight browser/edge optimization — executed across six progressive research rounds.

***

## Six Research Rounds — Key Findings

### Round 1: Foundational MOT

**BoT-SORT** and **DeepOC-SORT** dramatically outperform older trackers on identity stability (7 ID switches vs. 27 for ByteTrack) by integrating OSNet appearance embeddings. **ByteTrack** remains the speed king at 47 FPS for CPU-constrained deployments. The critical fix for "spotty" tracking is increasing `lost_track_buffer` to 60+ frames and using appearance-enabled trackers.[^1][^2][^3]

### Round 2: Person Re-ID

**ArcFace MobileFace** (13 MB ONNX) is the recommended face embedding model — production-ready with FAISS gallery search. **OSNet×0.25** (INT8 quantized, < 2 MB) achieves 92% Rank-1 on Market1501 at minimal compute. A **centroid-based gallery** (mean of last K embeddings per identity) is essential for both accuracy and memory control — this is the production pattern used by MICRO-TRACK.[^4][^5][^6]

### Round 3: Vehicle Re-ID + ALPR

**YOLOv8-s** achieves 99.3% mAP for plate detection at 30+ FPS; combined with EasyOCR yields 94% character recognition accuracy. Supplement plates with a ViT color/type classifier (96.0% accuracy) and keypoint-based structural features for occluded-plate scenarios. For night conditions, the DNDM framework (CVPR 2024) with glare suppression is the SOTA approach.[^7][^8][^9][^10][^11]

### Round 4: Multi-Camera Cross-Feed

The 2024 AI City Challenge winner (SJTU-LENOVO) used **geometric consistency + state-aware Re-ID correction** across 1,300 cameras and 3,400 people. The essential mechanism: **spatio-temporal feasibility gating** — a person in Camera A at time T cannot appear in Camera B until the physically plausible travel time has elapsed.[^12][^13][^14]

### Round 5: Lightweight Optimization

ONNX Runtime Web + WebGPU provides **3–5× speedup over WebGL** (ResNet50: 20–40ms vs. 77–225ms). TensorRT INT8 delivers 1.5–3.3× speedup at ~3–7 mAP cost. The full recommended model stack fits in **~57 MB** (YOLOv8n + SCRFD + ArcFace MobileFace + OSNet×0.25 + plate YOLOv8-s + EasyOCR). Run all inference in **Web Workers** to prevent UI blocking.[^15][^16]

### Round 6: Production \& Privacy

MICRO-TRACK (ECCV 2024) is the closest production reference: modular, real-time, open-set gallery, runs on Jetson AGX Xavier. Privacy compliance requires DPIA under GDPR Article 9 for biometric data, embedding-only storage (no raw frames), TTL expiry, and explicit consent mechanisms.[^17][^18][^19]

***

## Recommended Architecture (TL;DR)

```
YOLOv8n (detection) 
  → BoT-SORT (within-feed local tracking)
  → [Face: SCRFD + ArcFace] + [Body: OSNet×0.25] + [Gait: MediaPipe keypoints]
  → GlobalIdentityManager (centroid gallery + FAISS + spatio-temporal gating)
  → Persistent UUID per person, first/last-seen logging

YOLOv8-s (plate detection) → EasyOCR → VehicleIdentity (plate string + appearance)
```

The report covers all implementation code, data structures, Playwright test patterns, success metrics, and a full dos/don'ts checklist.
<span style="display:none">[^100][^101][^102][^103][^104][^105][^106][^107][^108][^109][^110][^111][^112][^113][^114][^115][^116][^117][^118][^119][^120][^121][^122][^123][^124][^125][^126][^127][^128][^129][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58][^59][^60][^61][^62][^63][^64][^65][^66][^67][^68][^69][^70][^71][^72][^73][^74][^75][^76][^77][^78][^79][^80][^81][^82][^83][^84][^85][^86][^87][^88][^89][^90][^91][^92][^93][^94][^95][^96][^97][^98][^99]</span>

<div align="center">⁂</div>

[^1]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12960806/table/Tab7/

[^2]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12859512/table/tbl0004/

[^3]: https://www.youtube.com/watch?v=7U8noi4QLik

[^4]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12852133/table/Tab3/

[^5]: https://neurips.cc/media/neurips-2025/Slides/117877.pdf

[^6]: https://trackers.roboflow.com/develop/trackers/core/deepsort/tracker/

[^7]: https://arxiv.org/html/2505.07530v1

[^8]: https://openaccess.thecvf.com/content/ICCV2025W/FoundGen-Bio/papers/Sony_Foundation_versus_Domain-specific_Models_Performance_Comparison_Fusion_and_Explainability_in_ICCVW_2025_paper.pdf

[^9]: https://github.com/yakhyo/face-reidentification

[^10]: https://github.com/yakhyo/face-reidentification/blob/main/README.md

[^11]: https://github.com/KaiyangZhou/deep-person-reid/issues/483

[^12]: https://www.semanticscholar.org/paper/Learning-Clothing-and-Pose-Invariant-3D-Shape-for-Liu-Kim/14edf267601563021ab0f8899ae90318b92dd33a

[^13]: https://github.com/ShiqiYu/OpenGait

[^14]: https://github.com/jdyjjj/All-in-One-Gait

[^15]: https://github.com/ShiqiYu/OpenGait/blob/master/configs/gaitedge/README.md

[^16]: https://pubmed.ncbi.nlm.nih.gov/40889312/

[^17]: https://www.computer.org/csdl/proceedings-article/iccv/2021/281200o4993/1BmGehnOaLS

[^18]: https://ar5iv.labs.arxiv.org/html/1905.00953

[^19]: https://huggingface.co/STMicroelectronics/osnet

[^20]: https://github.com/kaiyangzhou/deep-person-reid

[^21]: https://www.themoonlight.io/en/review/multi-camera-industrial-open-set-person-re-identification-and-tracking

[^22]: https://www.etasr.com/index.php/ETASR/article/view/9983

[^23]: https://github.com/Adilkhan04/ALPR

[^24]: https://arxiv.org/abs/2510.25032v1

[^25]: https://www.linkedin.com/posts/sanskriti-singh-923902221_automatic-license-plate-detection-using-yolov8-activity-7341060149391892480-vGay

[^26]: https://www.mdpi.com/2624-8921/8/2/36

[^27]: https://ojs.aaai.org/index.php/AAAI/article/view/32630/34785

[^28]: https://github.com/Rabusi/PATReId-Pose-Apprise-Transformer-Network-for-Vehicle-Re-Identification

[^29]: https://openaccess.thecvf.com/content/CVPR2024/papers/Li_Day-Night_Cross-domain_Vehicle_Re-identification_CVPR_2024_paper.pdf

[^30]: https://openaccess.thecvf.com/content/CVPR2024/html/Li_Day-Night_Cross-domain_Vehicle_Re-identification_CVPR_2024_paper.html

[^31]: https://openaccess.thecvf.com/content/CVPR2024W/AICity/papers/Xie_A_Robust_Online_Multi-Camera_People_Tracking_System_With_Geometric_Consistency_CVPRW_2024_paper.pdf

[^32]: https://www.aicitychallenge.org/2024-challenge-winners/

[^33]: https://www.bohrium.com/paper-details/cross-camera-multi-object-tracking-based-on-person-re-identification-and-spatial-temporal-constraints/861919418450444288-15541

[^34]: https://arxiv.org/pdf/2401.15288.pdf

[^35]: http://arxiv.org/abs/2401.15288v1

[^36]: https://arxiv.org/abs/2409.03879

[^37]: https://www.computer.org/csdl/journal/sc/5555/01/11513012/2gkdH3QasYU

[^38]: https://briancohn.com/2025/11/12/browser-based-inference/

[^39]: https://deepwiki.com/the0807/YOLOv8-ONNX-TensorRT

[^40]: https://huggingface.co/papers/2508.19600

[^41]: https://mmla.gse.harvard.edu/tools/blazepose3d/

[^42]: https://www.patebryant.com/articles/three-prompts-media-pipe-test

[^43]: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/

[^44]: https://medium.com/@kalyaninidhi94/top-10-dpia-must-dos-for-biometric-surveillance-under-gdpr-716d68e70e91

[^45]: https://papers.nips.cc/paper_files/paper/2025/file/07054a34f24ac3ef64c5f2fdf571b8c0-Paper-Conference.pdf

[^46]: https://arxiv.org/html/2509.18451v1

[^47]: https://www.sciencedirect.com/science/article/abs/pii/S0957417425004683

[^48]: https://jst-ud.vn/jst-ud/article/download/8995/6227/22460

[^49]: https://thegrenze.com/pages/servej.php?fn=232_25.pdf\&name=Integrated%20Multi-Object%20Tracking%20with%20Re-identification\&id=5592\&association=GRENZE\&journal=GIJET\&year=2025\&volume=11\&issue=2

[^50]: https://blog.roboflow.com/top-object-tracking-software/

[^51]: https://www.techscience.com/cmc/v81n1/58323

[^52]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12112576/

[^53]: https://www.diva-portal.org/smash/get/diva2:1886982/FULLTEXT01.pdf

[^54]: https://www.scitepress.org/Papers/2025/141558/141558.pdf

[^55]: https://arxiv.org/pdf/2602.01059v1.pdf

[^56]: https://www.sciencedirect.com/science/article/abs/pii/S0957417426002150

[^57]: https://openaccess.thecvf.com/content/ACCV2024/papers/Nguyen_CrossViT-ReID_Cross-Attention_Vision_Transformer_for_Occluded_Cloth-Changing_Person_Re-Identification_ACCV_2024_paper.pdf

[^58]: https://openaccess.thecvf.com/content/WACV2022W/RWS/papers/Bansal_Cloth-Changing_Person_Re-Identification_With_Self-Attention_WACVW_2022_paper.pdf

[^59]: https://github.com/mk-minchul/AdaFace/blob/master/README.md

[^60]: https://openreview.net/notes/edits/attachment?id=6vzEJ9VmHh\&name=pdf

[^61]: https://facecheck.id/Face-Search-face-recognition-api

[^62]: https://arxiv.org/html/2503.10759v1

[^63]: https://arxiv.org/html/2401.06960v2

[^64]: https://www.nature.com/articles/s41598-025-24967-9

[^65]: https://rjwave.org/jaafr/papers/JAAFR26A5025.pdf

[^66]: https://arxiv.org/html/2606.04684v1

[^67]: https://www.scribd.com/document/948821323/final4

[^68]: http://arxiv.org/pdf/2502.16815.pdf

[^69]: https://ascelibrary.org/doi/10.1061/9780784483565.042

[^70]: https://arxiv.org/html/2501.02270v1

[^71]: https://openaccess.thecvf.com/content/CVPR2024W/AICity/papers/Cherdchusakulchai_Online_Multi-camera_People_Tracking_with_Spatial-temporal_Mechanism_and_Anchor-feature_Hierarchical_CVPRW_2024_paper.pdf

[^72]: https://arxiv.org/html/2409.03879v1

[^73]: https://clarion.ai/strategies-for-multi-camera-person-re-identification/

[^74]: https://repositorium.sdum.uminho.pt/bitstream/1822/89555/1/paper_10.pdf

[^75]: https://arxiv.org/pdf/2309.13387.pdf

[^76]: https://www.ijfmr.com/papers/2024/1/13904.pdf

[^77]: https://cvpr.thecvf.com/media/cvpr-2024/Slides/30668.pdf

[^78]: https://github.com/SurajDonthi/Multi-Camera-Person-Re-Identification

[^79]: https://arxiv.org/pdf/2004.09632.pdf

[^80]: https://arxiv.org/pdf/2005.03293.pdf

[^81]: https://dl.acm.org/doi/10.1016/j.imavis.2023.104889

[^82]: https://www.eecs.qmul.ac.uk/~sgg/papers/LayneEtAl_REIDSpringer14.pdf

[^83]: https://fr.mathworks.com/help/fusion/ug/multi-object-tracking-with-deepsort.html

[^84]: https://stackoverflow.com/questions/70494402/deepsorts-feature-extractor-cannot-be-used-for-person-reidentification/71484132

[^85]: https://arxiv.org/html/2409.06617v2

[^86]: https://arxiv.org/html/2407.04249v2

[^87]: https://www.scitepress.org/PublishedPapers/2021/103415/103415.pdf

[^88]: https://pmc.ncbi.nlm.nih.gov/articles/PMC11548255/

[^89]: https://medium.com/axinc-ai/deepsort-a-machine-learning-model-for-tracking-people-1170743b5984

[^90]: https://bura.brunel.ac.uk/bitstream/2438/26144/3/FullText.pdf

[^91]: https://publikationen.bibliothek.kit.edu/1000161972/151301306

[^92]: https://arxiv.org/abs/2401.08281

[^93]: https://arxiv.org/html/2211.14742v2/

[^94]: https://link.springer.com/article/10.1007/s00521-019-04590-2

[^95]: https://medium.com/@zediot/deploying-yolov8-on-rk3566-a-deep-dive-into-model-conversion-quantization-and-real-world-383d3de7e39a

[^96]: https://github.com/ultralytics/ultralytics/issues/4097

[^97]: https://medium.com/@sulavstha007/quantizing-yolo-v8-models-34c39a2c10e2

[^98]: https://github.com/ultralytics/ultralytics/issues/10660

[^99]: https://di0zxmb8pwajl.cloudfront.net/kiisc/conference/mobisec2024/8B-1.pdf

[^100]: https://www.mobbeel.com/en/blog/privacy-and-biometric-data-protection-biometrics-and-gdpr/

[^101]: https://christianjmills.com/posts/pytorch-train-object-detector-yolox-tutorial/ort-tensorrt-ubuntu/

[^102]: https://www.diva-portal.org/smash/get/diva2:2007312/FULLTEXT01.pdf

[^103]: https://medium.com/latinxinai/rf-detr-meets-openvino-real-time-int8-object-detection-on-an-intel-igpu-da8ddba3de01

[^104]: https://arno.uvt.nl/show.cgi?fid=143731

[^105]: https://arxiv.org/html/2509.25164v4

[^106]: https://cs231n.stanford.edu/2024/papers/person-re-identification-in-a-video-sequence.pdf

[^107]: https://www.kaggle.com/code/iiierie/person-re-identification-using-torchreid

[^108]: https://openaccess.thecvf.com/content/CVPR2024W/AICity/papers/Specker_OCMCTrack_Online_Multi-Target_Multi-Camera_Tracking_with_Corrective_Matching_Cascade_CVPRW_2024_paper.pdf

[^109]: https://researchportalplus.anu.edu.au/en/publications/the-8th-ai-city-challenge/

[^110]: https://arxiv.org/pdf/2003.07618.pdf

[^111]: https://ar5iv.labs.arxiv.org/html/2204.10380

[^112]: https://arxiv.org/html/2404.09432v1

[^113]: https://www.forasoft.com/learn/ai-for-video-engineering/articles-ai/multi-object-tracking-deepsort-bytetrack-ocsort

[^114]: https://www.aicitychallenge.org/2024-challenge-tracks/

[^115]: https://link.springer.com/article/10.1007/s00530-023-01077-y

[^116]: https://openaccess.thecvf.com/content/CVPR2021W/AICity/papers/Fernandez_Vehicle_Re-Identification_Based_on_Ensembling_Deep_Learning_Features_Including_a_CVPRW_2021_paper.pdf

[^117]: https://ar5iv.labs.arxiv.org/html/1905.08997

[^118]: https://dl.acm.org/doi/10.1109/TMM.2020.2985525

[^119]: https://pureadmin.qub.ac.uk/ws/files/219698510/ICPR20_home_papercept_iapr.papercept.net_www_conferences_conferences_ICPR20_submissions_2516_MS.pdf

[^120]: https://openaccess.thecvf.com/content/CVPR2023W/AICity/papers/Huang_Enhancing_Multi-Camera_People_Tracking_With_Anchor-Guided_Clustering_and_Spatio-Temporal_Consistency_CVPRW_2023_paper.pdf

[^121]: https://www.themoonlight.io/zh/review/multi-camera-industrial-open-set-person-re-identification-and-tracking

[^122]: https://doras.dcu.ie/26478/1/RWSatWACV2022_Dietlmeier_camera_ready.pdf

[^123]: https://arxiv.org/pdf/2408.05558.pdf

[^124]: https://pdfs.semanticscholar.org/dfc7/d4f76bf3a5dc8419ca1d27a714e0a56a6429.pdf

[^125]: https://www.youtube.com/watch?v=IatrRfXrdnE

[^126]: https://dev.to/beck_moulton/from-pixels-to-physical-therapy-building-a-real-time-pose-correction-system-with-mediapipe-and-3p2d

[^127]: https://openaccess.thecvf.com/content/CVPR2024/html/Rochow_FSRT_Facial_Scene_Representation_Transformer_for_Face_Reenactment_from_Factorized_CVPR_2024_paper.html

[^128]: https://ijirt.org/publishedpaper/IJIRT178848_PAPER.pdf

[^129]: https://ieeexplore.ieee.org/document/10390506/

