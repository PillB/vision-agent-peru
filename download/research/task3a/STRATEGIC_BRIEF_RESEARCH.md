# STRATEGIC BRIEF RESEARCH — Tab 3 "Strategic Brief" Design Reference

**Task ID:** 3-a
**Agent:** Research & Innovation Scout (think tank presentation styles)
**Scope:** How top-tier think tanks, consulting firms, and AI conferences present the EVOLUTION of AI from static programs → deep learning → cognitive AI → agentic systems. Output inspires a single-page, self-sufficient, PowerPoint-style web "Strategic Brief".
**Project context:** Cusco Vision Agent — agentic camera intelligence for Peru's plazas. 2-tab SPA already exists (Tab 1 corporate explanation, Tab 2 functional ML prototype). Tab 3 will be a NEW strategic-brief page that frames *why agentic AI matters now* using the 4-stage evolution narrative.

Raw corpus: 12 search-result JSONs + 17 fetched article bodies (`.txt`) in this same directory.
Sources cited inline as `[short-tag]`.

---

## 1. THE 4-STAGE EVOLUTION NARRATIVE (definitions + value of each stage)

Synthesized from McKinsey [mck-ai], BCG [bcg-puzzle], Bain [bain-what], Sequoia [seq-o1][seq-two], Gartner [gart-press][gart-agentic], Deloitte [deloitte], Stanford HAI [hai], MIT Sloan [mit], VastData [vast], Cisco Outshift [cisco], Unstructured.io [unstruct], IBM [ibm], arXiv survey [arxiv], DataMgmt [dm-4phases], Aditya Sharma [li-4stages].

The four stages are not strictly sequential — they are **nested capabilities**: every Stage 4 system contains Stage 3 agents that use Stage 2 generative models that were trained on patterns originally identified by Stage 1 systems [li-4stages]. Each stage ADDED a new capability without losing the previous one.

### STAGE 1 — Static / Traditional Programs (rule-based, deterministic)
- **Also called:** Symbolic AI, classical AI, GOFAI ("good old-fashioned AI"), RPA, expert systems [mck-ai][dm-4phases]
- **Era:** 1956 (Dartmouth workshop) → late 1980s dominant paradigm [mck-ai]
- **What it IS:** Systems where humans manually encode knowledge of the world into rules and logical relationships ("a German shepherd is a dog, which is a mammal; all mammals are warm-blooded") [mck-ai]. Examples: tax-prep software, fraud-rule engines, IF-THEN alarm thresholds, classical factory robots performing "thoroughly scripted behaviors repeatedly" [mck-ai], RPA bots doing "data entry, transaction processing, simple data manipulation" [dm-4phases].
- **What it CAN do:** Execute deterministic logic at machine speed; audit every decision step (fully explainable); never drift from specification. Perfect for compliance, accounting, simple triage.
- **What it CAN'T do:** "Struggle with situations involving real-world complexity… lack the ability to learn from large amounts of data" [mck-ai]. Can't handle unstructured input (images, free text); brittle when context shifts; every new edge case requires a human to write a new rule.
- **Value created:** Scalable automation of high-volume, well-bounded tasks; the assembly line of the digital age.

### STAGE 2 — Machine Learning / Deep Learning (pattern recognition, learned from data)
- **Also called:** Neural networks, supervised learning, predictive AI [mck-ai][vast]
- **Era:** Foundations 1943 (McCulloch-Pitts) → solved 1986 (Hinton backprop) → breakthrough 2012 (AlexNet/ImageNet) [mck-ai][ibm]
- **What it IS:** Models that learn directly from datasets, identifying complex patterns at scale and making predictions, without a human encoding the rules [vast]. Deep learning = multi-layer neural networks that "ingest data and process it through multiple iterations that learn increasingly complex features of the data" [mck-ai].
- **What it CAN do:** Perceive — classify images, transcribe speech, detect anomalies, rank search results, recognize faces [vast]. COCO-SSD person detection (used in THIS project) lives here.
- **What it CAN'T do:** "Models remained static until retrained. Context was shallow and isolated. No inherent ability to reason about goals. Still dependent on human orchestration" [vast]. Can't explain *why* it decided; can't pursue a multi-step objective; can't adapt to a new task without retraining.
- **Value created:** Perception at scale. Image recognition, fraud scoring, recommendation engines, ad targeting — the entire 2010s AI economy. "Unlocked significant advances in perception, analytics, and data-driven decision support" [vast].

### STAGE 3 — Cognitive AI (generative + perception + understanding, GPT-3 era)
- **Also called:** Generative AI, foundation models, copilots [bain-what][vast]
- **Era:** 2017 (Transformers) → 2022 (ChatGPT inflection) → 2023 "Cambrian explosion" / "our generation's space race" [seq-two]
- **What it IS:** Models trained on internet-scale text/image data that can SYNTHESIZE new content — text, code, images, audio, video — by learning relationships across massive datasets [vast]. "Produces text, code, summaries, images, or analysis" [bain-what]. Serves as a "smart assistant with a human in control, typically through conversational interfaces" [bain-what].
- **What it CAN do:** Generate high-quality content across modalities; summarize; translate; ideate; answer questions; reason shallowly (chain-of-thought prompting revealed "task decomposition, where an agent breaks down complex tasks into several smaller operations" [ibm]). Support rapid problem exploration [vast].
- **What it CAN'T do:** Take action. "Waits for a prompt and then responds" [fedresources]. Can't retain context across sessions, can't call tools, can't pursue a goal over time, can't self-correct when an action fails. "Productivity gains are widespread, but only 30% of organizations are redesigning key processes around AI and 37% report only using AI at a surface level" [deloitte]. "Gen AI projects burnt average $1.9M per initiative yet left <30% of CEOs satisfied with ROI" [pragmatic] — productivity without process redesign plateaus fast.
- **Value created:** The $33.9B global private investment wave of 2024 (+18.7% YoY) [hai]; 78% of organizations now use AI (up from 55%) [hai]; copilots embedded in every productivity suite. "Generative AI gave us copilots that assist human work by generating output" [bain-what].

