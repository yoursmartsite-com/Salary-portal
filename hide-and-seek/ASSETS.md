# Lamma Hide & Seek — asset intake

This folder is an isolated staging area. Nothing here is wired into the live Lamma navigation or Firebase yet.

## Selected free assets

### Main female character candidate
- Asset: EMA, rigged female protagonist, GLB (7.8 MB) / FBX (5.3 MB)
- Creator: THEUNSEENVULGA
- Source: https://theunseenvulga.itch.io/3d-character-riggedema
- Licence: CC0, including commercial use; attribution not required (per the asset page).
- Import target: GLB for Three.js; FBX is available if the rig needs Mixamo processing.
- Required validation before shipping: inspect mesh, textures, skeleton, scale, and animation compatibility in Blender/Three.js.

### Animation pipeline
- Mixamo: https://www.mixamo.com/
- Use only clips compatible with the selected skeleton. Required clips: idle, walk, run, jump, crouch/hide, search/turn.
- Do not assume a clip retargets correctly until tested on EMA.

### Realistic environment library
- Poly Haven: https://polyhaven.com/
- CC0 models, PBR textures, and HDRIs. Select urban props/materials individually and retain the source asset IDs and licence details.
- ambientCG: https://ambientcg.com/
- CC0 PBR materials for asphalt, concrete, brick, plaster, and metal.

### Optional extra models
- Sketchfab downloads: https://sketchfab.com/features/free-3d-models
- Check each model's individual licence; exclude CC BY-NC and any non-commercial-only terms.

## Technical target
- Engine/runtime: Three.js + GLTFLoader + SkeletonUtils.
- Target: mobile-first browser build, desktop supported.
- Initial round: 8 player slots, one seeker and seven hiders.
- Separate page only: do not alter the live homepage, existing games, accounts, or Firebase while the prototype is being validated.

## Acceptance checks before integration
1. EMA GLB loads with all textures and a visible skeleton.
2. Idle, walk, and run clips work without broken joints.
3. Camera orbit and third-person follow work on touch and mouse.
4. Scene maintains usable frame rate on mid-range Android.
5. Online rooms are a separate phase; never label the prototype as multiplayer until a real 8-client test passes.
