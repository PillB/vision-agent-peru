# Public workflow research and open-pattern matrix

This is a clean-room review of current public documentation. It does not infer proprietary internals, copy proprietary code, or claim parity.

| Product/public source | Public workflow observed | Independently adopted open pattern |
|---|---|---|
| [Flock FreeForm](https://www.flocksafety.com/products/flock-freeform) | Natural-language description search and iterative investigation | Natural-language query plus visible filters and candidate review |
| [Genetec Investigation](https://techdocs.genetec.com/r/en-US/Security-Center-SaaS-User-Guide/Finding-a-person-of-interest-from-the-Investigation-task-in-Security-Center-SaaS) | Start from time/camera, review a person of interest, inspect results | Camera/time constraints and reference-result workflow |
| [Axis Scene Metadata](https://www.axis.com/products/axis-scene-metadata) and [Forensic Search](https://www.axis.com/solutions/forensic-search) | Structured object metadata and server-independent filtering concepts | Object class, camera, location, and time metadata |
| [BriefCam](https://www.briefcam.com/) | Video synopsis/search and review-oriented analytics | Timeline candidates, recency/relevance ordering, human review |
| [Avigilon Appearance Search](https://docs.avigilon.com/bundle/unity-video-investigators-8-5/page/using/appearance-search.htm) | Appearance-based candidate search seeded from an observation | Appearance-similar candidates with explicit non-identity disclaimer |
| [Verkada Search](https://docs.verkada.com/docs/verkada-search-overview.pdf) and [Unified Timeline](https://help.verkada.com/verkada-cameras/video-streaming-and-sharing/view-historical-footage/history-player-search-and-unified-timeline) | People/vehicle history with historical timeline review | Timeline thumbnails and entry/exit context |
| [Milestone evidence workflow](https://www.milestonesys.com/articles/finding-video-evidence-in-XProtect/) | Search, investigate, bookmark, and export evidence | Review queue and bounded evidence export |
| [March Networks Command Client](https://www.marchnetworks.com/products/enterprise-video-management/command-client/) | Investigation, case/evidence organization, controlled sharing | Incident grouping and explicit external transmission boundary |
| [Bosch Video Analytics manual](https://cdn.commerce.boschsecurity.com/public/documents/VCA_8.10_Operation_Manual_enUS_88154623371.pdf) | Metadata/rule-driven video analytics | Deterministic evidence contracts and negative controls |
| [Spot AI Cases](https://www.spot.ai/blog/how-to-resolve-incidents-faster-with-cases) | Save clips into cases and share findings | Local incident records, outcomes, evidence export |
| [NVIDIA VSS](https://docs.nvidia.com/vss/latest/) | Video search/summarization service workflows | Capability-driven pipeline stages; no parity claim |
| [OpenVINO MobileCLIP video search](https://docs.openvino.ai/2024/notebooks/mobileclip-video-search-with-output.html) and [person tracking](https://docs.openvino.ai/2024/notebooks/person-tracking-with-output.html) | Browser/edge-feasible embedding retrieval and tracking examples | Separate local tracks from retrieval candidates; benchmark before promotion |

## Pattern boundary

The rebuild uses common interface patterns—query, filters, ranking, timeline, candidates, review, export, audit. It does not claim the scale, accuracy, integrations, data sources, or proprietary implementations of any product above.
