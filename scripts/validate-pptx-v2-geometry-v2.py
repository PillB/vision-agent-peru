#!/usr/bin/env python3
"""
Geometry validator for PPTX V2 — McKinsey/BCG text-dense infographic style.

Layout (13.333" × 7.5"):
  ZONE A (0.10–0.60): Header — logo, brand, meta
  ZONE B (0.65–1.05): Title — action title in serif
  ZONE C (1.10–3.85): 4 era columns (left to right) with paragraphs + use cases
  ZONE D (3.90–4.35): Capabilities strip — 4 cells aligned with columns
  ZONE E (4.40–6.25): Agentic loop diagram — 4 nodes + loop-back + Human Feedback
  ZONE F (6.30–6.80): Section 9 quote
  ZONE G (6.85–7.40): Value generated + footer

No dates, no money. All text in Peruvian Spanish (es-PE) or English (en).
"""

import json
from dataclasses import dataclass, asdict
from typing import List

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
    kind: str
    label: str = ""

@dataclass
class ValidationResult:
    element_id: str
    issue: str
    severity: str

elements: List[Element] = []

# ═══ ZONE A: HEADER ═══
elements.append(Element("hdr_logo",      x=0.30, y=0.10, w=0.45, h=0.45, zone="A", kind="roundRect", label="VA"))
elements.append(Element("hdr_brand",     x=0.85, y=0.10, w=7.50, h=0.45, zone="A", kind="text"))
elements.append(Element("hdr_meta",      x=10.33, y=0.10, w=2.70, h=0.45, zone="A", kind="text"))
elements.append(Element("hdr_line",      x=0.30, y=0.60, w=CONTENT_W, h=0.0, zone="A", kind="line"))

# ═══ ZONE B: TITLE ═══
elements.append(Element("title",         x=0.30, y=0.65, w=CONTENT_W, h=0.40, zone="B", kind="text"))

# ═══ ZONE C: 4 ERA COLUMNS ═══
COL_GAP = 0.15
COL_W = (CONTENT_W - 3 * COL_GAP) / 4  # 3.071"
COL_Y = 1.10
COL_H = 2.75  # tall enough for paragraph + use cases
COL_XS = [MARGIN + i * (COL_W + COL_GAP) for i in range(4)]
# = [0.30, 3.521, 6.742, 9.963]

era_names = ["Programas Estáticos", "ML / Deep Learning", "IA Cognitiva / Generativa", "IA Autónoma"]
era_colors = ["zinc400", "zinc600", "amber500", "emerald600"]
era_hexes = ["#a1a1aa", "#52525b", "#f59e0b", "#059669"]

for i in range(4):
    cx = COL_XS[i]
    # Card background
    elements.append(Element(f"col_{i+1}_card", x=cx, y=COL_Y, w=COL_W, h=COL_H, zone="C", kind="roundRect"))
    # Color header bar
    elements.append(Element(f"col_{i+1}_bar", x=cx, y=COL_Y, w=COL_W, h=0.06, zone="C", kind="rect"))
    # Stage label
    elements.append(Element(f"col_{i+1}_stage", x=cx+0.10, y=COL_Y+0.10, w=COL_W-0.20, h=0.20, zone="C", kind="text"))
    # Era name
    elements.append(Element(f"col_{i+1}_name", x=cx+0.10, y=COL_Y+0.30, w=COL_W-0.20, h=0.25, zone="C", kind="text"))
    # Definition paragraph
    elements.append(Element(f"col_{i+1}_def", x=cx+0.10, y=COL_Y+0.58, w=COL_W-0.20, h=0.65, zone="C", kind="text"))
    # Use cases label
    elements.append(Element(f"col_{i+1}_uc_label", x=cx+0.10, y=COL_Y+1.25, w=COL_W-0.20, h=0.15, zone="C", kind="text"))
    # Use cases bullets
    elements.append(Element(f"col_{i+1}_uc_body", x=cx+0.10, y=COL_Y+1.42, w=COL_W-0.20, h=1.25, zone="C", kind="text"))

# ═══ ZONE D: CAPABILITIES STRIP ═══
CAP_Y = 3.90
CAP_H = 0.45
for i in range(4):
    cx = COL_XS[i]
    elements.append(Element(f"cap_{i+1}_box", x=cx, y=CAP_Y, w=COL_W, h=CAP_H, zone="D", kind="rect"))
    elements.append(Element(f"cap_{i+1}_text", x=cx+0.08, y=CAP_Y+0.03, w=COL_W-0.16, h=CAP_H-0.06, zone="D", kind="text"))

