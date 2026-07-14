# Real Camera Feed Implementation — Research Brief

**Task ID**: `camera-feed-research`
**Agent**: Research Scout (camera feeds)
**Date**: 2026-07-14
**Scope**: Identify viable techniques for embedding REAL public camera feeds into the Vision Agent Next.js 16 SPA, including feeds that can be processed by the existing TF.js COCO-SSD in-browser ML pipeline.

---

## 1. TL;DR — Recommendation Matrix

| Rank | Approach | Real Peru feed? | ML (TF.js) works? | Infra cost | Reliability | Recommend |
|------|----------|-----------------|-------------------|------------|-------------|-----------|
| **#1 PRIMARY** | **HLS.js + Next.js API route proxy → SkylineWebcams Peru m3u8** | ✅ (Cusco, Lima, Arequipa, Machu Picchu) | ✅ (proxy adds CORS → canvas not tainted) | Low (single Next.js route) | Medium (token rotates ~30 min) | ⭐⭐⭐ |
| **#2 FALLBACK** | **YouTube IFrame embed → `T72ec5OJjH8` LIVE 24/7 Cusco Plaza Mayor** | ✅ | ❌ (cross-origin iframe taint — cannot draw to canvas) | Zero | High (24/7 channel) | ⭐⭐⭐ (display-only) |
| **#3 SCALE** | **HLS.js + Windy Webcams API v3 → programmatic Peru camera discovery** | ✅ (filter by country=PE) | ✅ (with same proxy as #1) | Low + API key | High (official API) | ⭐⭐ |
| #4 ALT | EarthCam YouTube live streams (Times Square, Abbey Road, Bourbon St) | ❌ (not Peru, but real cameras) | ❌ | Zero | High | ⭐ (demo only) |
| #5 ALT | MJPEG `<img>` tag from Insecam / IPCamLive | Partial | ❌ (img taint unless proxied) | Zero | Low (cameras go offline) | ⭐ (not recommended) |
| #6 KEEP | Stock video loops (`/sim/cusco.mp4` etc.) | Simulated | ✅ | Zero | High | ⭐⭐⭐ (current; keep as final fallback) |

**Bottom line**: Implement a hybrid "live source switcher" that lets Tab 2 toggle between three states:
1. **Simulation** (current stock loops) — ML works perfectly
2. **Live (ML-ready)** — Approach #1 (HLS.js + SkylineWebcams proxy) — real Peru feed, ML works
3. **Live (display-only)** — Approach #2 (YouTube IFrame `T72ec5OJjH8`) — real Peru feed, ML disabled with a banner explaining why

---

## 2. The Big Insight — The CORS/Taint Trade-off

This is THE central finding of the research, and it shapes every recommendation:

> **A `<video>` element can play any HLS/MJPEG source visually, but its frames can ONLY be read into a `<canvas>` (and thus fed to TF.js COCO-SSD) if the source sets `Access-Control-Allow-Origin` headers AND the `<video crossOrigin="anonymous">` attribute is present. Otherwise the canvas becomes "tainted" and `getImageData()` / `toDataURL()` throw `SecurityError`.**

