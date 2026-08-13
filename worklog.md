# Vision Agent Perú — Agentic Intelligence Dashboard

> Worklog for building a VP-grade dashboard that visualizes:
> 1. The **Entity Co-occurrence & Correlation Network** of entities identified across camera feeds.
> 2. An **n8n-style Agent Decision Flow Graph** that lights up as the agent perceives → reasons → branches → acts → verifies, per use case.

Reference repo: https://github.com/PillB/vision-agent-peru
Reference site: https://pillb.github.io/vision-agent-peru/

---
Task ID: 1
Agent: Z.ai (main)
Task: Analyze the vision-agent-peru repo + live site, then build the network graph + agent decision flow dashboard.

Work Log:
- Cloned the reference repo to `/home/z/my-project/download/vision-agent-peru/repo`.
- Read `AGENTS.md`, `use-cases.ts`, `agent.ts`, `agentic-response.ts`, `co-occurrence-graph.tsx`, `agent-trace.tsx`.
- Confirmed the reference architecture: 9-stage agentic loop (OBSERVE → VALIDATE_EVIDENCE → POLICY → JUDGE → VALIDATE_JUDGE → PROPOSE_ACTION → APPROVAL → EXECUTE → VERIFY_OUTCOME), 15 use cases across commercial + disaster categories, capability levels traditional/mldl/cognitive/agentic.
- Confirmed the co-occurrence network model: nodes = tracked subjects (sized by detectionCount), edges = co-occurrence (familiarityScore, proximityScore, encounterCount, sharedFrames, sharedDurationMs).
- Designed the build plan: custom SVG + framer-motion visualizations (no heavy graph lib) for tight control over the n8n aesthetic.

Stage Summary:
- Reference architecture fully understood.
- Building two flagship visualizations on `/`:
  1. **Correlation Network** — force-directed SVG graph of entity co-occurrence + correlation scores across multiple simulated feeds.
  2. **Agent Decision Flow** — n8n-style DAG of the 9-stage loop with branching by tier / judge verdict / approval gate, animated token flow, active-node glow, per-use-case adaptation.
- Stack: Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + framer-motion, pure SVG rendering.

---
Task ID: 2
Agent: Z.ai (main)
Task: Build + verify the two flagship visualizations (correlation network + n8n-style agent decision flow).

Work Log:
- Built `src/lib/vision/types.ts` — domain types mirroring the reference repo (EntityNode, CorrelationEdge, UseCase, FlowNode, FlowEdge, AgentFlowRun, TIER_META).
- Built `src/lib/vision/use-cases.ts` — 15 use cases across commercial + disaster, 4 capability levels.
- Built `src/lib/vision/entity-network.ts` — seeded multi-feed entity tracker simulator (4 feeds, ~34 entities, ~150 correlations, within-feed + cross-feed edges).
- Built `src/lib/vision/agent-flow.ts` — 9-stage DAG node/edge model + per-use-case deterministic trace generator (branches by tier / judge verdict / approval gate / outcome).
- Built `src/components/vision/entity-correlation-graph.tsx` — SVG force-directed network with hover tooltips, pulsing hazards, cross-feed dashed edges, tier rings, detail popover.
- Built `src/components/vision/agent-decision-flow.tsx` — n8n-style SVG DAG with curved bezier edges, active-node glow, animated token traveling along the active edge, branch labels, per-stage status.
- Built `src/app/page.tsx` — VP dashboard: sticky header, 6 KPI cards, tabbed views, use-case selector, playback controls (play/pause/step/speed/next-cycle), reasoning side panel, stage trace timeline, ranked correlations, live feeds roster, use case gallery, sticky footer.
- Verified with agent-browser + VLM: flow tab shows connected nodes with glowing edges + branch labels; network tab shows colored nodes (persona/hazard/etc.) + edges + pulsing hazards + legend. 71 nodes / 154 edges rendered in the SVG.

Stage Summary:
- v1 dashboard is LIVE and functional on `/`. Both visualizations render and are interactive.
- Agent-browser + VLM confirm clean rendering, no errors, responsive layout, sticky footer.
- Next iterations: compact the flow vertical layout (less empty space), auto-play hint on load, page metadata title, keyboard shortcuts, mobile responsiveness, more granular stage detail inspector.

---
Task ID: 3
Agent: Z.ai (main)
Task: Iterate on the dashboard — compact flow layout, keyboard shortcuts, cycle history, QA verification.

Work Log:
- Compacted the agent decision flow: NODE_W 150→138, NODE_H 76→70, COL_GAP 60→38, ROW_GAP 56→44, backbone y 280→150. Canvas is now auto-fit from node positions (no fixed 1280×720), with preserveAspectRatio + minWidth for responsive horizontal scroll.
- Made the Tabs controlled (value/onValueChange) so the active tab is tracked.
- Added keyboard shortcuts: Space=play/pause, ←/→=step, R=reset, N=next cycle. Added a `<kbd>` hint row in the playback bar.
- Added a "Recent cycles" history panel that logs completed agent traces (use case, tier, outcome, actions) as an audit log, with a hint when empty.
- Refactored `run` from state to useMemo (derived from useCase + cycle) to eliminate setState-in-effect lint errors. Moved playback reset into the onChange handlers.
- Excluded `download/**`, `tests/**`, `mini-services/**` from ESLint (the cloned reference repo was producing 70 unrelated errors).
- Updated page metadata title to "Vision Agent Perú — Agentic Intelligence Dashboard".
- Verified with agent-browser + VLM:
  - Flow tab: 10 nodes rendered, compact 3-row layout, curved edges with branch labels (OBS OK, VALID), active node glowing yellow ring during playback, token animation along edges. No overflow/cutoff.
  - Network tab: 71 nodes / 154 edges / 102 texts rendered, colored nodes (blue person, green vehicle, purple object, red hazard), pulsing red hazard nodes with glowing rings, edges, labels (Persona-B, Fuego-Z1, Auto), legend, top correlations list, live feeds roster.
  - Sticky footer verified (footerBottom 576.5 = viewport 577).
  - `bun run lint` passes clean (0 errors).

Stage Summary:
- Dashboard is VP-ready: clean dark theme, two flagship visualizations both interactive and animated, full control surface (playback + filters + history + keyboard), responsive layout, sticky footer.
- Next iterations (handed off to the recurring webDevReview cron): add a node-detail inspector on flow click, a "compare two use cases" split view, mobile-specific layout tweaks, an exported SVG/PNG of the current flow, and live "agent heartbeat" mini-ticker in the header.