# ═══ ZONE E: AGENTIC LOOP DIAGRAM ═══
LOOP_LABEL_Y = 4.40
LOOP_Y = 4.65
LOOP_H = 0.60
LOOP_NODE_W = 1.55
LOOP_GAP = 0.50
TOTAL_LOOP_W = 4 * LOOP_NODE_W + 3 * LOOP_GAP  # 6.20 + 1.50 = 7.70"
LOOP_START_X = (SLIDE_W - TOTAL_LOOP_W) / 2  # 2.817"

# Section label
elements.append(Element("loop_section_label", x=MARGIN, y=LOOP_LABEL_Y, w=6, h=0.20, zone="E", kind="text"))

# 4 loop nodes
loop_centers = []
for i in range(4):
    nx = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP)
    elements.append(Element(f"loop_node_{i+1}", x=nx, y=LOOP_Y, w=LOOP_NODE_W, h=LOOP_H, zone="E", kind="roundRect"))
    elements.append(Element(f"loop_label_{i+1}", x=nx, y=LOOP_Y+0.05, w=LOOP_NODE_W, h=0.20, zone="E", kind="text"))
    elements.append(Element(f"loop_desc_{i+1}", x=nx+0.05, y=LOOP_Y+0.25, w=LOOP_NODE_W-0.10, h=0.30, zone="E", kind="text"))
    loop_centers.append(nx + LOOP_NODE_W / 2)

# Forward arrows (3)
for i in range(3):
    src_x = LOOP_START_X + i * (LOOP_NODE_W + LOOP_GAP) + LOOP_NODE_W
    dst_x = LOOP_START_X + (i + 1) * (LOOP_NODE_W + LOOP_GAP)
    elements.append(Element(f"loop_arrow_{i+1}", x=src_x, y=LOOP_Y+LOOP_H/2-0.06, w=dst_x-src_x, h=0.12, zone="E", kind="rightArrow"))

# Loop-back path
loop_back_y = LOOP_Y + LOOP_H + 0.20
reflect_cx = loop_centers[3]
perceive_cx = loop_centers[0]
# Down from Reflect
elements.append(Element("loop_back_down", x=reflect_cx-0.05, y=LOOP_Y+LOOP_H, w=0.10, h=0.25, zone="E", kind="downArrow"))
# Left along bottom
elements.append(Element("loop_back_left", x=perceive_cx, y=loop_back_y, w=reflect_cx-perceive_cx, h=0.10, zone="E", kind="leftArrow"))
# Up to Perceive
elements.append(Element("loop_back_up", x=perceive_cx-0.05, y=loop_back_y, w=0.10, h=0.25, zone="E", kind="upArrow"))
# Loop label
elements.append(Element("loop_cycle_label", x=(perceive_cx+reflect_cx)/2-1.0, y=loop_back_y+0.12, w=2.0, h=0.18, zone="E", kind="text"))

# Human Feedback node
HF_W = 3.00
HF_H = 0.55
HF_X = (SLIDE_W - HF_W) / 2
HF_Y = loop_back_y + 0.40
elements.append(Element("human_feedback", x=HF_X, y=HF_Y, w=HF_W, h=HF_H, zone="E", kind="roundRect"))
elements.append(Element("human_feedback_text", x=HF_X+0.50, y=HF_Y+0.05, w=HF_W-0.60, h=HF_H-0.10, zone="E", kind="text"))

# Bidirectional arrows to Human Feedback
mid_x = (perceive_cx + reflect_cx) / 2
elements.append(Element("hf_down", x=mid_x-0.12, y=loop_back_y+0.15, w=0.08, h=HF_Y-loop_back_y-0.15, zone="E", kind="downArrow"))
elements.append(Element("hf_up", x=mid_x+0.04, y=loop_back_y+0.15, w=0.08, h=HF_Y-loop_back_y-0.15, zone="E", kind="upArrow"))

# ═══ ZONE F: SECTION 9 QUOTE ═══
QUOTE_Y = 6.30
QUOTE_H = 0.50
elements.append(Element("quote_box", x=MARGIN, y=QUOTE_Y, w=CONTENT_W, h=QUOTE_H, zone="F", kind="rect"))
elements.append(Element("quote_text", x=MARGIN+0.15, y=QUOTE_Y+0.05, w=CONTENT_W-0.30, h=QUOTE_H-0.10, zone="F", kind="text"))