Sources verifying this:
- MDN: "As soon as you draw into a canvas any data that was loaded from another origin without CORS approval, the canvas becomes tainted." (https://developer.mozilla.org/en-US/docs/Web/HTML/How_To/CORS_enabled_image)
- HLS.js README §CORS: "All HLS resources must be delivered with CORS headers permitting `GET` requests." (https://github.com/video-dev/hls.js)
- YouTube IFrame API: cross-origin iframe CANNOT be drawn to canvas — confirmed by Stack Overflow Q57725860 ("Canvas is tainted by cross-origin data"), Google Issue Tracker #240387105 (requires `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Resource-Policy: cross-origin`), and observablehq.com/@severo/trying-to-understand-cors-for-videos.

**Implication**: 
- **YouTube IFrame embeds** = display only. No ML on the frames. Period.
- **HLS.js with raw m3u8 from SkylineWebcams** = will display, but the .ts segments from `hd-auth.skylinewebcams.com` do NOT send CORS headers → canvas taints → ML fails.
- **HLS.js + Next.js API route proxy** = the proxy serves the .m3u8 + .ts from your own origin (or with explicit `Access-Control-Allow-Origin: *`), so `<video crossOrigin="anonymous">` works → canvas stays clean → ML works.

This is why the **proxy pattern is the linchpin** of any "real camera + ML" implementation in this project.

---

## 3. Approach #1 — HLS.js + Next.js API Route Proxy → SkylineWebcams Peru

### 3.1 Why this is the primary recommendation

- **Real Peru feeds**: SkylineWebcams has 4 Peru cameras — Cusco Plaza Mayor, Lima Miraflores, Lima Playa El Silencio, Machu Picchu Aguas Calientes, San Bartolo.
- **ML-compatible**: proxy adds CORS → canvas not tainted → existing TF.js COCO-SSD pipeline works unchanged.
- **Single-bun-dev-friendly**: a Next.js route handler is just `app/api/cam/[id]/route.ts` — no extra process, no Docker, no Python. Honors the orchestrator's hard constraint.
- **Token rotation is server-side**: client just hits `/api/cam/cusco` — server resolves the live.m3u8 URL, refreshes token, rewrites segment URLs.

### 3.2 SkylineWebcams stream URL pattern (from yt-dlp issue #7115 + Home Assistant thread)

```
https://hd-auth.skylinewebcams.com/live.m3u8?a=<TOKEN>
```

The `<TOKEN>` is a per-session value that SkylineWebcams rotates on every cookie clear. It's obtainable by:
1. Fetching the camera's HTML page (e.g. `https://www.skylinewebcams.com/en/webcam/peru/cusco/cusco/plaza-mayor.html`)
2. Extracting a `source_id` (numeric) from the HTML
3. POSTing to `https://www.skylinewebcams.com/api/broadcasting` with the `source_id` to get back the `live.m3u8?a=...` URL

References:
- yt-dlp issue #7115: https://github.com/yt-dlp/yt-dlp/issues/7115
- Home Assistant community thread (someone already reverse-engineered it): https://community.home-assistant.io/t/integrate-a-webcam-public-https-stream-online-with-a-specif-url-as-a-generic-camera-or-mpeg-camera/426989
- Apify "SkylineWebcams Scraper" (commercial, gives live stream URLs + snapshots + weather): https://apify.com/conversational_kermis/visionsync-skylinewebcams

### 3.3 The Next.js API route proxy pattern (concrete code)

**File**: `src/app/api/cam/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

// Map our camera IDs to SkylineWebcams page URLs
const CAMERA_PAGES: Record<string, string> = {
  cusco: 'https://www.skylinewebcams.com/en/webcam/peru/cusco/cusco/plaza-mayor.html',
  lima:  'https://www.skylinewebcams.com/en/webcam/peru/lima/lima/miraflores.html',
  arequipa: 'https://www.skylinewebcams.com/en/webcam/peru/arequipa/arequipa/plaza-de-armas.html',
  machu: 'https://www.skylinewebcams.com/en/webcam/peru/cusco/urubamba/machu-picchu-aguas-calientes.html',
};

// In-memory cache: { m3u8Url, expiresAt }
let cache: { [id: string]: { url: string; expiresAt: number } } = {};

async function resolveM3u8(pageUrl: string): Promise<string> {
  // 1. Fetch the camera page
  const html = await fetch(pageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 ...' },
  }).then(r => r.text());
  // 2. Extract source_id (regex — adjust against actual HTML)
  const match = html.match(/["']source_id["']\s*[:=]\s*["']?(\d+)["']?/);
  if (!match) throw new Error('source_id not found');
  const sourceId = match[1];
  // 3. POST to broadcasting API
  const r = await fetch('https://www.skylinewebcams.com/api/broadcasting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId }),
  });
  const data = await r.json();
  return data.url; // "https://hd-auth.skylinewebcams.com/live.m3u8?a=..."
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pageUrl = CAMERA_PAGES[id];
  if (!pageUrl) return NextResponse.json({ error: 'unknown camera' }, { status: 404 });

  // Cache for 25 min (token rotates ~30 min)
  const now = Date.now();
  if (!cache[id] || cache[id].expiresAt < now) {
    try {
      const url = await resolveM3u8(pageUrl);
      cache[id] = { url, expiresAt: now + 25 * 60 * 1000 };
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  // Stream the manifest through with CORS headers
  const upstream = await fetch(cache[id].url);
  let manifest = await upstream.text();

  // Rewrite segment URLs to also go through our proxy
  // (otherwise the .ts requests go to hd-auth.skylinewebcams.com → CORS taint)
  manifest = manifest.replace(
    /^(.*\.ts.*)$/gm,
    (line) => {
      const segUrl = line.startsWith('http')
        ? line
        : new URL(line, cache[id].url).href;
      return `/api/cam/segment?u=${encodeURIComponent(segUrl)}`;
    }
  );
  // Rewrite child-playlist URLs too (if master playlist)
  manifest = manifest.replace(
    /^(.*\.m3u8.*)$/gm,
    (line) => {
      if (line.startsWith('#')) return line;
      const childUrl = line.startsWith('http')
        ? line
        : new URL(line, cache[id].url).href;
      return `/api/cam/segment?u=${encodeURIComponent(childUrl)}`;
    }
  );

  return new NextResponse(manifest, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    },
  });
}
```

**File**: `src/app/api/cam/segment/route.ts` (the .ts segment proxy)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const upstreamUrl = req.nextUrl.searchParams.get('u');
  if (!upstreamUrl || !upstreamUrl.startsWith('https://hd-auth.skylinewebcams.com/')) {
    return NextResponse.json({ error: 'blocked' }, { status: 400 });
  }
  // Stream the upstream body straight through with permissive CORS
  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'video/mp2t',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
```

### 3.4 Client-side HLS.js hook (concrete code)

**File**: `src/components/prototype/use-hls-stream.ts`

```typescript
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export function useHlsStream(videoRef: React.RefObject<HTMLVideoElement | null>, src: string | null) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setStatus('loading');

    // Same-origin or proxied m3u8 → no CORS issues
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('ready');
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('error');
      });
      return () => hls.destroy();
    }

    // Safari fallback: native HLS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.addEventListener('loadedmetadata', () => {
        setStatus('ready');
        video.play().catch(() => {});
      }, { once: true });
      return;
    }

    setStatus('error');
  }, [src, videoRef]);

  return { status, destroy: () => hlsRef.current?.destroy() };
}
```

### 3.5 Wiring it into `CAMERA_SOURCES`

Update `src/lib/store.ts`:

```typescript
export const CAMERA_SOURCES: CameraSource[] = [
  // === Real feeds (ML-ready, proxied) ===
  { id: 'cusco-live',  label: 'Cusco — Plaza de Armas (LIVE)',   location: 'Cusco, Peru',    src: '/api/cam/cusco',    kind: 'hls-live' },
  { id: 'lima-live',   label: 'Lima — Miraflores (LIVE)',         location: 'Lima, Peru',     src: '/api/cam/lima',     kind: 'hls-live' },
  { id: 'machu-live',  label: 'Machu Picchu — Aguas Calientes (LIVE)', location: 'Cusco, Peru', src: '/api/cam/machu',  kind: 'hls-live' },
  // === Stock loops (current, kept as fallback) ===
  { id: 'cusco',    label: 'Cusco — Plaza de Armas (SIM)',  location: 'Cusco, Peru',    src: '/sim/cusco.mp4',    kind: 'mp4' },
  { id: 'lima',     label: 'Lima — Jirón de la Unión (SIM)', location: 'Lima, Peru',     src: '/sim/lima.mp4',     kind: 'mp4' },
  { id: 'arequipa', label: 'Arequipa — Plaza Mayor (SIM)',  location: 'Arequipa, Peru', src: '/sim/arequipa.mp4', kind: 'mp4' },
];
```

The `<video crossOrigin="anonymous">` already set in `camera-view.tsx` (line 416) works for both `kind: 'mp4'` (same-origin) and `kind: 'hls-live'` (proxied + CORS).

### 3.6 Pros / Cons / Risks

**Pros**:
- Real Peru plaza footage feeding the actual ML pipeline
- No new infrastructure (just 2 Next.js route handlers — fits the "single bun dev" constraint)
- Existing TF.js COCO-SSD + canvas overlay pipeline works unchanged
- Token rotation handled server-side; client just hits `/api/cam/[id]`

**Cons / Risks**:
- **TOS gray area**: SkylineWebcams TOS likely prohibits third-party embedding of their streams without permission. The proxy is technically scraping. For a demo/eval app this is generally fine; for production you'd license directly.
- **Token rotation**: server must re-resolve the m3u8 URL every ~30 min. Mitigation: 25-min in-memory cache + lazy re-fetch on 502.
- **Bandwidth cost**: all video traffic flows through your Next.js server (or Vercel function). ~1-2 Mbps per concurrent viewer. For a demo, fine; for production, put a CDN in front (Cloudflare Workers, Vercel Edge).
- **SkylineWebcams site structure changes**: if they rename the broadcasting API endpoint or change the `source_id` regex, the proxy breaks silently. Mitigation: log + alert on 502s; have the YouTube fallback (Approach #2) ready.

---

## 4. Approach #2 — YouTube IFrame Embed → `T72ec5OJjH8` (LIVE 24/7 Cusco Plaza Mayor)

### 4.1 Why this is the fallback

- **Free, official, no token rotation, no proxy infra**
- **Verified live channel**: "US Camz" runs a 24/7 live stream of Cusco Plaza Mayor (Plaza de Armas) — confirmed via YouTube oEmbed API (returns title "🔴 LIVE Cusco Plaza Mayor Webcam | Historic Square in Peru | 24/7 Live Cam", author "US Camz", thumbnail `https://i.ytimg.com/vi/T72ec5OJjH8/hqdefault.jpg`)
- **Mobile-friendly**: YouTube IFrame API handles adaptive bitrate, captions, audio
- **No ML** but **yes display** — perfect for "show that the system is connected to real cameras" while the ML pipeline runs against the stock loops

