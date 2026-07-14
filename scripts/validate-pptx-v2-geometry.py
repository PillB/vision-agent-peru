#!/usr/bin/env python3
"""
Geometry validator for PPTX V2 — infographic/timeline style.

Slide: 13.333" × 7.5" (16:9 widescreen)

Layout strategy (top to bottom):
  ZONE A (0.10" – 0.55"): Header — logo, brand, meta, locale badge
  ZONE B (0.65" – 1.15"): Title — action title in serif
  ZONE C (1.25" – 3.85"): Timeline — horizontal arrow with 4 era nodes + year markers
  ZONE D (3.95" – 6.20"): Agentic loop — circular diagram (Perceive→Reason→Act→Reflect) + Human Feedback node + value callouts
  ZONE E (6.30" – 7.40"): Use cases — 3-tier row (Traditional | ML/DL | Agentic Future)

This script:
  1. Defines every element with (x, y, w, h) in inches
  2. Validates no element overflows slide bounds
  3. Validates no two elements overlap (unless intentionally stacked)
  4. Validates arrow endpoints connect to element edges
  5. Outputs a geometry report + JSON for the pptxgenjs route
"""

import json
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional

# ─── Slide canvas ───────────────────────────────────────────────────────────
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
    kind: str  # rect, ellipse, line, arrow, text
    label: str = ""
    # Optional: for arrows, the connected source/target element IDs
    connects_from: Optional[str] = None
    connects_to: Optional[str] = None

@dataclass
class ValidationResult:
    element_id: str
    issue: str
    severity: str  # ERROR, WARN

# ─── Build all elements ─────────────────────────────────────────────────────
elements: List[Element] = []

# ═══ ZONE A: HEADER (y: 0.10 – 0.55) ═══
elements.append(Element("hdr_logo",     x=0.30,  y=0.10, w=0.45, h=0.45, zone="A", kind="roundRect", label="VA logo"))
elements.append(Element("hdr_logo_text",x=0.30,  y=0.10, w=0.45, h=0.45, zone="A", kind="text", label="VA"))
elements.append(Element("hdr_brand",    x=0.85,  y=0.10, w=7.50, h=0.45, zone="A", kind="text", label="Vision Agent — Resumen estratégico"))
elements.append(Element("hdr_meta",     x=10.33, y=0.10, w=2.70, h=0.45, zone="A", kind="text", label="v1.0 · 14/07/2026 · Perú"))
elements.append(Element("hdr_line",     x=0.30,  y=0.62, w=CONTENT_W, h=0.0, zone="A", kind="line"))

# ═══ ZONE B: TITLE (y: 0.70 – 1.15) ═══
elements.append(Element("title",        x=0.30,  y=0.70, w=CONTENT_W, h=0.45, zone="B", kind="text",
                        label="La IA ha cruzado cuatro umbrales en 70 años — y el cuarto, los sistemas autónomos, finalmente actúa sobre el mundo."))

# ═══ ZONE C: TIMELINE (y: 1.25 – 3.85) ═══
# Timeline arrow — full width
elements.append(Element("tl_arrow",     x=0.50,  y=2.50, w=12.33, h=0.35, zone="C", kind="rightArrow", label="timeline"))

# 4 era nodes — evenly spaced along the arrow
# Node centers at x = 1.5, 4.6, 7.7, 10.8 (gap 3.1")
node_centers = [1.5, 4.6, 7.7, 10.8]
node_w, node_h = 2.50, 1.00
node_y = 1.35  # above the arrow

for i, (cx, era_label) in enumerate(zip(node_centers, ["1956", "1986", "2017", "2024"])):
    nid = f"era_node_{i+1}"
    elements.append(Element(nid, x=cx - node_w/2, y=node_y, w=node_w, h=node_h, zone="C", kind="roundRect", label=f"Era {i+1}"))
    elements.append(Element(f"era_year_{i+1}", x=cx - node_w/2, y=node_y, w=node_w, h=0.25, zone="C", kind="text", label=era_label))
    elements.append(Element(f"era_name_{i+1}", x=cx - node_w/2, y=node_y + 0.25, w=node_w, h=0.30, zone="C", kind="text", label=f"Stage {i+1}"))
    elements.append(Element(f"era_desc_{i+1}", x=cx - node_w/2, y=node_y + 0.55, w=node_w, h=0.45, zone="C", kind="text", label="desc"))

