# 3D Website Toolchain

OpenCode
├── Blender MCP
│   ├── create/edit models
│   ├── materials
│   ├── UVs
│   ├── lighting
│   └── export GLB
│
├── 3D Asset Sources
│   ├── Poly Haven
│   ├── Sketchfab
│   └── your own GLB/GLTF models
│
├── Optimization
│   ├── gltfjsx
│   ├── glTF Transform
│   ├── Draco / Meshopt
│   └── KTX2 / WebP textures
│
└── Website
    ├── three
    ├── @react-three/fiber
    ├── @react-three/drei
    └── @react-three/postprocessing

## Model Format Guidelines

- **PRIMARY**: `.glb`
- **ALSO ACCEPTABLE**: `.gltf`
- **AVOID loading directly on website**: `.blend`, `.fbx`, `.obj`, `.stl`
  (convert these to `.glb`/`.gltf` first via Blender MCP or glTF Transform)

## Pipeline

```
FBX / OBJ / Blend
       ↓
    Blender
       ↓
 optimise model
       ↓
    export
       ↓
     GLB
       ↓
React Three Fiber
```

## Texture & Map Formats

- **Base Color**      → WebP / KTX2
- **Normal map**      → KTX2
- **Roughness**       → KTX2
- **Metalness**       → KTX2
- **AO**              → KTX2
- **HDRI**            → HDR / EXR

## Capabilities

### Blender operations
- inspect scene objects
- modify geometry
- change materials
- execute Blender Python
- take viewport screenshot

### Asset sources
- Poly Haven search
- Sketchfab search
- download assets

### Asset generation
- Hyper3D generation
- Hunyuan3D generation

## Poly Haven

Particularly useful for:

- HDRIs
- studio lighting
- asphalt
- concrete
- wood
- metal
- rocks
- environment textures
- some 3D models

## Sketchfab

Useful for obtaining things like:

- cars
- engines
- buildings
- mountains
- aircraft
- mechanical objects
- furniture
- props
- environment assets

## Project Structure

```
project/
├── public/
│   ├── models/
│   │   ├── hero/
│   │   ├── environment/
│   │   ├── props/
│   │   └── optimized/
│   │
│   ├── textures/
│   │   ├── materials/
│   │   ├── decals/
│   │   └── particles/
│   │
│   ├── hdr/
│   │
│   └── draco/
│
├── src/
│   ├── three/
│   │   ├── models/
│   │   ├── scenes/
│   │   ├── shaders/
│   │   ├── materials/
│   │   ├── lights/
│   │   ├── cameras/
│   │   └── effects/
```

## Skill

```
.opencode/
└── skills/
    └── 3d-asset-pipeline/
        └── SKILL.md
```

## Production Guidelines

- Never use raw FBX/OBJ assets in production.
- Prefer GLB.

### Check
- triangle count
- material count
- texture size
- draw calls
- animations
- bounding boxes

- Optimize models before production.

### Prefer
- Meshopt
- KTX2
- WebP
- instancing
- LOD

- Do not downgrade visible hero-object quality unnecessarily.
- Keep original source assets separate from production assets.

## Stack Checklist

### ESSENTIAL
- [x] Blender
- [x] Blender MCP
- [x] Three.js
- [x] React Three Fiber
- [x] Drei
- [x] GLTFJSX
- [x] glTF Transform
- [x] GLB / GLTF
- [x] WebP / KTX2
- [x] HDRI

### ASSET SOURCES
- [x] Poly Haven
- [x] Sketchfab

### OPTIONAL AI 3D
- [ ] Hyper3D / Rodin
- [ ] Hunyuan3D
- [ ] Meshy
- [ ] Tripo

## End-to-End Flow

```
                    OPENCODE
             ┌──────────┴──────────┐
             │                     │
        Blender MCP            Context7
             │                     │
       Asset Creation          Three.js docs
             │
             ▼
       Blender Scene
             │
             ▼
          .GLB
             │
        GLTF Transform
             │
      Meshopt + KTX2
             │
          GLTFJSX
             │
             ▼
      React Three Fiber
             │
             ▼
      IMMERSIVE WEBSITE
```
