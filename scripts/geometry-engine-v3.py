#!/usr/bin/env python3
"""
Geometry engine V3 — Z-flow infographic with connector arrows.

Layout (13.333" × 7.5"):
  ZONE A (0.10–0.60): Header
  ZONE B (0.65–1.05): Title — targeted at VP seguridad BCP
  ZONE C (1.10–5.50): 4 era cards L-to-R with PENTAGON ARROWS between them
    Each card: name, paragraph, capabilities, differential value, BCP use cases
  ZONE D (5.55–6.15): Value strip — "de reactiva a proactiva a autónoma"
  ZONE E (6.20–7.40): Footer — BCP target + sources

The 4 cards are connected by 3 large pentagon (right-arrow) shapes that
visually carry the eye left-to-right. The Agentic card (card 4) contains
a mini loop diagram inside it.

No dates, no money. Peruvian Spanish.
"""

import json
from dataclasses import dataclass, asdict
from typing import List

SLIDE_W = 13.333
SLIDE_H = 7.5
MARGIN = 0.30
CONTENT_W = SLIDE_W - 2 * MARGIN

@dataclass
class Element:
    id: str
    x: float
    y: float
    w: float
    h: float
    zone: str
    kind: str
    label: str = ""

@dataclass
class TestResult:
    name: str
    passed: bool
    details: str

elements: List[Element] = []

# ═══ ZONE A: HEADER ═══
elements.append(Element("hdr_logo",   0.30, 0.10, 0.45, 0.45, "A", "roundRect"))
elements.append(Element("hdr_brand",  0.85, 0.10, 8.50, 0.45, "A", "text"))
elements.append(Element("hdr_meta",  10.33, 0.10, 2.70, 0.45, "A", "text"))
elements.append(Element("hdr_line",   0.30, 0.60, CONTENT_W, 0.0, "A", "line"))

# ═══ ZONE B: TITLE ═══
elements.append(Element("title",      0.30, 0.65, CONTENT_W, 0.40, "B", "text"))

# ═══ ZONE C: 4 ERA CARDS + 3 CONNECTOR ARROWS ═══
# Card layout: 4 cards + 3 arrow gaps
# Total content width = 12.733"
# Arrow width = 0.35" each, 3 arrows = 1.05"
# Card width = (12.733 - 1.05) / 4 = 2.921"
ARROW_W = 0.35
CARD_W = (CONTENT_W - 3 * ARROW_W) / 4  # 2.921"
CARD_Y = 1.10
CARD_H = 4.40  # tall — holds paragraph + capabilities + value + use cases

card_xs = []
arrow_xs = []
for i in range(4):
    cx = MARGIN + i * (CARD_W + ARROW_W)
    card_xs.append(cx)
    if i < 3:
        arrow_xs.append(cx + CARD_W)

# 4 era cards
for i in range(4):
    cx = card_xs[i]
    # Card background
    elements.append(Element(f"card{i+1}_bg", cx, CARD_Y, CARD_W, CARD_H, "C", "roundRect"))
    # Color header bar
    elements.append(Element(f"card{i+1}_bar", cx, CARD_Y, CARD_W, 0.07, "C", "rect"))
    # Stage number badge (top-left)
    elements.append(Element(f"card{i+1}_badge", cx+0.08, CARD_Y+0.10, 0.28, 0.28, "C", "ellipse"))
    # Era name (next to badge)
    elements.append(Element(f"card{i+1}_name", cx+0.42, CARD_Y+0.10, CARD_W-0.50, 0.28, "C", "text"))
    # Paragraph (explanatory)
    elements.append(Element(f"card{i+1}_para", cx+0.10, CARD_Y+0.45, CARD_W-0.20, 0.70, "C", "text"))
    # Capabilities label
    elements.append(Element(f"card{i+1}_caplabel", cx+0.10, CARD_Y+1.20, CARD_W-0.20, 0.15, "C", "text"))
    # Capabilities body
    elements.append(Element(f"card{i+1}_capbody", cx+0.10, CARD_Y+1.36, CARD_W-0.20, 0.65, "C", "text"))
    # Differential value label
    elements.append(Element(f"card{i+1}_vallabel", cx+0.10, CARD_Y+2.05, CARD_W-0.20, 0.15, "C", "text"))
    # Differential value body
    elements.append(Element(f"card{i+1}_valbody", cx+0.10, CARD_Y+2.21, CARD_W-0.20, 0.55, "C", "text"))
    # BCP use cases label
    elements.append(Element(f"card{i+1}_bcpLabel", cx+0.10, CARD_Y+2.80, CARD_W-0.20, 0.15, "C", "text"))
    # BCP use cases body
    elements.append(Element(f"card{i+1}_bcpbody", cx+0.10, CARD_Y+2.96, CARD_W-0.20, 1.35, "C", "text"))

# 3 connector arrows (pentagon shapes between cards)
ARROW_Y = CARD_Y + CARD_H / 2 - 0.25
ARROW_H = 0.50
for i in range(3):
    elements.append(Element(f"arrow{i+1}", arrow_xs[i], ARROW_Y, ARROW_W, ARROW_H, "C", "pentagon"))