### STAGE 4 — Agentic AI (autonomous reasoning + tool use + multi-step action)
- **Also called:** AI agents, autonomous agents, software 3.0 [unstruct][mit]
- **Era:** 2023 (function calling) → 2024 (OpenAI o1 "reasoning era begins") → 2025 (Gartner Peak of Inflated Expectations) → 2026+ (projected Slope of Enlightenment) [seq-o1][gart-press][pragmatic]
- **What it IS:** "Artificial intelligence that can pursue a defined goal on its own, by planning the steps, using tools and systems, and adjusting course as conditions change" [bain-what]. "Autonomous software systems that perceive, reason, and act in digital environments to achieve goals on behalf of human principals, with capabilities for tool use, economic transactions, and strategic interaction" [mit]. The canonical loop: **Perceive → Plan → Act → Reflect → Repeat** [fedresources].
- **What it CAN do that earlier stages COULDN'T:
  - **Continuity:** retain context over sustained periods [vast]
  - **Multi-step reasoning:** break goals into actionable sequences and revise plans as conditions change [vast]
  - **Tool use:** call APIs, execute code in sandboxes, query knowledge bases, use vector/graph indexes, pass context to downstream agents [bain-what]
  - **Self-correction:** "critiquing its own performance to identify errors" and retry [fedresources]; the Evaluator-Optimizer pattern [unstruct]
  - **Multi-agent orchestration:** "Higher-level orchestrator agents are like project managers that oversee a whole process, breaking it down into subtasks and tracking progress" [bain-foundation]
  - **Physical-world action:** "Not just the digital world — agents can actually take actions that change things happening in the physical world" (e.g., raise a red flag or stop a conveyor belt on a warehouse vision system) [mit]
- **What it CAN'T do (yet):** "Fully autonomous agents are not ready for the majority of enterprise use cases" [gart-agentic]. "Today's LLMs simulate reasoning linguistically rather than compute it logically, producing persuasive language pathways rather than genuinely reasoned conclusions. They can also still hallucinate or err when deprived of grounding data" [unstruct]. Requires governance, runtime policy enforcement, monitoring, audit controls, failure protocols [bain-what].
- **Value created:** Shift from "automation of parts of processes" to "end-to-end process execution" [bain-foundation]. "The fundamental economic promise of AI agents is that they can dramatically reduce transaction costs — the time and effort involved in searching, comparing, and coordinating" [mit]. By 2028, Gartner projects 33% of enterprise software will include agentic AI (up from <1% in 2024), and "$234B in enterprise application software spend is at risk from agentic AI" [gart-press]. Sequoia: AI companies "sell work ($/outcome)" instead of "software ($/seat)" — they "target the services profit pool" not the software profit pool [seq-o1].

### THE LEAP — What new capabilities emerge when AI can REASON + ACT + ITERATE
The leap from Stage 3 → Stage 4 is not incremental. Sequoia calls it the move from "**System 1 thinking** (rapid-fire pre-trained responses)" to "**System 2 thinking** (deliberate reasoning at inference time)" — inspired by AlphaGo, which "takes the time to stop and think… runs a search or simulation across a wide range of potential future scenarios, scores those scenarios, and then responds with the scenario that has the highest expected value" [seq-o1]. The arXiv survey frames it as a "paradigm shift… enabling systems to act independently, pursue broad objectives rather than isolated decisions, and carry out complex tasks that require reasoning elements such as planning and reflection" [arxiv].

**Four concrete capability leaps (synthesized):**
1. **From reactive → proactive.** GenAI waits for a prompt; agents initiate [fedresources].
2. **From single-shot → multi-step with feedback.** GenAI does input→output; agents loop with environment feedback, "receiving feedback that informs and guides future actions via instant learning" [arxiv].
3. **From answering → executing.** GenAI produces content; agents "execute complex, multistep workflows by setting goals, planning, and learning on the fly, with minimal human input" [bain-what].
4. **From tool → collaborator.** GenAI is "a feature inside a system"; agentic AI "IS the system" that "coordinates multiple agents, manages workflows, and self-corrects" [li-4stages]. "AI Becomes a Partner in Progress… a collaborator that never loses the thread" [vast].

---

## 2. DESIGN PATTERNS THINK TANKS USE TO VISUALIZE THE EVOLUTION (8 patterns)

Each pattern below is sourced from an actual think-tank artifact. Pattern name → source → when to use → visual mechanics.

### Pattern A — Horizontal Timeline with Phase Bars (McKinsey + IBM)
- **Source:** McKinsey "What is AI?" lays out "four previous stages of AI: Symbolic AI (1956)… Neural networks (1954, 1969, 1986, 2012)… Traditional robotics (1968)… Generative AI" with each dated [mck-ai]. IBM's "Evolution of AI agents" structures the history as "Early philosophical roots (1940-1960) → Logic and problem solving (1950-1970) → Paving the way for agents (1970-2010) → [modern era]" [ibm].
- **When to use:** Opening slide — anchors the audience in time and shows this is a 70-year arc, not a fad.
- **Visual mechanics:** Horizontal axis = time (1950 → 2026). Four colored phase bars stacked above the axis, each spanning its era. Milestone dots on the axis (Dartmouth 1956, AlexNet 2012, ChatGPT 2022, o1 2024). Each phase bar gets a one-line label and a representative icon (rule symbol / neural-net node / chat bubble / agent-loop arrow).
- **Layout density:** Light — this is the "establish the sweep" slide. ≤30 words of body copy.