# ═══ ZONE G: VALUE + FOOTER ═══
elements.append(Element("value_line", x=MARGIN, y=6.85, w=CONTENT_W, h=0.20, zone="G", kind="text"))
elements.append(Element("footer_line", x=MARGIN, y=7.10, w=CONTENT_W, h=0.25, zone="G", kind="text"))

# ═══ VALIDATION ═══
results: List[ValidationResult] = []

def overlaps(e1, e2):
    if e1.w == 0 or e1.h == 0 or e2.w == 0 or e2.h == 0:
        return False
    return not (e1.x + e1.w <= e2.x or e2.x + e2.w <= e1.x or
                e1.y + e1.h <= e2.y or e2.y + e2.h <= e1.y)

# Overflow check
for e in elements:
    right = e.x + e.w
    bottom = e.y + e.h
    if right > SLIDE_W + 0.05:
        results.append(ValidationResult(e.id, f"right {right:.3f} > {SLIDE_W}", "ERROR"))
    if bottom > SLIDE_H + 0.05:
        results.append(ValidationResult(e.id, f"bottom {bottom:.3f} > {SLIDE_H}", "ERROR"))
    if e.x < -0.05:
        results.append(ValidationResult(e.id, f"x={e.x:.3f} < 0", "ERROR"))
    if e.y < -0.05:
        results.append(ValidationResult(e.id, f"y={e.y:.3f} < 0", "ERROR"))

# Overlap check (same zone, excluding intentional stacks)
intentional = set()
for i in range(4):
    intentional.add((f"col_{i+1}_card", f"col_{i+1}_bar"))
    intentional.add((f"col_{i+1}_card", f"col_{i+1}_stage"))
    intentional.add((f"col_{i+1}_card", f"col_{i+1}_name"))
    intentional.add((f"col_{i+1}_card", f"col_{i+1}_def"))
    intentional.add((f"col_{i+1}_card", f"col_{i+1}_uc_label"))
    intentional.add((f"col_{i+1}_card", f"col_{i+1}_uc_body"))
    intentional.add((f"cap_{i+1}_box", f"cap_{i+1}_text"))
    intentional.add((f"loop_node_{i+1}", f"loop_label_{i+1}"))
    intentional.add((f"loop_node_{i+1}", f"loop_desc_{i+1}"))
intentional.add(("human_feedback", "human_feedback_text"))
intentional.add(("quote_box", "quote_text"))

for i, e1 in enumerate(elements):
    for j, e2 in enumerate(elements):
        if j <= i:
            continue
        pair = (e1.id, e2.id)
        if pair in intentional or (e2.id, e1.id) in intentional:
            continue
        if e1.zone != e2.zone:
            continue
        if overlaps(e1, e2):
            results.append(ValidationResult(f"{e1.id} ↔ {e2.id}",
                          f"Overlap in zone {e1.zone}", "WARN"))

# Report
print("=" * 80)
print("GEOMETRY VALIDATION — PPTX V2 (McKinsey text-dense infographic)")
print("=" * 80)
print(f"Slide: {SLIDE_W}\" × {SLIDE_H}\"")
print(f"Total elements: {len(elements)}")
for zone in "ABCDEFG":
    count = sum(1 for e in elements if e.zone == zone)
    print(f"  Zone {zone}: {count} elements")

errors = [r for r in results if r.severity == "ERROR"]
warns = [r for r in results if r.severity == "WARN"]
print(f"\nERRORS: {len(errors)}")
for r in errors:
    print(f"  ❌ {r.element_id}: {r.issue}")
print(f"WARNINGS: {len(warns)}")
for r in warns:
    print(f"  ⚠️  {r.element_id}: {r.issue}")

if not errors and not warns:
    print("\n✅ ALL CHECKS PASSED")

# Print element table
print(f"\n{'ID':<25} {'X':>7} {'Y':>7} {'W':>7} {'H':>7} {'Zone':>5}")
print("-" * 65)
for e in elements:
    print(f"{e.id:<25} {e.x:>7.3f} {e.y:>7.3f} {e.w:>7.3f} {e.h:>7.3f} {e.zone:>5}")
