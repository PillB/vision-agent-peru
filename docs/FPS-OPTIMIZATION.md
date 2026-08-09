# FPS & Detection TTS Optimization Research

## Current Baseline (measured 2026-08-09)

| Metric | Current Value | Target |
|--------|--------------|--------|
| Detection throttle | 800ms (1.25 Hz) | 200-400ms (2.5-5 Hz) |
| Canvas resolution | 320×180 | 256×144 (smaller = faster) |
| FPS update interval | 2000ms | 1000ms |
| Inference backend | WASM (q8) | WASM (q8) + WebGPU when available |
| Frame scheduling | requestAnimationFrame + throttle | requestVideoFrameCallback (video) / rAF (static) |
| Model load | Lazy on prototype tab mount | Preload on app idle |
| Canvas context | willReadFrequently: true | willReadFrequently: true + desynchronized: true |

## Bottleneck Analysis

### 1. Detection Throttle (800ms → target 200ms)
The current 800ms throttle means max 1.25 detections/second. This is overly conservative for YOLOS-tiny on WASM which can do 2-5 fps on modern hardware.

### 2. Canvas Resolution (320×180 → 256×144)
YOLOS-tiny was trained on 512×512 but the inference input can be smaller. 256×144 reduces pixel count by 36% vs 320×180.

### 3. Dynamic Import on Every Detect Call
`const { RawImage } = await import('@huggingface/transformers')` runs on EVERY detect call. This should be cached.

### 4. No WebGPU Detection
The code always uses WASM. WebGPU is 5-10× faster when available.

### 5. No Frame Skipping
The loop runs rAF even when the previous detection is still in-flight. Should skip frames when inference is pending.

### 6. FPS Counter Granularity
Updates every 2000ms — too coarse for performance tuning. Should update every 1000ms.

## Best-in-Class Strategies (ranked by impact)

### Strategy 1: requestVideoFrameCallback (Impact: HIGH, Effort: LOW)
Use `video.requestVideoFrameCallback()` instead of `requestAnimationFrame` for video sources. This fires exactly when a new video frame is decoded, avoiding wasted rAF cycles.

```typescript
if (typeof video.requestVideoFrameCallback === 'function') {
  video.requestVideoFrameCallback(loop)
} else {
  requestAnimationFrame(loop)
}
```

### Strategy 2: Cache Dynamic Imports (Impact: HIGH, Effort: LOW)
`RawImage` is imported on every detect call. Cache it at module level.

### Strategy 3: Reduce Throttle + Adaptive Scheduling (Impact: HIGH, Effort: MEDIUM)
- Reduce throttle from 800ms to 300ms
- Add adaptive scheduling: if inference takes > 500ms, auto-throttle to 2× inference time
- Skip frames when previous inference is still pending

### Strategy 4: Smaller Canvas (Impact: MEDIUM, Effort: LOW)
Reduce from 320×180 to 256×144. 36% fewer pixels = ~20% faster inference.

### Strategy 5: WebGPU Detection (Impact: HIGH, Effort: MEDIUM)
Detect WebGPU support and use it when available. Fall back to WASM.

### Strategy 6: Desynchronized Canvas Context (Impact: LOW, Effort: LOW)
Add `desynchronized: true` to canvas context options for lower-latency rendering.

### Strategy 7: OffscreenCanvas + Worker (Impact: HIGH, Effort: HIGH)
Move detection to a Web Worker with OffscreenCanvas. This frees the main thread for UI.
**Deferred** — too complex for this iteration.

### Strategy 8: Model Preloading (Impact: MEDIUM, Effort: LOW)
Preload YOLOS-tiny on `requestIdleCallback` instead of waiting for prototype tab click.

### Strategy 9: Detection Confidence Threshold Tuning (Impact: LOW, Effort: LOW)
Current threshold 0.4 is reasonable. Lower to 0.3 for more recall (more detections = more useful demo).

## Implementation Priority

| Priority | Strategy | Expected FPS Gain |
|----------|----------|-------------------|
| P0 | Cache dynamic imports | 10-15% |
| P0 | Reduce throttle (800→300ms) | 2.5× |
| P0 | requestVideoFrameCallback | 20% (video) |
| P1 | Smaller canvas (320→256) | 20% |
| P1 | Adaptive scheduling | prevents jank |
| P1 | WebGPU detection | 5-10× (when available) |
| P2 | Desynchronized canvas | 5% |
| P2 | Model preloading | faster first detection |
| P2 | Lower threshold (0.4→0.3) | more recall |