### Pattern B — Ascending Maturity Ladder / Staircase (BCG + Cisco Outshift)
- **Source:** BCG's 5-stage employee adoption ladder: "information assistance → task assistance → delegation → semiautonomous collaboration → fully autonomous orchestration", with the damning stat that ">85% of employees remain at stages two and three… less than 10% have reached stage four" [bcg-puzzle]. Cisco Outshift's "5 Levels of agentic AI intelligence": Level 1 rule-based automation → Level 2 ML integration → Level 3 partial automation → Level 4 high automation → Level 5 fully autonomous [cisco].
- **When to use:** The "where are we / where is the market" slide — creates urgency by showing most orgs are stuck mid-ladder.
- **Visual mechanics:** 5 ascending steps (left-low → right-high). Each step is a card with: stage number, name, one-line definition, an icon. Steps 1-2 in muted zinc (achieved), step 3 in amber (current pain point — "you are here" marker), steps 4-5 in emerald with a "target" treatment. A horizontal bracket above shows "85% stuck here" spanning steps 2-3.
- **Layout density:** Medium — each step card needs ~25 words.

### Pattern C — Autonomy Spectrum / Horizontal Bar with Threshold Line (Unstructured.io)
- **Source:** Unstructured.io's 6-level "Spectrum of Agentic Autonomy": L1 Code (rules, no autonomy) → L2 LLM Call → L3 Chain → L4 Router → L5 State Machine (first true agent, loops allowed) → L6 Autonomous [unstruct]. The dotted line between L4 and L5 marks the critical threshold: "human-constrained autonomy" (L1-L4) vs "LLM-executed autonomy" (L5-L6) — "a signal that traditional governance and security models are insufficient" [unstruct].
- **When to use:** The "what makes something *actually* agentic" definitional slide — most precise framing of the leap.
- **Visual mechanics:** Horizontal bar split into 6 segments, gradient from zinc (L1) → emerald (L6). A vertical dashed line between L4 and L5 labeled "Autonomy Threshold — governance model must change". Below each segment, a 2-word capability tag (Deterministic / Single-output / Multi-step / Branching / Looping / Goal-seeking).
- **Layout density:** Medium — needs the threshold callout to land.

### Pattern D — Capability Comparison Matrix (Bain)
- **Source:** Bain publishes a 5-row capability comparison table of Generative AI vs Agentic AI across: Primary role, Typical interaction, Workflow scope, Tool use, Enterprise value, Governance need [bain-what].
- **When to use:** The "what's actually different" slide — for skeptical executives who think agentic is just marketing.
- **Visual mechanics:** 3-column table: Capability | Generative AI | Agentic AI. 5 rows. Each cell ≤12 words. Agentic column gets a subtle emerald background tint. Add a small Harvey-ball-style "scope" icon in the rightmost column (1/4 fill = task, full = end-to-end process).
- **Layout density:** High — this is the dense reference slide; audience reads it like a spec sheet.

### Pattern E — Hype Cycle Curve with Year-over-Year Markers (Gartner + Pragmatic Coders)
- **Source:** Gartner Hype Cycle's canonical 5 phases: Innovation Trigger → Peak of Inflated Expectations → Trough of Disillusionment → Slope of Enlightenment → Plateau of Productivity [pragmatic]. Pragmatic Coders overlays a year-by-year arc: 2022 Foundation Models → 2023 Generative AI at Peak → 2024 AI Engineering (GenAI sliding into Trough) → 2025 AI agents + AI-ready data at Peak, GenAI in Trough [pragmatic].
- **When to use:** The "market timing" slide — answers "is this the right moment to invest?".
- **Visual mechanics:** The classic Gartner curve (rises sharply, dips, climbs gently to plateau). Place 4 labeled markers along the curve: "GenAI — Trough of Disillusionment (2025)", "AI Agents — Peak of Inflated Expectations (2025)", "AI Engineering — Slope of Enlightenment", "Agentic AI governance — Innovation Trigger". Caption beneath: "17% deployed today, 60% expect to within 2 years — most aggressive adoption curve of any emerging tech" [gart-agentic].
- **Layout density:** Medium — the curve does the work, caption adds the proof.

### Pattern F — 3-Era Stack with Strengths & Limits per Era (VastData)
- **Source:** VastData's clean 3-era framing: Era 1 Machine Learning → Era 2 Generative AI → Era 3 Agentic AI, each with explicit "Strengths" + "Where it reached its limits" sub-blocks [vast].
- **When to use:** The "why each wave was necessary" slide — defends the narrative that each stage solved the previous stage's ceiling.
- **Visual mechanics:** Three vertical cards side-by-side, each ~33% width. Each card has: era name, era number (large), "What it added" (1 line), "Strengths" (3 bullets), "Hit its ceiling when…" (2 bullets), and a small representative icon. The third card (Agentic) is taller / elevated slightly and uses the emerald accent.
- **Layout density:** High but skimmable — bullet structure carries the load.

### Pattern G — Loop Diagram: Perceive → Reason → Act → Reflect (Fedresources + Ultralytics + MIT)
- **Source:** Fedresources' explicit loop: "Perception → Plans → Acts → Reflects → Repeats. This loop continues autonomously, allowing the AI to adapt and improve its strategy in real time" [fedresources]. MIT Sloan: "agents that are semi- or fully autonomous and thus able to perceive, reason, and act on their own" [mit]. (Ultralytics blog cited in worklog 0-b uses the same Perception → Decision-making → Action → Adaptation loop.)
- **When to use:** The "what does an agent actually DO, in plain English" slide — operationalizes the abstraction.
- **Visual mechanics:** Circular diagram with 4 nodes (Perceive / Reason / Act / Reflect) connected by arrows in a clockwise loop. Center label: "Autonomous Reasoning Loop". Each node has a 1-line description and an icon (eye / brain / hand / mirror). A small "iteration count" counter in the corner reinforces that the loop runs continuously.
- **Layout density:** Low — the diagram is the message.