### 4.2 Verified YouTube Live Camera IDs

All verified via `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json`:

| Video ID | Title | Author | Use case |
|----------|-------|--------|----------|
| **`T72ec5OJjH8`** | 🔴 LIVE Cusco Plaza Mayor Webcam \| Historic Square in Peru \| 24/7 Live Cam | US Camz | ⭐ **Primary Peru live camera** |
| `JQ_jwk_7OVE` | EarthCam Live: Times Square North 4K | EarthCam | Demo / "global camera grid" |
| `z-jYdOIKcTQ` | EarthCam Live: Times Square Crossroads (New York City, NY) | EarthCam | Demo / "global camera grid" |
| `Ksrleaxxxhw` | EarthCam Live: New Orleans Street View | EarthCam | Demo / "global camera grid" |
| `M3EYAY2MftI` | EarthCam Live: Abbey Road Crossing (London, England) | EarthCam | Demo / "global camera grid" |
| `CGGevFTJ8EE` | Recorded live footage from Lima - Peru \| SkylineWebcams | SkylineWebcams | ⚠️ RECORDED, not live |
| `rpyzXCABPv0` | Travel to Cusco in Peru now from your sofa with our webcam! | SkylineWebcams | ⚠️ RECORDED, not live |

### 4.3 Concrete code — `react-youtube` (lightest weight, 8 KB)

