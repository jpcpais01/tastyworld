# Tasty World

A cozy isometric voxel street-food travel game. First stop: Tokyo.

Walk the lanes of a hand-built voxel corner of Tokyo, taste twelve traditional dishes, help the vendors cook, fill your Food Passport and hunt for the lucky cats that guard a hidden counter.

## Tech

- Vite + TypeScript + three.js (WebGL 2), installable PWA via vite-plugin-pwa.
- The whole city is generated in code: a voxel grid is greedy-meshed and lit (sun shadows, sky occlusion, lantern light) inside Web Workers at load, so the day/night cycle costs nothing at runtime.
- One post pass adds bloom, screen-space volumetric water (refraction, caustics, light shafts, reflections), tilt-shift and grading.
- Co-op needs no server: a trip's ticket code names a [Trystero](https://github.com/dmotz/trystero) room, peers meet through public Nostr relays and then talk directly over WebRTC (`src/net/coop.ts`). For testing, `?net=local` pairs tabs of one browser over a BroadcastChannel, and `?relay=ws://host:port` signals through your own relay.
- The travel map is a voxel diorama baked from Natural Earth land (`npm run worldmap` regenerates `src/data/worldmap.ts`).

## Scripts

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run check:world` bakes the world in Node and checks that every stall, NPC and path node is walkable.
- `npm run icons` regenerates the PWA icons.
- `npm run worldmap` rebuilds the travel map's land grid from Natural Earth.

Player-facing patch notes live in `src/data/patchNotes.ts`; every merge adds an entry.
