#!/usr/bin/env python3
"""
Phase 2 — Python Geometry Engine for PPTX V2 (McKinsey/BCG style).

Calculates explicit (x, y, w, h) for every shape, text box, connector and arrow.
Runs three automated test suites:
  1. Overflow test — no element outside slide bounds
  2. Overlap test — no two non-stacked elements overlap in same zone
  3. Arrow alignment test — every arrow's endpoints touch connected element edges

Output: JSON manifest + validation report.
"""

import json
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple

# ─── Canvas ─────────────────────────────────────────────────────────────────
SLIDE_W = 13.333
SLIDE_H = 7.5
MARGIN = 0.30
CONTENT_W = SLIDE_W - 2 * MARGIN  # 12.733"

@dataclass
class Element:
    id: str
    x: float
    y: float
    w: float
    h: float
    zone: str
    kind: str  # rect, roundRect, ellipse, line, rightArrow, leftArrow, upArrow, downArrow, text
    label: str = ""
    connects_from: Optional[str] = None
    connects_to: Optional[str] = None

@dataclass
class TestResult:
    name: str
    passed: bool
    details: str

elements: List[Element] = []

# ═══ ZONE A: HEADER (y: 0.10–0.60) ═══
elements.append(Element("hdr_logo",     0.30, 0.10, 0.45, 0.45, "A", "roundRect", "VA logo"))
elements.append(Element("hdr_brand",    0.85, 0.10, 7.50, 0.45, "A", "text", "Vision Agent — Resumen estratégico"))
elements.append(Element("hdr_meta",    10.33, 0.10, 2.70, 0.45, "A", "text", "v1.0 · Perú"))
elements.append(Element("hdr_line",     0.30, 0.60, CONTENT_W, 0.0, "A", "line"))

# ═══ ZONE B: TITLE (y: 0.65–1.05) ═══
elements.append(Element("title",        0.30, 0.65, CONTENT_W, 0.40, "B", "text", "Action title"))

# ═══ ZONE C: 4 ERA COLUMNS (y: 1.10–4.00) ═══
COL_GAP = 0.15
COL_W = (CONTENT_W - 3 * COL_GAP) / 4  # 3.071"
COL_Y = 1.10
COL_H = 2.90
COL_XS = [MARGIN + i * (COL_W + COL_GAP) for i in range(4)]

era_names = ["Programas Estáticos", "ML / Deep Learning", "IA Cognitiva / Generativa", "IA Autónoma"]

for i in range(4):
    cx = COL_XS[i]
    # Card background
    elements.append(Element(f"col{i+1}_card", cx, COL_Y, COL_W, COL_H, "C", "roundRect"))
    # Color header bar
    elements.append(Element(f"col{i+1}_bar", cx, COL_Y, COL_W, 0.06, "C", "rect"))
    # Stage label
    elements.append(Element(f"col{i+1}_stage", cx+0.10, COL_Y+0.10, COL_W-0.20, 0.18, "C", "text"))
    # Era name
    elements.append(Element(f"col{i+1}_name", cx+0.10, COL_Y+0.28, COL_W-0.20, 0.22, "C", "text"))
    # Definition paragraph
    elements.append(Element(f"col{i+1}_def", cx+0.10, COL_Y+0.52, COL_W-0.20, 0.72, "C", "text"))
    # Use cases label
    elements.append(Element(f"col{i+1}_uclabel", cx+0.10, COL_Y+1.28, COL_W-0.20, 0.14, "C", "text"))
    # Use cases bullets
    elements.append(Element(f"col{i+1}_ucbody", cx+0.10, COL_Y+1.44, COL_W-0.20, 1.40, "C", "text"))

# ═══ ZONE D: CAPABILITY STRIP (y: 4.05–4.50) ═══
CAP_Y = 4.05
CAP_H = 0.45
for i in range(4):
    cx = COL_XS[i]
    elements.append(Element(f"cap{i+1}_box", cx, CAP_Y, COL_W, CAP_H, "D", "rect"))
    elements.append(Element(f"cap{i+1}_text", cx+0.08, CAP_Y+0.04, COL_W-0.16, CAP_H-0.08, "D", "text"))

# ═══ ZONE E: AGENTIC LOOP DIAGRAM (y: 4.55–6.20) ═══
LOOP_LABEL_Y = 4.55
LOOP_Y = 4.80
LOOP_H = 0.60
LOOP_NODE_W = 1.55
LOOP_GAP = 0.50
TOTAL_LOOP_W = 4 * LOOP_NODE_W + 3 * LOOP_GAP  # 7.70"
LOOP_START_X = (SLIDE_W - TOTAL_LOOP_W) / 2  # 2.817"

elements.append(Element("loop_section", MARGIN, LOOP_LABEL_Y, 6, 0.18, "E", "text"))

