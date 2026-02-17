# Media Interaction Experiement

## Goal

A fully engineeringly scalable and self-evolve friendly Augmented Reality Animation Framework.

## Game Engine

[Three.js]() For interactable 3D canvas 

### Compatibility With Current World Design

- Current `World` architecture is compatible with 3D because it already uses normalized coordinates, frame-based updates, and object-level interaction state.
- Existing gesture recognizers and `updateWorldFrame` loop are unchanged; 3D support is added by extending object schema and rendering adapters.

### 3D Adaptation Implemented

- Extended world object kinds with `box3d` and `sphere3d`.
- Added optional `position.z` and `size.depth` fields so 2D objects continue working without changes.
- Added depth-aware hit-testing and drag tracking in world interaction.
- Added Three.js overlay renderer that consumes the same `World` state each frame.
- `App` add-interactable panel now supports 3D shape, `Z`, and `Depth` inputs.

## Media Pipe Ability

[Hand landmark detection](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)

With self defined algorithm to detect the gesture and movement of user.