# ═══ ZONE D: VALUE STRIP ═══
elements.append(Element("value_strip", MARGIN, 5.55, CONTENT_W, 0.45, "D", "rect"))
elements.append(Element("value_text", MARGIN+0.15, 5.58, CONTENT_W-0.30, 0.39, "D", "text"))

# ═══ ZONE E: FOOTER ═══
elements.append(Element("bcp_target", MARGIN, 6.10, 6.0, 0.25, "E", "text"))
elements.append(Element("sources", MARGIN, 6.38, CONTENT_W, 0.25, "E", "text"))
elements.append(Element("footer_line", MARGIN, 6.70, CONTENT_W, 0.0, "E", "line"))
elements.append(Element("copyright", MARGIN, 7.05, CONTENT_W, 0.25, "E", "text"))

# ═══ VALIDATION ═══
results: List[TestResult] = []

def overlaps(e1, e2):
    if e1.w <= 0 or e1.h <= 0 or e2.w <= 0 or e2.h <= 0:
        return False
    return not (e1.x + e1.w <= e2.x + 0.01 or e2.x + e2.w <= e1.x + 0.01 or
                e1.y + e1.h <= e2.y + 0.01 or e2.y + e2.h <= e1.y + 0.01)

intentional = set()
for i in range(4):
    intentional.add((f"card{i+1}_bg", f"card{i+1}_bar"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_badge"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_name"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_para"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_caplabel"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_capbody"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_vallabel"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_valbody"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_bcpLabel"))
    intentional.add((f"card{i+1}_bg", f"card{i+1}_bcpbody"))
intentional.add(("value_strip", "value_text"))

# Test 1: Overflow
overflow = []
for e in elements:
    if e.x + e.w > SLIDE_W + 0.05: overflow.append(f"{e.id}: right {e.x+e.w:.3f}")
    if e.y + e.h > SLIDE_H + 0.05: overflow.append(f"{e.id}: bottom {e.y+e.h:.3f}")
    if e.x < -0.05: overflow.append(f"{e.id}: x={e.x:.3f}")
    if e.y < -0.05: overflow.append(f"{e.id}: y={e.y:.3f}")
results.append(TestResult("Overflow", len(overflow)==0, f"{len(overflow)} issues" + (": "+"; ".join(overflow[:3]) if overflow else "")))

# Test 2: Overlap
overlap_issues = []
for i, e1 in enumerate(elements):
    for j, e2 in enumerate(elements):
        if j <= i: continue
        if (e1.id, e2.id) in intentional or (e2.id, e1.id) in intentional: continue
        if e1.zone != e2.zone: continue
        if overlaps(e1, e2):
            overlap_issues.append(f"{e1.id} ↔ {e2.id}")
results.append(TestResult("Overlap", len(overlap_issues)==0, f"{len(overlap_issues)} issues" + (": "+"; ".join(overlap_issues[:3]) if overlap_issues else "")))

# Test 3: Arrow alignment (arrows must touch card edges)
arrow_issues = []
for i in range(3):
    arrow = next(e for e in elements if e.id == f"arrow{i+1}")
    left_card = next(e for e in elements if e.id == f"card{i+1}_bg")
    right_card = next(e for e in elements if e.id == f"card{i+2}_bg")
    if abs(arrow.x - (left_card.x + left_card.w)) > 0.02:
        arrow_issues.append(f"arrow{i+1}: left != card{i+1} right")
    if abs((arrow.x + arrow.w) - right_card.x) > 0.02:
        arrow_issues.append(f"arrow{i+1}: right != card{i+2} left")
results.append(TestResult("Arrow alignment", len(arrow_issues)==0, f"{len(arrow_issues)} issues" + (": "+"; ".join(arrow_issues[:3]) if arrow_issues else "")))

# Report
print("=" * 80)
print("GEOMETRY ENGINE V3 — Z-FLOW INFOGRAPHIC WITH CONNECTOR ARROWS")
print("=" * 80)
print(f"Slide: {SLIDE_W}\" × {SLIDE_H}\"")
print(f"Total elements: {len(elements)}")
for zone in "ABCDE":
    count = sum(1 for e in elements if e.zone == zone)
    print(f"  Zone {zone}: {count} elements")
print()
for r in results:
    status = "✅ PASS" if r.passed else "❌ FAIL"
    print(f"  {status} {r.name}: {r.details}")
print()
all_pass = all(r.passed for r in results)
print(f"Overall: {'✅ ALL TESTS PASSED' if all_pass else '❌ TESTS FAILED'}")

# Save manifest
manifest = {
    "slide": {"w": SLIDE_W, "h": SLIDE_H},
    "elements": [asdict(e) for e in elements],
    "tests": [{"name": r.name, "passed": r.passed, "details": r.details} for r in results],
}
with open("/home/z/my-project/scripts/pptx-v3-manifest.json", "w") as f:
    json.dump(manifest, f, indent=2, default=str)

# Print element table
print(f"\n{'ID':<22} {'X':>7} {'Y':>7} {'W':>7} {'H':>7} {'Zone':>4}")
print("-" * 60)
for e in elements:
    print(f"{e.id:<22} {e.x:>7.3f} {e.y:>7.3f} {e.w:>7.3f} {e.h:>7.3f} {e.zone:>4}")