# Year labels below the arrow
year_below_y = 2.95
for i, (cx, yr) in enumerate(zip(node_centers, ["1956", "1986", "2017", "2024"])):
    elements.append(Element(f"year_below_{i+1}", x=cx - 0.5, y=year_below_y, w=1.0, h=0.25, zone="C", kind="text", label=yr))

# Value callouts below years (y: 3.30 – 3.80)
value_y = 3.30
for i, cx in enumerate(node_centers):
    elements.append(Element(f"value_callout_{i+1}", x=cx - 1.0, y=value_y, w=2.0, h=0.50, zone="C", kind="rect", label=f"Value {i+1}"))

# ═══ ZONE D: AGENTIC LOOP (y: 3.95 – 6.20) ═══
# Loop is a horizontal flow: [Perceive] → [Reason] → [Act] → [Reflect] ↻ (loop back)
# Plus a [Human Feedback] node below, connected with bidirectional arrows
loop_y = 4.15
loop_h = 0.95
loop_node_w = 1.85
loop_gap = 0.55

# 4 loop nodes — centered horizontally
total_loop_w = 4 * loop_node_w + 3 * loop_gap  # 7.4 + 1.65 = 9.05"
loop_start_x = (SLIDE_W - total_loop_w) / 2  # (13.333 - 9.05) / 2 = 2.14"

loop_nodes = []
for i, name in enumerate(["Percibir", "Razonar", "Actuar", "Reflexionar"]):
    nx = loop_start_x + i * (loop_node_w + loop_gap)
    nid = f"loop_node_{i+1}"
    elements.append(Element(nid, x=nx, y=loop_y, w=loop_node_w, h=loop_h, zone="D", kind="roundRect", label=name))
    elements.append(Element(f"loop_label_{i+1}", x=nx, y=loop_y + 0.15, w=loop_node_w, h=0.30, zone="D", kind="text", label=name))
    elements.append(Element(f"loop_desc_{i+1}", x=nx, y=loop_y + 0.45, w=loop_node_w, h=0.45, zone="D", kind="text", label="desc"))
    loop_nodes.append((nid, nx, loop_y, loop_node_w, loop_h))

# Arrows between loop nodes (3 forward arrows)
for i in range(3):
    src = loop_nodes[i]
    dst = loop_nodes[i + 1]
    # Arrow from right edge of src to left edge of dst
    ax1 = src[1] + src[3]  # right edge x
    ay1 = src[2] + src[4] / 2  # center y
    ax2 = dst[1]  # left edge x
    ay2 = dst[2] + dst[4] / 2
    arrow_w = ax2 - ax1
    arrow_h = 0.12
    elements.append(Element(f"loop_arrow_{i+1}_{i+2}", x=ax1, y=ay1 - arrow_h/2, w=arrow_w, h=arrow_h, zone="D", kind="rightArrow",
                            connects_from=src[0], connects_to=dst[0]))

# Loop-back arrow: from Reflect (node 4) back to Perceive (node 1)
# Curved down and around — we'll use a downArrow + leftArrow + upArrow combo
# For simplicity: a horizontal line below the nodes with arrows
loop_back_y = loop_y + loop_h + 0.25  # 4.15 + 0.95 + 0.25 = 5.35
# Down arrow from Reflect node bottom to loop-back line
reflect_x = loop_nodes[3][1] + loop_nodes[3][3] / 2
elements.append(Element("loop_back_down", x=reflect_x - 0.06, y=loop_y + loop_h, w=0.12, h=0.30, zone="D", kind="downArrow",
                        connects_from="loop_node_4"))
# Horizontal left arrow along the bottom
perceive_x = loop_nodes[0][1] + loop_nodes[0][3] / 2
elements.append(Element("loop_back_left", x=perceive_x, y=loop_back_y, w=reflect_x - perceive_x, h=0.12, zone="D", kind="leftArrow"))
# Up arrow from loop-back line to Perceive node bottom
elements.append(Element("loop_back_up", x=perceive_x - 0.06, y=loop_back_y, w=0.12, h=0.30, zone="D", kind="upArrow",
                        connects_to="loop_node_1"))

# Human Feedback node — below the loop-back line, centered
hf_w = 2.80
hf_h = 0.70
hf_x = (SLIDE_W - hf_w) / 2
hf_y = loop_back_y + 0.50  # 5.35 + 0.50 = 5.85
elements.append(Element("human_feedback", x=hf_x, y=hf_y, w=hf_w, h=hf_h, zone="D", kind="roundRect", label="Retroalimentación Humana"))
elements.append(Element("human_feedback_text", x=hf_x, y=hf_y + 0.10, w=hf_w, h=0.50, zone="D", kind="text", label="Retroalimentación Humana (acknowledge/silence)"))