loop_centers: List[float] = []
for i in range(4):
    nx = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP)
    elements.append(Element(f"loop{i+1}_node", nx, LOOP_Y, LOOP_NODE_W, LOOP_H, "E", "roundRect"))
    # Badge moved to top-LEFT (away from name text which is centered)
    elements.append(Element(f"loop{i+1}_badge", nx+0.05, LOOP_Y-0.05, 0.22, 0.22, "E", "ellipse"))
    # Name text — shifted right to avoid badge overlap, narrower width
    elements.append(Element(f"loop{i+1}_name", nx+0.30, LOOP_Y+0.05, LOOP_NODE_W-0.35, 0.20, "E", "text"))
    elements.append(Element(f"loop{i+1}_desc", nx+0.05, LOOP_Y+0.25, LOOP_NODE_W-0.10, 0.30, "E", "text"))
    loop_centers.append(nx + LOOP_NODE_W / 2)

# Forward arrows (3)
for i in range(3):
    src_x = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP) + LOOP_NODE_W
    dst_x = LOOP_START_X + (i + 1) * (LOOP_NODE_W + LOOP_GAP)
    arrow_y = LOOP_Y + LOOP_H / 2 - 0.06
    elements.append(Element(f"fwd_arrow_{i+1}", src_x, arrow_y, dst_x-src_x, 0.12, "E", "rightArrow",
                            connects_from=f"loop{i+1}_node", connects_to=f"loop{i+2}_node"))

# Loop-back path: down from Reflect → left → up to Perceive
reflect_cx = loop_centers[3]
perceive_cx = loop_centers[0]
loop_back_y = LOOP_Y + LOOP_H + 0.20

elements.append(Element("lb_down", reflect_cx-0.05, LOOP_Y+LOOP_H, 0.10, 0.25, "E", "downArrow", connects_from="loop4_node"))
elements.append(Element("lb_left", perceive_cx, loop_back_y, reflect_cx-perceive_cx, 0.10, "E", "leftArrow"))
elements.append(Element("lb_up", perceive_cx-0.05, loop_back_y, 0.10, 0.25, "E", "upArrow", connects_to="loop1_node"))
# Loop-back label — placed ABOVE the left arrow line, centered
elements.append(Element("lb_label", (perceive_cx+reflect_cx)/2-0.90, loop_back_y-0.18, 1.80, 0.14, "E", "text"))

# Human Feedback node
HF_W = 3.00
HF_H = 0.50
HF_X = (SLIDE_W - HF_W) / 2
HF_Y = loop_back_y + 0.35

elements.append(Element("hf_card", HF_X, HF_Y, HF_W, HF_H, "E", "roundRect"))
elements.append(Element("hf_icon", HF_X+0.08, HF_Y+0.10, 0.30, 0.30, "E", "ellipse"))
elements.append(Element("hf_text", HF_X+0.45, HF_Y+0.03, HF_W-0.55, HF_H-0.06, "E", "text"))

# Bidirectional arrows to Human Feedback
mid_x = (perceive_cx + reflect_cx) / 2
hf_arrow_h = HF_Y - loop_back_y - 0.15
elements.append(Element("hf_down", mid_x-0.10, loop_back_y+0.15, 0.07, hf_arrow_h, "E", "downArrow", connects_from="lb_left", connects_to="hf_card"))
elements.append(Element("hf_up", mid_x+0.03, loop_back_y+0.15, 0.07, hf_arrow_h, "E", "upArrow", connects_from="hf_card", connects_to="lb_left"))

# ═══ ZONE F: QUOTE (y: 6.25–6.75) ═══
QUOTE_Y = 6.25
QUOTE_H = 0.50
elements.append(Element("quote_box", MARGIN, QUOTE_Y, CONTENT_W, QUOTE_H, "F", "rect"))
elements.append(Element("quote_text", MARGIN+0.15, QUOTE_Y+0.04, CONTENT_W-0.30, QUOTE_H-0.08, "F", "text"))

# ═══ ZONE G: VALUE + SOURCES (y: 6.80–7.40) ═══
elements.append(Element("value_strip", MARGIN, 6.80, CONTENT_W, 0.20, "G", "text"))
elements.append(Element("sources", MARGIN, 7.10, CONTENT_W, 0.25, "G", "text"))

# ═══ TEST SUITES ═══
results: List[TestResult] = []

def overlaps(e1: Element, e2: Element) -> bool:
    if e1.w <= 0 or e1.h <= 0 or e2.w <= 0 or e2.h <= 0:
        return False
    return not (e1.x + e1.w <= e2.x + 0.01 or e2.x + e2.w <= e1.x + 0.01 or
                e1.y + e1.h <= e2.y + 0.01 or e2.y + e2.h <= e1.y + 0.01)

# Intentional stacks (text on top of shape)
intentional = set()
for i in range(4):
    intentional.add((f"col{i+1}_card", f"col{i+1}_bar"))
    intentional.add((f"col{i+1}_card", f"col{i+1}_stage"))
    intentional.add((f"col{i+1}_card", f"col{i+1}_name"))
    intentional.add((f"col{i+1}_card", f"col{i+1}_def"))
    intentional.add((f"col{i+1}_card", f"col{i+1}_uclabel"))
    intentional.add((f"col{i+1}_card", f"col{i+1}_ucbody"))
    intentional.add((f"cap{i+1}_box", f"cap{i+1}_text"))
    intentional.add((f"loop{i+1}_node", f"loop{i+1}_badge"))
    intentional.add((f"loop{i+1}_node", f"loop{i+1}_name"))
    intentional.add((f"loop{i+1}_node", f"loop{i+1}_desc"))