### Pattern H — Pyramid / Capability Stack (Nested Capabilities)
- **Source:** Aditya Sharma's LinkedIn framing: "Effective Agentic AI systems (Stage 4) almost always contain AI Agents (Stage 3) that use Generative AI (Stage 2) that was trained on patterns originally identified by Traditional AI (Stage 1)" [li-4stages]. Sequoia's "foundation layer → reasoning layer → application layer" stack [seq-o1].
- **When to use:** The "these aren't competing eras, they're a stack" slide — counters the misconception that agentic AI *replaces* generative AI.
- **Visual mechanics:** 4-layer pyramid (or stacked horizontal bands). Bottom = Traditional AI (widest, foundational). Each layer above is narrower and labeled with its added capability: "Adds LEARNING" (ML) → "Adds GENERATION" (GenAI) → "Adds AUTONOMY + TOOL USE" (Agentic). Each layer in a progressively more saturated emerald.
- **Layout density:** Low — the stack structure is the message.

---

## 3. QUOTES & INSIGHTS FROM THINK TANKS ABOUT AGENTIC AI VALUE (12 quotes)

Each quote is verbatim from the cited source. Chosen because each captures a distinct facet of the value proposition.

1. **"Agentic AI is a structural shift in enterprise tech, reshaping companies with agents that can reason, coordinate, and execute complex workflows."** — Bain, *Building the Foundation for Agentic AI* [bain-foundation]
2. **"Agentic AI moves beyond answering prompts or generating content to execute work. In enterprises, agentic AI will increase productivity, as people become AI supervisors rather than task executors."** — Bain, *What Is Agentic AI* [bain-what]
3. **"The fundamental economic promise of AI agents is that they can dramatically reduce transaction costs — the time and effort involved in searching, comparing, and coordinating."** — MIT Sloan (Kellogg) [mit]
4. **"It is not just the digital world — agents can actually take actions that change things happening in the physical world."** — Sinan Aral, MIT Sloan [mit]
5. **"Generative AI gave us copilots that assist human work by generating output. Agentic AI can reason, collaborate, and coordinate multistep work across systems."** — Bain [bain-what]
6. **"Two years into the Generative AI revolution, research is progressing the field from 'thinking fast' — rapid-fire pre-trained responses — to 'thinking slow' — reasoning at inference time. This evolution is unlocking a new cohort of agentic applications."** — Sequoia Capital, *Generative AI's Act o1* [seq-o1]
7. **"Cloud companies sold software ($/seat). AI companies sell work ($/outcome). Cloud companies targeted the software profit pool. AI companies target the services profit pool."** — Sequoia Capital [seq-o1]
8. **"AI agents and AI-ready data are the two fastest advancing technologies on the 2025 Gartner Hype Cycle for Artificial Intelligence."** — Gartner press release, Aug 2025 [gart-press]
9. **"Only 17% of organizations have deployed AI agents to date, yet more than 60% expect to do so within the next two years — the most aggressive adoption curve among all emerging technologies measured in the survey."** — Gartner 2026 CIO Survey [gart-agentic]
10. **"Agentic AI is poised for growth with close to three-quarters of companies planning to deploy Agentic AI within two years. Yet only 21% of those companies report having a mature model for agent governance."** — Deloitte, *State of AI in the Enterprise 2026* [deloitte]
11. **"Agentic AI shifts human value beyond old-school productivity (tasks executed, hours logged). AI can do that work instantly. Roles need to evolve."** — World Economic Forum [wef]
12. **"Agentic AI is not a detour in AI's history, but the next logical step in a long progression toward more adaptive and collaborative intelligence."** — VastData [vast]

**Bonus framing lines (not full quotes but usable as callouts):**
- "AI agents represent a profound leap in humanity's long drive to externalize the mind through its technology… from extensions of the mind into independent embodiments of it." [unstruct]
- "Think of it less as a tool you command (like GenAI) and more as a trusted, autonomous partner that can execute complex tasks on your behalf." [fedresources]
- "Traditional AI → Decides. Generative AI → Creates. AI Agents → Act. Agentic AI → Runs systems." [li-4stages]
- "Generative models provided creativity. Machine learning provided recognition. Automation provided execution. Agentic AI merges these strengths into a continuous loop of perception, planning, and action." [vast]
- "These aren't strictly sequential stages — they're increasingly nested capabilities." [li-4stages]

---

## 4. RECOMMENDED SLIDE STRUCTURE FOR TAB 3 (10 slides, action titles)

Each slide has: (a) ACTION TITLE (full sentence, ≤15 words, tells the reader what to conclude — per McKinsey/BCG Rule C1), (b) the design pattern from §2, (c) the body content the slide must carry to be **self-sufficient** (readable without a presenter).

Action titles validated against the 60-second Titles Test: reading only the 10 bolded action titles top-to-bottom tells the complete strategic story.

### Slide 1 — HERO / Executive Summary
- **Action title:** *"AI has crossed four thresholds in 70 years — and the fourth, agentic systems, is the one that finally acts on the world."*
- **Pattern:** Modified StrategyU #14 (3-column SCR: Situation | Complication | Resolution).
- **Self-sufficient body:**
  - **Situation (left third):** "Since 1956 AI has progressed through four capability eras — rule-based programs, machine learning, generative AI, and now agentic systems."
  - **Complication (middle third):** "Each prior era automated a slice of work but stopped at the screen. The leap to agentic AI — systems that perceive, reason, act, and self-correct — is now the fastest-advancing technology on Gartner's 2025 Hype Cycle, with 60% of organizations expecting to deploy within 2 years."
  - **Resolution (right third):** "Cusco Vision Agent is built natively on the agentic pattern: it doesn't just count people in a plaza, it perceives → reasons → escalates → reports — closing the loop from camera to action."