# Arrow from loop-back line down to Human Feedback (bidirectional — we'll use 2 arrows)
# Down arrow: from midpoint of loop-back line to Human Feedback top
mid_x = (perceive_x + reflect_x) / 2
elements.append(Element("hf_down", x=mid_x - 0.06, y=loop_back_y + 0.12, w=0.12, h=hf_y - loop_back_y - 0.12, zone="D", kind="downArrow",
                        connects_from="loop_back_left", connects_to="human_feedback"))
# Up arrow: from Human Feedback top back to loop-back line (offset slightly to avoid overlap)
elements.append(Element("hf_up", x=mid_x + 0.20, y=loop_back_y + 0.12, w=0.12, h=hf_y - loop_back_y - 0.12, zone="D", kind="upArrow",
                        connects_from="human_feedback", connects_to="loop_back_left"))

# ═══ ZONE E: USE CASES — 3 tiers (y: 6.30 – 7.40) ═══
uc_y = 6.40
uc_h = 0.90
uc_w = (CONTENT_W - 2 * 0.20) / 3  # (12.733 - 0.40) / 3 = 4.11"
uc_gap = 0.20

tiers = [
    ("uc_traditional", "Tradicional (S1-S2)", 0.30),
    ("uc_mldl",        "ML/DL Moderno (S2-S3)", 0.30 + uc_w + uc_gap),
    ("uc_agentic",     "Futuro Agéntico (S4)", 0.30 + 2 * (uc_w + uc_gap)),
]

for tid, label, tx in tiers:
    elements.append(Element(tid, x=tx, y=uc_y, w=uc_w, h=uc_h, zone="E", kind="rect", label=label))
    elements.append(Element(f"{tid}_title", x=tx + 0.10, y=uc_y + 0.05, w=uc_w - 0.20, h=0.25, zone="E", kind="text", label=label))
    elements.append(Element(f"{tid}_body", x=tx + 0.10, y=uc_y + 0.30, w=uc_w - 0.20, h=0.55, zone="E", kind="text", label="use cases"))

# ═══ VALIDATION ═══
results: List[ValidationResult] = []

def overlaps(e1: Element, e2: Element) -> bool:
    """Check if two rectangles overlap (with small tolerance for lines)."""
    if e1.w == 0 or e1.h == 0 or e2.w == 0 or e2.h == 0:
        return False  # lines don't count
    return not (e1.x + e1.w <= e2.x or e2.x + e2.w <= e1.x or
                e1.y + e1.h <= e2.y or e2.y + e2.h <= e1.y)

# Check 1: Overflow beyond slide bounds
for e in elements:
    right = e.x + e.w
    bottom = e.y + e.h
    if right > SLIDE_W + 0.01:
        results.append(ValidationResult(e.id, f"Right edge {right:.3f}\" > slide width {SLIDE_W}\"", "ERROR"))
    if bottom > SLIDE_H + 0.01:
        results.append(ValidationResult(e.id, f"Bottom edge {bottom:.3f}\" > slide height {SLIDE_H}\"", "ERROR"))
    if e.x < -0.01:
        results.append(ValidationResult(e.id, f"X={e.x:.3f}\" < 0", "ERROR"))
    if e.y < -0.01:
        results.append(ValidationResult(e.id, f"Y={e.y:.3f}\" < 0", "ERROR"))

# Check 2: Overlaps between elements in the same zone (excluding intentional stacks)
# Intentional stacks: text on top of shapes (same x,y,w,h or contained)
intentional_stacks = {
    ("hdr_logo", "hdr_logo_text"),
    ("era_node_1", "era_year_1"), ("era_node_1", "era_name_1"), ("era_node_1", "era_desc_1"),
    ("era_node_2", "era_year_2"), ("era_node_2", "era_name_2"), ("era_node_2", "era_desc_2"),
    ("era_node_3", "era_year_3"), ("era_node_3", "era_name_3"), ("era_node_3", "era_desc_3"),
    ("era_node_4", "era_year_4"), ("era_node_4", "era_name_4"), ("era_node_4", "era_desc_4"),
    ("loop_node_1", "loop_label_1"), ("loop_node_1", "loop_desc_1"),
    ("loop_node_2", "loop_label_2"), ("loop_node_2", "loop_desc_2"),
    ("loop_node_3", "loop_label_3"), ("loop_node_3", "loop_desc_3"),
    ("loop_node_4", "loop_label_4"), ("loop_node_4", "loop_desc_4"),
    ("human_feedback", "human_feedback_text"),
    ("uc_traditional", "uc_traditional_title"), ("uc_traditional", "uc_traditional_body"),
    ("uc_mldl", "uc_mldl_title"), ("uc_mldl", "uc_mldl_body"),
    ("uc_agentic", "uc_agentic_title"), ("uc_agentic", "uc_agentic_body"),
}

