# Model and adapter inventory

| Candidate | Revision/license | Runtime status | Decision |
|---|---|---|---|
| [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) | npm 2.2.3, Apache-2.0; graph not content-hashed | Experimental TF.js adapter | Explicitly selectable baseline; remote graph integrity remains a visible supply-chain limitation |
| [YOLOv10n](https://huggingface.co/onnx-community/yolov10n) | `57657320425ee34056408a57ad9d29c4d4815bd8`, AGPL-3.0 | Experimental WASM adapter | Explicitly selectable; AGPL obligations and browser calibration remain deployment gates |
| [YOLOS-tiny](https://huggingface.co/hustvl/yolos-tiny) | `e2f9c7673f0fa61849efe2b56a0d7774779ebb9d`, Apache-2.0 | Experimental WASM adapter | Active detector candidate; no accuracy/FPS claim |
| [ByteTrack](https://github.com/FoundationVision/ByteTrack) compatible | local algorithm, MIT upstream | Experimental | Two-stage high/low-confidence recovery; not full parity |
| [SegFormer-B0](https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512) | `d3e5499fa8701ff0453ca940a8dfeae39b2f1504`, Apache-2.0 | Experimental WASM adapter | Water-class masks are localized; flood-domain calibration remains pending |
| [YOLOv8n-Pose](https://huggingface.co/Xenova/yolov8n-pose) | `da4224085e2f6ce4c9ff9b670e28765194619db2`, AGPL-3.0 | Experimental WASM adapter | Keypoints and box geometry produce localized fall candidates; not a medical conclusion |
| [BoT-SORT](https://github.com/NirAharon/BoT-SORT) style | upstream MIT | Research-only | Appearance-assisted tracking withheld pending privacy and MOT evaluation |
| [CLIP](https://github.com/openai/CLIP) browser port | `91f7a4bfa256ca85b019500008a355e2da0fe641`, Apache-2.0 | Experimental WASM/WebGPU adapter | Optional text/reference retrieval; scores are not probabilities |
| [MobileCLIP](https://github.com/apple/ml-mobileclip) | research-only released weights | Research-only | Not in normal evidence path |
| [SigLIP](https://huggingface.co/google/siglip-base-patch16-224) | `cc3289c7ee0594a9e640dbf5580511cdcca21837`, Apache-2.0 | Not selected | About 813 MB model footprint is unsuitable as the default |

Hugging Face model revisions are passed to `from_pretrained`/`pipeline`; placeholder candidates cannot enter a runtime plan. COCO-SSD is the documented exception: its npm code is pinned but its upstream graph is not content-hashed, so the UI and governance inventory retain that risk. WebGPU is optional and WASM is the explicit fallback.

See `artifacts/benchmarks/browser-model-benchmark.json`: missing accuracy and throughput values remain `null`, never invented.