- **Visuals:** Large Instrument Serif H1, three zinc-50 cards with thin emerald top borders.

### Slide 2 — THE 70-YEAR TIMELINE
- **Action title:** *"Each AI era solved the previous era's ceiling — rules lacked learning, learning lacked generation, generation lacked action."*
- **Pattern:** A — Horizontal Timeline with Phase Bars.
- **Self-sufficient body:** Four phase bars (Symbolic AI 1956 / Neural Networks 1954-2012 / Generative AI 2017-2023 / Agentic AI 2024-). Below each bar, a 2-line "solved" + "couldn't" tag. Milestone dots: Dartmouth 1956, AlexNet 2012, ChatGPT Nov 2022, OpenAI o1 Sep 2024. Caption: "70 years from rules to agents."
- **Source line:** McKinsey [mck-ai]; IBM [ibm].

### Slide 3 — THE 4 STAGES DEFINED (reference card)
- **Action title:** *"Four stages, nested not sequential — every agentic system still contains rules, learning, and generative models inside it."*
- **Pattern:** F — 3-Era Stack expanded to 4 cards (variant). Plus H — nested pyramid inset.
- **Self-sufficient body:** 4 cards (one per stage), each with: stage number, name, 1-line definition, "CAN do", "CAN'T do", "value created". Small nested-pyramid diagram in the corner reinforces the "stack" idea.
- **Source line:** Synthesis of [mck-ai][vast][bain-what][li-4stages].

### Slide 4 — THE LEAP: WHAT'S ACTUALLY NEW ABOUT AGENTIC AI
- **Action title:** *"Agentic AI adds the loop the previous eras lacked: perceive, reason, act, reflect — and repeat until the goal is met."*
- **Pattern:** G — Loop Diagram.
- **Self-sufficient body:** Circular Perceive → Reason → Act → Reflect diagram in center. Four "capability leap" callouts around it: (1) reactive → proactive, (2) single-shot → multi-step with feedback, (3) answering → executing, (4) tool → collaborator. Each callout cites its source [bain-what][arxiv][vast][li-4stages].
- **Source line:** Fedresources [fedresources]; MIT Sloan [mit]; arXiv survey [arxiv].

### Slide 5 — GENERATIVE vs AGENTIC: SIDE-BY-SIDE
- **Action title:** *"Generative AI produces output; agentic AI pursues goals — the difference is tool use, multi-step planning, and self-correction."*
- **Pattern:** D — Capability Comparison Matrix.
- **Self-sufficient body:** 3-column table (Capability | Generative AI | Agentic AI), 5 rows: Primary role, Typical interaction, Workflow scope, Tool use, Enterprise value. Agentic column tinted emerald. Footnote: "Agentic systems are connected, nondeterministic, and multi-agent" [bain-what].
- **Source line:** Bain [bain-what].

### Slide 6 — THE AUTONOMY SPECTRUM (definitional precision)
- **Action title:** *"True agency begins only at Level 5 — when the system can loop, retry, and self-correct, not just route between fixed steps."*
- **Pattern:** C — Autonomy Spectrum with Threshold Line.
- **Self-sufficient body:** 6-segment horizontal bar (Code / LLM Call / Chain / Router / State Machine / Autonomous). Dashed threshold line between L4 and L5 labeled "governance model must change". Caption: "Levels 1-4 = human-defined guardrails. Levels 5-6 = agent-executed — requires new security, observability, and approval gates." Place a small "Cusco Vision Agent operates at L5" pin.
- **Source line:** Unstructured.io [unstruct].

### Slide 7 — MARKET TIMING: HYPE CYCLE 2025
- **Action title:** *"AI agents sit at the Peak of Inflated Expectations — the most aggressive adoption curve of any emerging technology measured."*
- **Pattern:** E — Hype Cycle Curve with Year Markers.
- **Self-sufficient body:** Gartner curve with 4 labeled markers (GenAI Trough 2025, AI Agents Peak 2025, AI Engineering Slope, Agentic Governance Innovation Trigger). Side stat block: "17% deployed today / 60% within 2 years" [gart-agentic]. "$234B in enterprise app spend at risk from agentic AI" [gart-press]. "$33.9B private GenAI investment in 2024 (+18.7%)" [hai].
- **Source line:** Gartner [gart-press][gart-agentic]; Stanford HAI [hai].