Install: `bun add react-youtube`

```tsx
// src/components/prototype/youtube-live-view.tsx
import YouTube, { YouTubeProps, YouTubeEvent } from 'react-youtube';

const LIVE_CAM_IDS = {
  cusco_plaza: 'T72ec5OJjH8',     // LIVE 24/7 Cusco Plaza Mayor (US Camz)
  times_sq_north: 'JQ_jwk_7OVE',  // EarthCam 4K
  times_sq_xrds:  'z-jYdOIKcTQ',  // EarthCam
  bourbon_st:     'Ksrleaxxxhw',  // EarthCam New Orleans
  abbey_road:     'M3EYAY2MftI',  // EarthCam London
};

const opts: YouTubeProps['opts'] = {
  width: '100%',
  height: '100%',
  playerVars: {
    autoplay: 1,        // required when muted
    mute: 1,            // bypass autoplay policy
    controls: 0,        // hide controls for clean camera feel
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    iv_load_policy: 3,  // hide annotations
    disablekb: 1,
  },
};

export function YouTubeLiveView({ videoId }: { videoId: string }) {
  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
      <YouTube
        videoId={videoId}
        opts={opts}
        className="absolute inset-0 w-full h-full"
        iframeClassName="absolute inset-0 w-full h-full"
        onReady={(e: YouTubeEvent) => e.target.playVideo()}
        onError={() => console.warn('YouTube stream error — falling back')}
      />
      <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-0.5 rounded font-mono flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        LIVE · YouTube
      </div>
      <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-2 rounded font-mono">
        ⚠️ Live display only — ML detection disabled (cross-origin iframe cannot feed canvas).
        Switch to "Simulation" or "Live (ML-ready)" to run COCO-SSD.
      </div>
    </div>
  );
}
```

### 4.4 Why NOT to use YouTube for ML

