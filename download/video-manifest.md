# Video Manifest — Vision Agent Peru
## Round 1 Audit

| Video File | Duration | Resolution | Size | Mapped Use Cases | Source | License | Event Type | Notes |
|---|---|---|---|---|---|---|---|---|
| urban-intersection.mp4 | 33.6s | 1920x1080 | 13MB | crowd_surge, intrusion, auto_report, visual_memory, incident_description | Pexels | Pexels License | Persistent traffic | Good general-purpose clip |
| urban-crosswalk.mp4 | 19.8s | 1280x720 | 7.7MB | crowd_surge, queue_anomaly, incident_description | Pexels | Pexels License | Persistent pedestrians | Good crowd clip |
| urban-street.mp4 | 13.4s | 1280x720 | 5.0MB | parking, after_hours, intrusion | Pexels | Pexels License | Persistent traffic | Good vehicle clip |
| urban-pedestrians.mp4 | 15.7s | 1920x1080 | 8.5MB | visual_memory, intrusion, auto_report | Pexels | Pexels License | Persistent pedestrians | Good person clip |
| uc-graffiti.mp4 | 33.8s | 1280x720 | 2.2MB | graffiti | Stock | Unknown | Person spraying graffiti | No negative lead-in |
| uc-fire.mp4 | 6.2s | 1280x720 | 2.5MB | fire_smoke | Stock | Unknown | Fire burning | Very short, no negative lead-in |
| uc-parking-lot.mp4 | 15.0s | 1280x720 | 1.0MB | parking | Stock | Unknown | Parking lot view | Good parking clip |
| uc-night-driving.mp4 | 13.8s | 720x1280 | 2.4MB | after_hours, intrusion | Stock | Unknown | Night driving | Vertical orientation |
| uc-queue.mp4 | 14.9s | 1280x720 | 1.9MB | queue_anomaly | Stock | Unknown | People in queue | Good queue clip |
| uc-backpack.mp4 | 25.2s | 1280x720 | 5.1MB | abandoned_object | Stock | Unknown | Person with backpack | No actual abandonment event |
| uc-flood.mp4 | 15.6s | 720x1280 | 6.1MB | flood_watch, landslide_watch, slip_hazard | Stock | Unknown | Flood/rain scene | Vertical orientation |
| uc-foggy-night.mp4 | 11.5s | 720x1280 | 1.2MB | after_hours, intrusion | Stock | Unknown | Foggy night | Vertical, low visibility |
| uc-demolished.mp4 | 19.8s | 1920x1080 | 14.5MB | post_quake, landslide_watch | Stock | Unknown | Demolished building | Good damage clip |
| uc-crack.mp4 | 15.0s | 720x1280 | 960KB | post_quake | Stock | Unknown | Wall crack | Vertical, good crack clip |
| arequipa.mp4 | 20.2s | 2560x1440 | 34MB | UNMAPPED | Pexels | Pexels License | City square | Not linked to any use case |
| cusco.mp4 | 37.0s | 1280x720 | 14MB | UNMAPPED | Pexels | Pexels License | City square | Not linked to any use case |
| lima.mp4 | 17.7s | 2160x3840 | 32MB | UNMAPPED | Pexels | Pexels License | City (vertical) | Not linked, vertical 4K |
| uc-night-parking.mp4 | 26.8s | 1920x1080 | 16.5MB | UNMAPPED | Stock | Unknown | Night parking lot | Not linked to any use case |
| uc-parking.mp4 | 3.5s | 720x1280 | 350KB | UNMAPPED | Stock | Unknown | Parking (vertical) | Not linked, very short |

## Issues Found
1. **5 videos unmapped** — arequipa, cusco, lima, uc-night-parking, uc-parking exist in /public/sim/ but are not linked to any camera source
2. **No negative lead-in** — fire and graffiti clips start with the event already in progress
3. **No event offset** — no clip shows the event ending (fire going out, graffiti completing)
4. **Unknown licenses** — most uc-* videos have unknown source/license
5. **Vertical orientation** — several clips are portrait mode (720x1280) which may cause layout issues
6. **No hard negatives** — no clips designed to produce false positives (e.g., sunset for fire, shadows for intrusion)