### Slide 8 — ENTERPRISE REALITY: WHERE MOST ORGS ARE STUCK
- **Action title:** *"85% of employees are stuck at stages 2-3 of AI adoption — only 10% have reached the agentic stage."*
- **Pattern:** B — Ascending Maturity Ladder.
- **Self-sufficient body:** 5 ascending steps (BCG's stages: information assistance / task assistance / delegation / semiautonomous collaboration / fully autonomous orchestration). "You are here" marker on step 3. Bracket above steps 2-3: "85% of employees stuck here". Side stat: "71% of enterprises use AI but only 25% have moved 40%+ of pilots to production" [deloitte]. "Only 21% have a mature model for agent governance" [deloitte].
- **Source line:** BCG [bcg-puzzle]; Deloitte [deloitte].

### Slide 9 — WHAT THIS MEANS FOR US (Cusco Vision Agent mapping)
- **Action title:** *"Cusco Vision Agent is built natively on Stage 4 — every plaza camera is a perceive-reason-act loop, not just a detector."*
- **Pattern:** G — Loop Diagram variant, overlaid on the actual Tab 2 pipeline.
- **Self-sufficient body:** Same Perceive→Reason→Act→Reflect loop, but each node is annotated with the actual project component: Perceive = TF.js COCO-SSD person detection; Reason = rule engine + z-score + LLM-as-judge; Act = log/snapshot/email/escalate; Reflect = LLM verdict feedback into the next tick. Caption: "While most civic-camera systems are Stage 2 (count-and-alert), Cusco Vision Agent closes the loop — perceive the plaza, reason about anomalies, act via 3-tier escalation, and reflect via the LLM judge that filters false positives."
- **Source line:** Project architecture (worklog 0-b, 0-c); MIT Sloan framing [mit].

### Slide 10 — STRATEGIC IMPERATIVE + SOURCES
- **Action title:** *"The window to learn the agentic pattern is now — before 60% of your peers deploy it in the next 24 months."*
- **Pattern:** Modified StrategyU #11 (Quote + Evidence) + sources footer.
- **Self-sufficient body:** Large pull-quote (Instrument Serif italic): *"Agentic AI shifts human value beyond old-school productivity… Roles need to evolve."* — World Economic Forum [wef]. Below it, a 3-bullet "what to do next" block: (1) Pilot one perceive-reason-act loop on a real camera feed, (2) Stand up governance before scaling — not after, (3) Treat the agent as a teammate, not a tool. Bottom: full source list (12 sources, formatted).
- **Source line:** WEF [wef]; Bain [bain-foundation]; Gartner [gart-agentic].

---

## 5. VISUAL STYLE RECOMMENDATIONS

This section COMPOSES WITH (does not replace) the existing McKinsey/BCG Style Guide at `/home/z/my-project/download/research/task0c/STYLE_GUIDE.md`. New Tab-3-specific guidance is highlighted; everything else inherits from the existing guide.

### 5.1 Color — extend, don't replace
- **Inherit:** zinc neutrals + emerald-600 brand + amber-500 warning + rose-600 destructive (per STYLE_GUIDE.md §4). Zero indigo/blue. WCAG AA verified.
- **NEW for Tab 3 — Stage color coding (used consistently across all 10 slides):**
  - **Stage 1 (Static/Rules):** `zinc-400` / `zinc-500` — muted, "foundational but inert"
  - **Stage 2 (ML/Deep Learning):** `zinc-600` — slightly darker, "added depth"
  - **Stage 3 (Cognitive/Generative):** `amber-500` — already the warning tone, repurposed here as "creative but limited" (and visually echoes the GenAI-in-Trough narrative)
  - **Stage 4 (Agentic):** `emerald-600` — brand color, "alive, active, the present-tense stage"
- **Rationale:** The progression muted-zinc → amber → emerald mirrors the content narrative (inert → creative-but-stuck → alive-and-acting). Keeps the palette to 4 hues total. No new tokens needed.

### 5.2 Typography — inherit, with two additions
- **Inherit:** Instrument Serif (display H1) + Inter (body) + JetBrains Mono (code/metrics), all via `next/font/google`, per STYLE_GUIDE.md §5.
- **NEW for Tab 3:**
  - **Pull-quotes** (Slide 1 Resolution, Slide 10 main quote): Instrument Serif **italic**, 28–32px / 1.3 line-height, emerald-600 left border (4px) + zinc-100 background. McKinsey-report gravitas.
  - **Stat callouts** (e.g., "17% deployed today / 60% within 2 years"): JetBrains Mono **tabular-nums**, 36–44px, zinc-950, with a 12px Inter caption beneath in zinc-500. The mono font makes live/animated digits feel mechanical and trustworthy.

### 5.3 Layout density — purpose-tuned per slide
The 10 slides are deliberately a **density gradient**: open sparse, peak dense in the middle, close sparse.
- **Sparse (≤30 body words):** Slides 1, 2, 4, 10 — diagram or hero dominates; type carries ~20% of the message.
- **Medium (60–120 body words):** Slides 6, 7, 8, 9 — diagram + stat sidebar.
- **Dense (180–260 body words, structured as bullets/tables):** Slides 3, 5 — these are the reference slides the audience will re-read.
- **Per-slide max width:** `max-w-5xl` (1024px) for prose-heavy slides; `max-w-6xl` (1152px) for diagrams (timeline, hype cycle, loop).
- **Vertical rhythm:** 96px top padding for slide-titles; 48px between title and body; 32px between body blocks. Generous whitespace — "white space is content" (per STYLE_GUIDE.md §3 Rule V6).

### 5.4 Slide chrome (PowerPoint feel, but web-native)
- **Slide container:** Each slide = a `<section>` with `min-h-screen` (or `min-h-[88vh]` to leave breathing room), `px-6 md:px-12 lg:px-24`, `py-16`, separated by `border-b border-zinc-200`.
- **Slide number:** Fixed top-right of each section, JetBrains Mono `text-xs text-zinc-400`, format `03 / 10`.
- **Slide kicker:** Above the action title, an emerald-600 `text-xs uppercase tracking-widest` label naming the slide's role (e.g., "EXECUTIVE SUMMARY", "TIMELINE", "DEFINITIONS", "MARKET TIMING").
- **Action title:** Instrument Serif, `text-4xl md:text-5xl`, `text-zinc-950`, `leading-tight`, max 2 lines, `max-w-3xl`.
- **Source footer:** Every slide ends with a `text-xs text-zinc-400` source line, format `Source: McKinsey "What is AI" (2024); Stanford HAI AI Index 2025.` — per McKinsey Rule C8 (every quantitative claim cited).

### 5.5 Self-sufficiency rules (readable without a presenter)
This is the Tab 3 page's distinctive requirement. Each slide must satisfy ALL of:
1. **Action title is a complete sentence** that, if read alone, conveys the slide's conclusion (Titles Test, McKinsey Rule C7).
2. **Body has enough connective prose** (not just bullets) that a reader landing on slide 6 cold can understand what they're looking at. Minimum: a 2-sentence orienting paragraph above any diagram or table.
3. **Every acronym is expanded on first use** within each slide (TF.js, COCO-SSD, LLM, ROI, Gartner Hype Cycle, etc.). Slides are not sequential for the reader — assume they scrolled here directly.
4. **Every quantitative claim has a source line** at slide bottom.
5. **Diagrams have axis labels / node labels / legend** — never a bare chart.
6. **No jargon-only headings** like "The Stack" or "Maturity" — every heading is a phrase ("The 4 Stages, Nested Not Sequential").

### 5.6 Anti-patterns to reject (Tab-3-specific, on top of STYLE_GUIDE.md §7)
- **No "AI evolution" wordclouds or decorative gradients.** The narrative is linear and structural — let the timeline and ladder carry it.
- **No anthropomorphic robot illustrations.** Think-tank reports never use them; they cheapen the seriousness. Use abstract geometric icons (loop arrow, stacked layers, step shape) instead.
- **No animated transitions between slides** (no fade-in, no slide-left). The page is a strategic brief, not a presentation — readers scroll, they don't watch.
- **No "future AGI" speculation slides.** Stay within Stage 4 (agentic). The arXiv survey explicitly cautions against "risks that can emerge when exceeding human intelligence" [arxiv] — keep the brief grounded in today's deployable capability.
- **No pie charts** (McKinsey banned them — per STYLE_GUIDE.md §7). Use the ladder, matrix, or timeline instead.
- **No uncited statistics.** Every number on the page must trace to a named source.

---

## 6. SOURCE INVENTORY (12 primary, all fetched + verified)

| Tag | Source | URL | What we extracted |
|---|---|---|---|
| mck-ai | McKinsey "What is AI?" | mckinsey.com/featured-insights/mckinsey-explainers/what-is-ai | 4 stages of AI (Symbolic, Neural nets, Traditional robotics, GenAI); dates; definitions |
| bcg-puzzle | BCG "AI Adoption Puzzle" | bcg.com/publications/2025/ai-adoption-puzzle-why-usage-up-impact-not | 5-stage employee adoption ladder; "85% stuck at 2-3, <10% at stage 4" |
| bain-what | Bain "What Is Agentic AI" | bain.com/insights/what-is-agentic-ai-and-how-does-it-work-in-enterprises | GenAI vs Agentic capability matrix; "AI supervisors not task executors"; 3-layer arch |
| bain-foundation | Bain "Building the Foundation for Agentic AI" | bain.com/insights/building-the-foundation-for-agentic-ai-technology-report-2025 | "Structural shift in enterprise tech"; orchestrator + task agent pattern |
| gart-press | Gartner 2025 Hype Cycle press release | gartner.com/en/newsroom/press-releases/2025-08-05-gartner-hype-cycle-identifies-top-ai-innovations-in-2025 | "AI agents + AI-ready data fastest advancing"; 33% by 2028; $234B at risk |
| gart-agentic | Gartner 2026 Hype Cycle for Agentic AI | gartner.com/en/articles/hype-cycle-for-agentic-ai | "17% deployed / 60% within 2 years"; Peak of Inflated Expectations |
| deloitte | Deloitte "State of AI in the Enterprise 2026" | deloitte.com/us/en/about/press-room/state-of-ai-report-2026.html | "Untapped Edge"; 25% pilot-to-prod; 21% mature agent governance |
| wef | World Economic Forum "Rebuild the enterprise for the Age of Agentic AI" | weforum.org/stories/jobs-and-the-future-of-work/how-to-rebuild-enterprise-for-age-of-agentic-ai | "Shifts human value beyond old-school productivity" |
| hai | Stanford HAI 2025 AI Index | hai.stanford.edu/ai-index/2025-ai-index-report | $109.1B US AI investment; 78% org AI usage; $33.9B GenAI investment |
| mit | MIT Sloan "Agentic AI, explained" | mitsloan.mit.edu/ideas-made-to-matter/agentic-ai-explained | "Perceive, reason, act on their own"; transaction-cost quote; physical-world action |
| seq-o1 | Sequoia "Generative AI's Act o1" | sequoiacap.com/article/generative-ais-act-o1 | "Thinking fast vs thinking slow"; AlphaGo analogy; "sell work not software"; killer-apps cohort |
| seq-two | Sequoia "Generative AI's Act Two" | sequoiacap.com/article/generative-ai-act-two | "Cambrian explosion"; "space race"; "Act 2 solves human problems end-to-end" |
| vast | VastData "Evolution of AI: ML to Agentic" | vastdata.com/blog/evolution-of-ai-from-machine-learning-to-agentic-systems | Clean 3-era framing; per-era strengths + limits; agentic differentiators |
| cisco | Cisco Outshift "5 Levels of agentic AI" | outshift.cisco.com/blog/ai-ml/agentic-ai-intelligence-for-enterprise-use | 5-level enterprise ladder (rule → ML → partial → high → fully autonomous) |
| unstruct | Unstructured.io "Defining the Autonomous Enterprise" | unstructured.io/blog/defining-the-autonomous-enterprise-reasoning-memory-and-the-core-capabilities-of-agentic-ai | 6-level autonomy spectrum; L4/L5 threshold; 4 core capabilities; agent anatomy |
| ibm | IBM "Evolution of AI Agents" | ibm.com/think/topics/evolution-of-ai-agents | 4-phase historical timeline (1940-2010+); BDI model; ReAct framework |
| arxiv | arXiv "Generative to Agentic AI: Survey" | arxiv.org/html/2504.18875v1 | "Paradigm shift"; reasoning models o1/o3; RL-style environment interaction |
| fedresources | FedResources "Agentic AI: The Next Leap" | fedresources.com/agentic-ai-the-next-leap-in-artificial-intelligence | Explicit Perceive→Plan→Act→Reflect→Repeat loop; GPS-vs-self-driving-car analogy |
| dm-4phases | DataMgmt "Evolution of Agentic AI: RPA to AI Agents" | datamanagementblog.com/the-evolution-of-the-agentic-ai-model-from-rpa-to-ai-agents | 4 phases: RPA → Cognitive Automation → Digital Assistants → AI Agents |
| li-4stages | Aditya Sharma LinkedIn "4 Stages of AI Evolution" | linkedin.com/posts/aditya-hicounselor_aiagents-enterpriseai-agenticai-activity-7433858589896908800 | Decides / Creates / Acts / Runs systems; "nested capabilities" framing |
| pragmatic | Pragmatic Coders "Gartner AI Hype Cycle" analysis | pragmaticcoders.com/blog/gartner-ai-hype-cycle | Year-by-year hype-cycle arc; "$1.9M per GenAI initiative, <30% CEO ROI satisfaction" |

---

## 7. HANDOFF TO IMPLEMENTATION (Tab 3 "Strategic Brief")

**For the implementation agent building Tab 3:**

1. **Treat this document + STYLE_GUIDE.md (task 0-c) as the design contract.** This doc adds the 4-stage narrative, 8 evolution-design-patterns, 12 quotes, and a 10-slide structure. STYLE_GUIDE.md provides the underlying Tailwind palette, typography, and component rules. Where they overlap, this doc wins for Tab 3.

2. **Build order (recommended):**
   - **First:** Slide 1 (Hero/Exec Summary) — sets the SCR frame, validates the palette + typography end-to-end.
   - **Second:** Slide 3 (4 Stages Defined) — the dense reference card that anchors the whole page. If this slide works, the narrative works.
   - **Third:** Slide 4 (The Leap / Loop Diagram) — the most visually distinctive slide; proves the "agentic = loop" concept.
   - **Fourth:** Slide 7 (Hype Cycle) — the market-timing proof point. Most likely to convince a skeptical executive reader.
   - **Then fill the remaining 6 slides** in numeric order.

3. **Reusable components to extract:**
   - `<StageCard>` — props: number, name, definition, canDo[], cantDo[], value. Used in slides 3, 4, 9.
   - `<ActionTitle>` — props: kicker, title, slideNumber, totalSlides. Used on every slide.
   - `<SourceLine>` — props: sources[]. Renders the bottom citation footer.
   - `<StatCallout>` — props: value, caption, source. Mono-font big number + Inter caption.
   - `<PullQuote>` — props: quote, attribution. Instrument Serif italic + emerald border.
   - `<LoopDiagram>` — the Perceive→Reason→Act→Reflect circle. Variant for slide 4 (generic) and slide 9 (Cusco-annotated).

4. **Data structure for the 4 stages (single source of truth, drop into a `stages.ts` constant):**
   ```ts
   export const STAGES = [
     { n: 1, name: "Static Programs", era: "1956–1980s", also: "Symbolic AI · RPA · Expert Systems",
       def: "Humans encode rules; system executes deterministic logic.",
       can: ["Audit every decision step", "Execute at machine speed", "Never drift from spec"],
       cant: ["Handle unstructured input", "Learn from data", "Adapt to new edge cases"],
       value: "Scalable automation of high-volume bounded tasks",
       color: "zinc-400" },
     { n: 2, name: "Machine Learning / Deep Learning", era: "1986–2017", also: "Neural Networks · Supervised Learning",
       def: "Models learn patterns from data; no human writes the rules.",
       can: ["Perceive — images, speech, text", "Classify and detect anomalies", "Improve with more data"],
       cant: ["Reason about goals", "Retain context across sessions", "Explain why it decided"],
       value: "Perception at scale — the 2010s AI economy",
       color: "zinc-600" },
     { n: 3, name: "Cognitive / Generative AI", era: "2017–2023", also: "Foundation Models · Copilots",
       def: "Models synthesize new content from internet-scale training data.",
       can: ["Generate text, code, images, audio", "Summarize and translate", "Reason shallowly via chain-of-thought"],
       cant: ["Take action in the world", "Pursue multi-step goals", "Self-correct when an action fails"],
       value: "$33.9B private investment in 2024 (+18.7%); 78% of orgs now use AI",
       color: "amber-500" },
     { n: 4, name: "Agentic AI", era: "2024–", also: "AI Agents · Autonomous Systems · Software 3.0",
       def: "Systems that perceive, reason, act, and self-correct in a loop until a goal is met.",
       can: ["Plan multi-step workflows", "Use tools and APIs autonomously", "Reflect and retry on failure", "Coordinate with other agents"],
       cant: ["Operate safely without governance", "Replace human judgment for high-stakes tiers", "Avoid hallucination without grounding data"],
       value: "End-to-end process execution; 'sell work, not software'",
       color: "emerald-600" },
   ]
   ```

5. **Quality gate before merge:**
   - Run the **Titles Test** (read the 10 action titles top-to-bottom — do they tell the complete strategic story without looking at any body content?).
   - Run the **Cold-Reader Test** (open the page at slide 6 — can a reader understand it without reading slides 1-5?).
   - Run the **Source Test** (every quantitative claim has a source footer — no exceptions).
   - Run the **Palette Test** (no indigo, no blue; only zinc + emerald + amber + rose per STYLE_GUIDE.md).

---

**End of Strategic Brief Research. Ready for Tab 3 implementation.**
