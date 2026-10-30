# Tasty World

A cozy isometric voxel street-food travel game. First stop: Tokyo.

Walk the lanes of a hand-built voxel corner of Tokyo, taste twelve traditional dishes, help the vendors cook, fill your Food Passport and hunt for the lucky cats that guard a hidden counter.

## Tech

- Vite + TypeScript + three.js (WebGL 2), installable PWA via vite-plugin-pwa.
- The whole city is generated in code: a voxel grid is greedy-meshed and lit (sun shadows, sky occlusion, lantern light) inside Web Workers at load, so the day/night cycle costs nothing at runtime.
- One post pass adds bloom, screen-space volumetric water (refraction, caustics, light shafts, reflections), tilt-shift and grading.

## Scripts

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run check:world` bakes the world in Node and checks that every stall, NPC and path node is walkable.
- `npm run icons` regenerates the PWA icons.

Player-facing patch notes live in `src/data/patchNotes.ts`; every merge adds an entry.
