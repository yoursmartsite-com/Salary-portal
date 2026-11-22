# Battle Royale Mobile Prototype

Standalone Godot Android prototype, isolated on branch `standalone-battle-royale-apk`.
This does not modify the Lamma main branch or HUB project.

Prototype features:
- Third-person camera and touch look
- Touch movement by dragging the left side of the screen
- Fire, jump, reload controls
- Small procedural outdoor test map with buildings, trees, and cover
- Basic target bots and hit detection
- Health/ammo/kill/zone HUD

This is an early offline gameplay prototype, not a PUBG-scale multiplayer release.
The Android APK is built by GitHub Actions and uploaded as a workflow artifact.

Build pipeline now uses explicit Android SDK packages; see workflow run for APK validation.

Android SDK package installation step corrected for the next build.