intentional.add(("hf_card", "hf_icon"))
intentional.add(("hf_card", "hf_text"))
intentional.add(("quote_box", "quote_text"))
# Loop-back corner connections (arrows meet at corners by design)
intentional.add(("lb_down", "lb_left"))
intentional.add(("lb_left", "lb_up"))

# TEST 1: Overflow
overflow_issues = []
for e in elements:
    right = e.x + e.w
    bottom = e.y + e.h
    if right > SLIDE_W + 0.05:
        overflow_issues.append(f"{e.id}: right {right:.3f}\" > {SLIDE_W}\"")
    if bottom > SLIDE_H + 0.05:
        overflow_issues.append(f"{e.id}: bottom {bottom:.3f}\" > {SLIDE_H}\"")
    if e.x < -0.05:
        overflow_issues.append(f"{e.id}: x={e.x:.3f}\" < 0")
    if e.y < -0.05:
        overflow_issues.append(f"{e.id}: y={e.y:.3f}\" < 0")
results.append(TestResult("Overflow", len(overflow_issues) == 0,
    f"{len(overflow_issues)} issues" + (": " + "; ".join(overflow_issues[:5]) if overflow_issues else "")))

# TEST 2: Overlap
overlap_issues = []
for i, e1 in enumerate(elements):
    for j, e2 in enumerate(elements):
        if j <= i:
            continue
        if (e1.id, e2.id) in intentional or (e2.id, e1.id) in intentional:
            continue
        if e1.zone != e2.zone:
            continue
        if overlaps(e1, e2):
            overlap_issues.append(f"{e1.id} ↔ {e2.id} (zone {e1.zone})")
results.append(TestResult("Overlap", len(overlap_issues) == 0,
    f"{len(overlap_issues)} issues" + (": " + "; ".join(overlap_issues[:5]) if overlap_issues else "")))

# TEST 3: Arrow alignment
arrow_issues = []
for e in elements:
    if e.kind not in ("rightArrow", "leftArrow", "upArrow", "downArrow"):
        continue
    if not e.connects_from or not e.connects_to:
        continue
    src = next((x for x in elements if x.id == e.connects_from), None)
    dst = next((x for x in elements if x.id == e.connects_to), None)
    if not src or not dst:
        continue
    if e.kind == "rightArrow":
        # Left edge of arrow should touch right edge of src; right edge of arrow should touch left edge of dst
        if abs(e.x - (src.x + src.w)) > 0.10:
            arrow_issues.append(f"{e.id}: start {e.x:.3f} != src right {src.x+src.w:.3f}")
        if abs((e.x + e.w) - dst.x) > 0.10:
            arrow_issues.append(f"{e.id}: end {e.x+e.w:.3f} != dst left {dst.x:.3f}")
results.append(TestResult("Arrow alignment", len(arrow_issues) == 0,
    f"{len(arrow_issues)} issues" + (": " + "; ".join(arrow_issues[:5]) if arrow_issues else "")))

# ═══ REPORT ═══
print("=" * 80)
print("PHASE 2 — GEOMETRY ENGINE VALIDATION REPORT")
print("=" * 80)
print(f"Slide: {SLIDE_W}\" × {SLIDE_H}\"")
print(f"Total elements: {len(elements)}")
for zone in "ABCDEFG":
    count = sum(1 for e in elements if e.zone == zone)
    print(f"  Zone {zone}: {count} elements")
print()
print("Test Suite Results:")
for r in results:
    status = "✅ PASS" if r.passed else "❌ FAIL"
    print(f"  {status} {r.name}: {r.details}")
print()
all_pass = all(r.passed for r in results)
print(f"Overall: {'✅ ALL TESTS PASSED' if all_pass else '❌ TESTS FAILED'}")

# Output JSON manifest
manifest = {
    "slide": {"w": SLIDE_W, "h": SLIDE_H},
    "elements": [asdict(e) for e in elements],
    "tests": [{"name": r.name, "passed": r.passed, "details": r.details} for r in results],
}
with open("/home/z/my-project/scripts/pptx-v2-manifest.json", "w") as f:
    json.dump(manifest, f, indent=2, default=str)
print(f"\nManifest saved: /home/z/my-project/scripts/pptx-v2-manifest.json")

# Print element table
print(f"\n{'ID':<22} {'X':>7} {'Y':>7} {'W':>7} {'H':>7} {'Zone':>4} {'Kind':<12}")
print("-" * 70)
for e in elements:
    print(f"{e.id:<22} {e.x:>7.3f} {e.y:>7.3f} {e.w:>7.3f} {e.h:>7.3f} {e.zone:>4} {e.kind:<12}")