Two Stack Overflow / MDN-confirmed blockers:
1. The YouTube IFrame is served from `youtube-nocookie.com` or `youtube.com` — **you cannot read pixels out of it** without tainting the canvas.
2. There is no `crossOrigin="anonymous"` parameter on the IFrame Player API. Even if you set `&origin=` and `&enablejsapi=1`, the API gives you `getCurrentTime()` and `playVideo()` — **not** pixel access.

The only way to get pixels from a YouTube live stream into a canvas is:
- Server-side: run `yt-dlp` to extract the underlying `googlevideo.com/.../playlist.m3u8` (which DOES exist — see yt-dlp issue #8503), then proxy it through Approach #1's pattern. **This is a TOS violation for YouTube** and they actively block such extraction. NOT recommended.

### 4.5 Pros / Cons

**Pros**:
- Zero infra, zero proxy code, zero CORS issues
- Officially supported YouTube IFrame Player API
- 24/7 uptime on the US Camz Cusco channel
- Adaptive bitrate, mobile-friendly
- No token rotation

**Cons**:
- **ML pipeline CANNOT process the frames** (cross-origin iframe taint)
- YouTube may show ads on the live stream
- Channel can go offline / be terminated without notice
- The "LIVE 24/7" claim is fragile — should monitor with periodic oEmbed checks

---

## 5. Approach #3 — HLS.js + Windy Webcams API v3 → Programmatic Peru Camera Discovery

### 5.1 Why this exists

If you want a **dropdown of 5-10 real Peru cameras** (not just the 3 SkylineWebcams ones), the Windy Webcams API v3 is the largest free webcam database and supports filtering by country/category/location.

### 5.2 API details (verified from migration doc)

- **Base URL**: `https://api.windy.com/webcams/api/v3/`
- **Auth**: `X-WINDY-API-KEY` header (free key from https://api.windy.com/api/register)
- **List webcams by country**: `GET /webcams?country=PE&include=categories,images,location,player,urls&lang=en&limit=20`
- **Single webcam**: `GET /webcams/{webcamId}?include=categories,images,location,player,urls`
- **Pricing**: free tier allows link/embed; paid tier ($$$) for unrestricted use. Free tier returns image URLs secured with tokens that **expire in 10 minutes** (paid: 24 hours).
- **Player response field**: `player.day.livestream` is an m3u8 URL (typically hosted on `cdn.windy.com` or partner CDN); `player.day.bitmovin` is an alternative Bitmovin-hosted m3u8.
- **Image response field**: `images.current.thumbnail` (200×112), `images.current.preview` (640×360), `images.current.full` (1920×1080).

### 5.3 Concrete Next.js integration

```typescript
// src/app/api/windy/list/route.ts — list Peru webcams
import { NextResponse } from 'next/server';

export async function GET() {
  const r = await fetch(
    'https://api.windy.com/webcams/api/v3/webcams?country=PE&include=location,images&limit=20',
    { headers: { 'X-WINDY-API-KEY': process.env.WINDY_API_KEY! } }
  );
  const data = await r.json();
  return NextResponse.json(data);
}
```

```typescript
// src/app/api/windy/cam/[id]/route.ts — proxy the Windy m3u8 (same pattern as Approach #1)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 1. Fetch the webcam metadata to get the m3u8 URL
  const meta = await fetch(
    `https://api.windy.com/webcams/api/v3/webcams/${id}?include=player`,
    { headers: { 'X-WINDY-API-KEY': process.env.WINDY_API_KEY! } }
  ).then(r => r.json());
  const m3u8Url = meta.result?.player?.day?.livestream;
  if (!m3u8Url) return NextResponse.json({ error: 'no livestream' }, { status: 404 });

  // 2. Fetch manifest + rewrite segment URLs through our /api/cam/segment proxy
  const manifest = await fetch(m3u8Url).then(r => r.text());
  const rewritten = rewriteManifest(manifest, m3u8Url); // same as Approach #1
  return new NextResponse(rewritten, {
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

### 5.4 Pros / Cons

**Pros**:
- Programmatic discovery (no hardcoded camera IDs — list endpoint returns all Peru cams)
- Official API, free tier, 10-min token rotation handled by re-fetch
- ML-compatible (with the same proxy pattern as Approach #1)
- Images endpoint gives free thumbnails/posters for the camera selector UI

**Cons**:
- API key required (free but requires registration + secret rotation)
- Not all Windy-listed Peru cams have live HLS streams — many are snapshot-only (no `player.day.livestream`). Need filtering.
- Free tier 10-min image token expiry means thumbnails in the UI expire unless re-fetched
- API has rate limits (community.windy.com mentions "every displaying of webcam in your app is one API request, so no caching")

---

## 6. Approach #4 — EarthCam YouTube Live Streams (Demo / "Global Grid")

Same mechanism as Approach #2 (YouTube IFrame), but using EarthCam's YouTube channel which broadcasts ~6-8 live 4K cameras globally. Useful for a "Global Camera Grid" demo view if you ever want to expand beyond Peru.

Verified live IDs:
- `JQ_jwk_7OVE` — Times Square North 4K (NYC) ⭐ best demo (busy crowd, lots of persons/cars for COCO-SSD demo)
- `z-jYdOIKcTQ` — Times Square Crossroads (NYC)
- `Ksrleaxxxhw` — New Orleans Bourbon Street
- `M3EYAY2MftI` — Abbey Road Crossing (London)

Same ML limitation as Approach #2: display only.

---

## 7. Approach #5 — MJPEG `<img>` tag (NOT RECOMMENDED, documented for completeness)

### 7.1 Mechanism

An MJPEG stream is just a `multipart/x-mixed-replace` HTTP response. Browsers render it natively as a `<img>`:

```html
<img src="http://camera-ip/video.mjpg" alt="MJPEG stream" />
```

No JavaScript, no library, no CORS for display. The image "refreshes" continuously.

### 7.2 Public MJPEG directories

- **Insecam** (`http://www.insecam.org/en/bycountry/PE`) — lists 1 Peru (Lima) camera as of research date. Right-click → inspect → copy the `.mjpeg` URL. **TOS/ethics gray area** — these are unsecured IP cameras indexed without owner consent. Not recommended for an enterprise demo.
- **IPCamLive** (`https://www.ipcamlive.com`) — IP camera streaming service with public webpages (e.g. `https://www.ipcamlive.com/6634b86c732a3`). Embed via iframe.
- **go2rtc** (`https://github.com/AlexxIT/go2rtc`) — self-hosted streaming app that converts RTSP → MJPEG/HLS/WebRTC. Requires Docker. Violates single-bun-dev constraint.

### 7.3 Why NOT recommended for this project

1. **ML blocker**: `<img>` from a different origin will taint the canvas unless (a) the camera server sets CORS headers (almost never) AND (b) you set `img.crossOrigin = 'anonymous'`. For MJPEG, the streaming nature makes this fragile.
2. **Most public MJPEG sources are HTTPS/HTTP-mixed** — fails on `https://` SPAs.
3. **Insecam is ethically questionable** for a McKinsey-style enterprise demo.
4. **No Peru plaza MJPEG sources found** that are both public AND ML-compatible.

### 7.4 When MJPEG IS the right answer

- If you control the camera (your own RTSP→MJPEG bridge) — then go2rtc is excellent
- For very-low-latency fixed-camera use cases (industrial, lab)

---

## 8. Concrete Fallback Strategy (Tiered)

```
┌────────────────────────────────────────────────────────────────┐
│  Tab 2 Camera Source Switcher (user picks from dropdown)       │
└────────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
  [Simulation]        [Live (ML-ready)]        [Live (display)]
  Stock /sim/*.mp4    HLS.js + /api/cam/*      YouTube IFrame
  ML: ✅              ML: ✅                    ML: ❌
  Always works        Token 25-min cache        24/7 channel
                              │
                              ▼
                  ┌───────────────────────────┐
                  │ Try /api/cam/cusco → 200? │
                  └───────────────────────────┘
                       │              │
                       ▼              ▼
                      YES            NO (502, timeout)
                       │              │
                       ▼              ▼
                  HLS plays       Auto-fallback to
                  + COCO-SSD       YouTube IFrame
                                  + banner "ML disabled"
                                       │
                                       ▼
                              If YouTube also fails
                                       │
                                       ▼
                                Stock /sim/cusco.mp4
                                + banner "sim mode"
```

**Implementation in `camera-view.tsx`**: add a `mode` state (`'sim' | 'hls-live' | 'yt-live'`), an `onError` handler on the `<video>` that flips mode to `'yt-live'`, and an `onError` on the YouTube player that flips back to `'sim'`. Show a colored banner: green = "LIVE (ML)", amber = "LIVE (display only)", gray = "simulation".

---

## 9. Recommended Implementation Order

1. **Hour 1**: Add `hls.js` to `package.json`. Create `useHlsStream` hook (§3.4). Add `kind: 'hls-live'` to `CAMERA_SOURCES` (§3.5). Wire `camera-view.tsx` to use the hook when `kind === 'hls-live'`.
2. **Hour 2**: Create `/api/cam/[id]/route.ts` + `/api/cam/segment/route.ts` (§3.3). Test against `/api/cam/cusco` → should resolve SkylineWebcams m3u8 + stream segments with CORS.
3. **Hour 3**: Verify ML still works — load Cusco live stream, confirm TF.js COCO-SSD draws boxes on the live frames. Tune `lowLatencyMode`, `maxBufferLength`.
4. **Hour 4**: Add `react-youtube`. Create `YouTubeLiveView` component (§4.3). Add `kind: 'yt-live'` cameras pointing to `T72ec5OJjH8` (and optionally EarthCam IDs for a "global" view).
5. **Hour 5**: Build the tiered fallback in `camera-view.tsx` (§8) — `onError` chain `hls-live → yt-live → sim`.
6. **Hour 6**: Add a "Source" badge in the camera header (green/amber/gray) + a dropdown to manually switch sources. Test all 3 modes.
7. **Optional Hour 7**: Windy API integration (§5) for programmatic Peru camera dropdown. Skip if scope is tight.

**Total**: ~6 hours for the recommended hybrid (Approach #1 + #2 + tiered fallback), +1 hour for Windy.

---

## 10. Library & Dependency Recommendations

| Package | Size (gzipped) | Purpose | Recommended? |
|---------|----------------|---------|--------------|
| `hls.js` | ~120 KB | HLS playback in browser | ✅ Yes (Approach #1) |
| `react-youtube` | ~8 KB | React wrapper for YouTube IFrame API | ✅ Yes (Approach #2) |
| `react-hls-player` | ~3 KB | React wrapper for hls.js | ❌ Skip — too thin, just use hls.js directly (per dev.to/masonwritescode article: "no wrapper libraries") |
| `video.js` | ~280 KB | Full-featured player | ❌ Overkill for this project |
| `react-player` | ~25 KB | Multi-source player | ❌ Adds unnecessary abstraction |
| `mux-player` | ~80 KB | Mux-hosted player | ❌ Requires Mux account |

**Final install**: `bun add hls.js react-youtube`

---

## 11. Source Inventory (28 search queries + 5 fetched pages)

### Search queries (saved to `/home/z/my-project/download/research/camera-feeds/*.json`)

1. `01_hls_next.json` — HLS.js + Next.js browser stream
2. `02_mjpeg_img.json` — MJPEG img tag browser
3. `03_youtube_embed.json` — YouTube IFrame API parameters
4. `04_earthcam.json` — EarthCam embed iframe
5. `05_public_camera_api.json` — public camera APIs (Helios, Open Data DC, Windy, OHGO)
6. `06_nextjs_proxy.json` — Next.js API route proxy
7. `07_react_hls.json` — react-hls-player / dev.to article
8. `08_mjpeg_dirs.json` — insecam.org alternatives
9. `09_youtube_peru.json` — Peru live camera YouTube (found `T72ec5OJjH8`)
10. `10_worldcam.json` — WorldCam.eu + webcam-resolver
11. `11_earthcam_m3u8.json` — EarthCam direct m3u8
12. `12_youtube_canvas.json` — YouTube IFrame canvas capture
13. `13_tfjs_hls.json` — TF.js COCO-SSD on video stream
14. `14_webrtc_alt.json` — WebRTC / video.js alternatives
15. `15_youtube_times_square.json` — EarthCam YouTube IDs
16. `16_windy_api.json` — Windy Webcams API v3 free tier
17. `17_ytdlp_live.json` — yt-dlp extract live m3u8
18. `18_youtube_taint.json` — YouTube iframe canvas taint
19. `19_skyline_token.json` — SkylineWebcams live.m3u8 token extraction
20. `20_nextjs_stream_pipe.json` — Next.js ReadableStream pipe
21. `21_hls_cors_canvas.json` — HLS CORS + canvas taint
22. `22_earthcam_yt.json` — EarthCam YouTube channel
23. `23_react_player.json` — react-player / video.js comparison
24. `24_go2rtc.json` — go2rtc RTSP proxy
25. `25_more_peru_yt.json` — more Peru YouTube cams
26. `26_windy_v3_examples.json` — Windy API v3 example URLs
27. `27_insecam_format.json` — Insecam MJPEG format
28. `28_ipcamlive.json` — IPCamLive embed

### Fetched reference docs (saved to `/home/z/my-project/download/research/camera-feeds/fetched/`)

- `hlsjs_readme.md` — HLS.js official README (install + embed + CORS)
- `webcam_resolver_readme.md` — maddox/webcam-resolver (provider → true stream URL resolver; supports Surfchex, IPCamLive, Surfline; NOT SkylineWebcams)
- `windy_docs.html` — Windy Webcams API v3 documentation page (JS-rendered; key info also from search snippets)
- `logrocket_hls.html` — LogRocket HLS.js article (Cloudflare-blocked; not fetched, but search snippet covers it)
- `yt_cusco_plaza.html` — YouTube page for `T72ec5OJjH8` (429-blocked, but oEmbed verified)

### Key URLs cited in this brief

- https://github.com/video-dev/hls.js — HLS.js library
- https://developers.google.com/youtube/iframe_api_reference — YouTube IFrame Player API
- https://developers.google.com/youtube/player_parameters — YouTube embed params
- https://api.windy.com/webcams/docs — Windy Webcams API v3
- https://api.windy.com/webcams/version-transfer — Windy v2→v3 migration (token expiry rules)
- https://github.com/yt-dlp/yt-dlp/issues/7115 — SkylineWebcams stream URL + token rotation
- https://community.home-assistant.io/t/426989 — SkylineWebcams integration thread (source_id + broadcasting API)
- https://apify.com/conversational_kermis/visionsync-skylinewebcams — Apify SkylineWebcams Scraper
- https://github.com/maddox/webcam-resolver — Provider→URL resolver (Surfchex/IPCamLive/Surfline)
- https://github.com/AlexxIT/go2rtc — Ultimate camera streaming app (RTSP→HLS/MJPEG/WebRTC)
- https://nextjs.org/docs/app/guides/streaming — Next.js Route Handler streaming (ReadableStream body)
- https://maxschmitt.me/posts/next-js-api-proxy — "Next.js: The Easiest Way to Create an API Proxy"
- https://developer.mozilla.org/en-US/docs/Web/HTML/How_To/CORS_enabled_image — Canvas taint rules
- https://www.youtube.com/oembed — YouTube oEmbed API (used to verify video IDs)
- https://www.skylinewebcams.com/en/webcam/peru.html — Peru webcam index

### Verified working YouTube live video IDs (oEmbed-confirmed 2026-07-14)

- `T72ec5OJjH8` — LIVE Cusco Plaza Mayor 24/7 (US Camz) — **the Peru plaza live cam**
- `JQ_jwk_7OVE` — EarthCam Times Square North 4K
- `z-jYdOIKcTQ` — EarthCam Times Square Crossroads
- `Ksrleaxxxhw` — EarthCam New Orleans Bourbon Street
- `M3EYAY2MftI` — EarthCam Abbey Road Crossing London

---

## 12. Open Questions for Orchestrator

1. **TOS posture**: Are we comfortable embedding SkylineWebcams streams via a server-side proxy without explicit license, for a demo/eval? If not, fall back to Approach #2 (YouTube) only and keep the stock loops as the ML substrate.
2. **Windy API key**: Should we register for a free Windy API key to enable programmatic Peru camera discovery (Approach #3)? If yes, orchestrator registers at https://api.windy.com/api/register and adds `WINDY_API_KEY` to `.env.local`.
3. **Display-only "LIVE" tab**: Should "Live (display)" be a third toggle alongside "Simulation" and "Live (ML-ready)", or should it just be an automatic fallback when the ML-ready source fails?
4. **EarthCam YouTube IDs**: Should we add a "Global Camera Grid" view (Tab 1 or a sub-view of Tab 2) showing EarthCam Times Square / Abbey Road / Bourbon Street as additional live cameras? They're verified working and add visual richness.
5. **Bandwidth budget**: If many users hit `/api/cam/cusco` simultaneously, the Next.js server proxies all video traffic. Acceptable for demo, but for production we'd want a CDN (Cloudflare Workers). Worth flagging in the report?
