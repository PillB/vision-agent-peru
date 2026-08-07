# Model and adapter inventory

| Candidate | Revision/license | Runtime status | Decision |
|---|---|---|---|
| [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) | npm 2.2.3, Apache-2.0; graph not content-hashed | Disabled | Useful baseline, but the remote graph does not meet immutable-artifact acceptance |
| [YOLOv10n](https://github.com/THU-MIG/yolov10) | revision unverified, AGPL-3.0 | Unavailable | Adapter, license, and held-out browser benchmark pending |
| [YOLOS-tiny](https://huggingface.co/hustvl/yolos-tiny) | `1a00cc14a139ff40bac9aa00c745915cb7b5b751`, Apache-2.0 | Experimental WASM adapter | Active detector candidate; no accuracy/FPS claim |
| [ByteTrack](https://github.com/FoundationVision/ByteTrack) compatible | local algorithm, MIT upstream | Experimental | Two-stage high/low-confidence recovery; not full parity |
| [BoT-SORT](https://github.com/NirAharon/BoT-SORT) style | upstream MIT | Research-only | Appearance-assisted tracking withheld pending privacy and MOT evaluation |
| [CLIP](https://github.com/openai/CLIP) browser port | `91f7a4bfa256ca85b019500008a355e2da0fe641`, Apache-2.0 | Experimental WASM/WebGPU adapter | Optional text/reference retrieval; scores are not probabilities |
| [MobileCLIP](https://github.com/apple/ml-mobileclip) | research-only released weights | Research-only | Not in normal evidence path |
| [SigLIP](https://huggingface.co/google/siglip-base-patch16-224) | `cc3289c7ee0594a9e640dbf5580511cdcca21837`, Apache-2.0 | Not selected | About 813 MB model footprint is unsuitable as the default |

Active model revisions are passed to `from_pretrained`/`pipeline`; placeholder candidates cannot enter a runtime plan. WebGPU is optional and WASM is the explicit fallback.

See `artifacts/benchmarks/browser-model-benchmark.json`: missing accuracy and throughput values remain `null`, never invented.