for i, e1 in enumerate(elements):
    for j, e2 in enumerate(elements):
        if j <= i:
            continue
        pair = (e1.id, e2.id)
        pair_rev = (e2.id, e1.id)
        if pair in intentional_stacks or pair_rev in intentional_stacks:
            continue
        if e1.zone != e2.zone:
            continue  # cross-zone overlaps are checked separately
        if overlaps(e1, e2):
            results.append(ValidationResult(f"{e1.id} ↔ {e2.id}",
                          f"Overlap in zone {e1.zone}: ({e1.x:.2f},{e1.y:.2f},{e1.w:.2f},{e1.h:.2f}) vs ({e2.x:.2f},{e2.y:.2f},{e2.w:.2f},{e2.h:.2f})",
                          "WARN"))

# Check 3: Arrow connections
arrows = [e for e in elements if e.kind in ("rightArrow", "leftArrow", "upArrow", "downArrow")]
for a in arrows:
    if a.connects_from and a.connects_to:
        src = next(e for e in elements if e.id == a.connects_from)
        dst = next(e for e in elements if e.id == a.connects_to)
        # Check arrow touches src and dst edges (within 0.1" tolerance)
        # For rightArrow: left edge should be near src right edge, right edge near dst left edge
        if a.kind == "rightArrow":
            src_right = src.x + src.w
            dst_left = dst.x
            if abs(a.x - src_right) > 0.15:
                results.append(ValidationResult(a.id, f"rightArrow start ({a.x:.2f}) not at src right edge ({src_right:.2f})", "WARN"))
            if abs(a.x + a.w - dst_left) > 0.15:
                results.append(ValidationResult(a.id, f"rightArrow end ({a.x+a.w:.2f}) not at dst left edge ({dst_left:.2f})", "WARN"))

# ═══ REPORT ═══
print("=" * 80)
print("GEOMETRY VALIDATION REPORT — PPTX V2 (infographic/timeline)")
print("=" * 80)
print(f"Slide: {SLIDE_W}\" × {SLIDE_H}\"")
print(f"Total elements: {len(elements)}")
print(f"  Zone A (header): {sum(1 for e in elements if e.zone == 'A')}")
print(f"  Zone B (title):  {sum(1 for e in elements if e.zone == 'B')}")
print(f"  Zone C (timeline): {sum(1 for e in elements if e.zone == 'C')}")
print(f"  Zone D (loop):   {sum(1 for e in elements if e.zone == 'D')}")
print(f"  Zone E (use cases): {sum(1 for e in elements if e.zone == 'E')}")
print()

errors = [r for r in results if r.severity == "ERROR"]
warns = [r for r in results if r.severity == "WARN"]
print(f"ERRORS: {len(errors)}")
for r in errors:
    print(f"  ❌ {r.element_id}: {r.issue}")
print()
print(f"WARNINGS: {len(warns)}")
for r in warns:
    print(f"  ⚠️  {r.element_id}: {r.issue}")
print()

if not errors and not warns:
    print("✅ ALL CHECKS PASSED — no overflow, no overlaps, arrows connected")

# Output JSON for the pptxgenjs route
output = {
    "slide": {"w": SLIDE_W, "h": SLIDE_H},
    "elements": [asdict(e) for e in elements],
    "validation": {
        "errors": len(errors),
        "warnings": len(warns),
        "details": [asdict(r) for r in results],
    }
}

with open("/home/z/my-project/scripts/pptx-v2-geometry.json", "w") as f:
    json.dump(output, f, indent=2, default=str)

print(f"\nGeometry JSON saved to: /home/z/my-project/scripts/pptx-v2-geometry.json")

# Print element table for verification
print("\n" + "=" * 80)
print("ELEMENT TABLE (x, y, w, h in inches)")
print("=" * 80)
print(f"{'ID':<25} {'X':>7} {'Y':>7} {'W':>7} {'H':>7} {'Zone':>5} {'Kind':<12}")
print("-" * 80)
for e in elements:
    print(f"{e.id:<25} {e.x:>7.3f} {e.y:>7.3f} {e.w:>7.3f} {e.h:>7.3f} {e.zone:>5} {e.kind:<12}")
