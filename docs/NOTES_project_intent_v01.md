# Project Intent & Context Notes (v01)

**Date:** 2026-10-17

## 1. Original User Request (Verbatim)

> "I want to create a lego-like game: a world where a little avatar can run around let's say a flower garden with trees and benches and water fountains, and everything is made of toy building bricks, so when you hit or kick or jump on anything, it smashes into little toy brick pieces."

## 2. Clarified Preferences & Decisions

When asked how the game should be built and which additional mechanics should be included, the user selected:

- **Platform & Rendering Stack:**
  - `3D in the browser using Three.js (single HTML/JS app or Vite project, instant play in browser)`
- **Core & Extended Features:**
  - `Collect scattered studs/bricks as a score or currency counter`
  - `Sound effects (plastic brick clatter, smash, fountain water, footsteps) via Web Audio synth`
  - `Rebuild / respawn smashed objects (either manually with a key or after a timer)`

## 3. Core Design Nuances & Intent

- **Tactile Toy Brick Construction:** Objects in the world (flower garden, trees, benches, water fountains, flowers, lamps, walls) should not merely be solid meshes that swap to particles—they should visibly be constructed out of individual interlocking toy bricks with top studs, so that when smashed, the actual constituent bricks fly apart, tumble with 3D physics, bounce on the ground, and can be kicked around or rebuilt.
- **Physicality of Avatar Actions:** The little toy avatar can run around freely and smash objects through multiple physical interactions:
  1. **Hitting / Kicking:** Dedicated kick/attack button (or mouse click) with a lunge and roundhouse kick animation.
  2. **Jumping On / Stomping:** Jumping onto benches, fountains, flowers, or trees—including a mid-air ground-pound stomp—smashes them on landing.
  3. **Running into scattered pieces:** Loose bricks on the ground react physically when the avatar walks or kicks through them, while collectible studs magnetize into the score counter.
- **Reversibility (Destruction + Rebuild Loop):** Smashing the entire garden is satisfying, and being able to smoothly reassemble smashed objects (either nearby or across the whole garden via magnetic reverse-assembly) keeps the sandbox loop endlessly replayable.
- **Decorative Brick Sky (Non-Smashable):**
  - Verbatim follow-up request: *"can you add some brick clouds floating in the sky, just for fun, not for smashing"*
  - Clouds are multi-layered white and light-stone studded brick assemblies that drift and bob gently in the sky above the garden and around the horizon, framed within the default camera view, and intentionally excluded from the smashable prop list (`world.props`) so they remain purely atmospheric and whimsical.

