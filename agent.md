# Home Vision Agent Requirements

This deployment is for a private, single-user home environment. The owner has explicitly consented to enrollment and local processing of their own data. Consent does not extend to visitors, neighbors, passersby, household members, or other bystanders.

## Required capabilities

- Require explicit biometric enrollment of the owner before enabling owner face verification.
- Use face verification only to compare a live image with the owner's deliberately enrolled template. Do not identify unknown people or search external identity databases.
- Detect and track people without assigning identity when they are not enrolled.
- Detect visible, non-sensitive attributes useful for search, including face mask, cap, hat, hood, and clothing type and color. Treat these as temporary appearance descriptors, not identity or intent.
- Detect vehicles and extract license-plate text when visible.
- Estimate vehicle make, model, type, and color, and attach confidence scores to every estimate.
- Keep biometric templates, plate observations, and recordings local by default; encrypt stored data, restrict access to the owner, maintain an audit log, and provide deletion and retention controls.
- Clearly label uncertain results and require human confirmation before alerts or actions with meaningful consequences.
## Prohibited capabilities

- Do not infer or classify race, ethnicity, complexion or skin color, emotional state, health, disability, religion, sex life, political affiliation, or other sensitive traits from images or video.
- Do not use gait, body size, weight, girth, or body shape as biometric identifiers.
- Do not enroll bystanders automatically.
- Do not treat clothing, masks, hats, hoods, vehicle appearance, or license plates as proof of a person's identity.
- Do not make claims about intent, criminality, dangerousness, or trustworthiness from appearance or biometric signals.

## Accuracy and privacy safeguards

- Prefer on-device processing and data minimization.
- Store protected templates, owner enrollment IDs, timestamps, and minimal lookup metadata rather than reusable raw face crops whenever technically possible.
- Apply configurable retention limits and delete expired observations automatically.
- Record model version, confidence, timestamp, and camera source for detections.
- Provide a visible way to disable capture, revoke enrollment, export owner data, and permanently delete it.
- Test false accepts and false rejects under expected lighting, camera angles, masks, hats, and occlusion before relying on owner verification.
