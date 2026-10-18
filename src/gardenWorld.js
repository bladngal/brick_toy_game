import * as THREE from 'three';
import {
  STUD_UNIT,
  BRICK_HEIGHT,
  PLATE_HEIGHT,
  BRICK_PALETTE,
} from './brickBuilder.js';

export class GardenWorld {
  constructor(scene, brickFactory) {
    this.scene = scene;
    this.factory = brickFactory;
    this.props = []; // All smashable brick structures
    this.waterDroplets = []; // Animated fountain water brick droplets
    this.groundGroup = new THREE.Group();
    this.scene.add(this.groundGroup);

    this._buildBaseplateAndPaths();
    this._populateGarden();
  }

  _buildBaseplateAndPaths() {
    // Main lush green baseplate
    const baseSize = 56;
    const baseGeo = new THREE.BoxGeometry(baseSize, 0.6, baseSize);
    baseGeo.translate(0, -0.3, 0);
    const baseMat = this.factory.getMaterial(BRICK_PALETTE.brightGreen);
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.receiveShadow = true;
    this.groundGroup.add(baseMesh);

    // Outer wooden/stone garden frame rim
    const rimColors = [BRICK_PALETTE.darkGreen, BRICK_PALETTE.mediumStone];
    const half = baseSize / 2;
    const borderThick = 1.0;
    const northRim = new THREE.Mesh(
      new THREE.BoxGeometry(baseSize + 2, 0.5, borderThick),
      this.factory.getMaterial(rimColors[0])
    );
    northRim.position.set(0, 0.15, -half);
    northRim.receiveShadow = true;
    this.groundGroup.add(northRim);

    const southRim = northRim.clone();
    southRim.position.set(0, 0.15, half);
    this.groundGroup.add(southRim);

    const eastRim = new THREE.Mesh(
      new THREE.BoxGeometry(borderThick, 0.5, baseSize + 2),
      this.factory.getMaterial(rimColors[0])
    );
    eastRim.position.set(half, 0.15, 0);
    eastRim.receiveShadow = true;
    this.groundGroup.add(eastRim);

    const westRim = eastRim.clone();
    westRim.position.set(-half, 0.15, 0);
    this.groundGroup.add(westRim);

    // Decorative grass studs across the lawn (instanced for high performance)
    const studGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.06, 10);
    studGeo.translate(0, 0.03, 0);
    const studMat = this.factory.getMaterial(BRICK_PALETTE.brightGreen);

    const lawnStudPositions = [];
    for (let x = -25; x <= 25; x += 1.0) {
      for (let z = -25; z <= 25; z += 1.0) {
        // Skip central stone plaza and cross pathways
        const distCenter = Math.hypot(x, z);
        if (distCenter < 6.2) continue;
        if (Math.abs(x) < 2.2 || Math.abs(z) < 2.2) continue;
        lawnStudPositions.push([x, z]);
      }
    }

    const instancedStuds = new THREE.InstancedMesh(
      studGeo,
      studMat,
      lawnStudPositions.length
    );
    instancedStuds.receiveShadow = true;
    const dummy = new THREE.Object3D();
    lawnStudPositions.forEach(([x, z], i) => {
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      instancedStuds.setMatrixAt(i, dummy.matrix);
    });
    this.groundGroup.add(instancedStuds);

    // Stone brick plaza & cross paths (flat smooth tiles + studded stone edging)
    const stoneColors = [
      BRICK_PALETTE.lightStone,
      BRICK_PALETTE.mediumStone,
      BRICK_PALETTE.tan,
    ];

    // Central octagonal-style stone plaza around main fountain
    for (let x = -5.5; x <= 5.5; x += 1.0) {
      for (let z = -5.5; z <= 5.5; z += 1.0) {
        if (Math.hypot(x, z) <= 6.0) {
          const color = stoneColors[(Math.abs(Math.round(x + z))) % stoneColors.length];
          const tile = this.factory.createBrick(2, 2, color, {
            isTile: (Math.round(x) + Math.round(z)) % 2 === 0,
            isPlate: true,
          });
          tile.position.set(x, -0.08, z);
          this.groundGroup.add(tile);
        }
      }
    }

    // 4 Cardinal walkways
    for (let d = 6.5; d <= 24.5; d += 1.0) {
      for (let w = -1.5; w <= 1.5; w += 1.0) {
        const isEdge = Math.abs(w) === 1.5;
        const c = isEdge ? BRICK_PALETTE.mediumStone : BRICK_PALETTE.lightStone;
        const opts = { isPlate: true, isTile: !isEdge };

        // North & South
        [d, -d].forEach((zPos) => {
          const t1 = this.factory.createBrick(2, 2, c, opts);
          t1.position.set(w, -0.08, zPos);
          this.groundGroup.add(t1);
        });

        // East & West
        [d, -d].forEach((xPos) => {
          const t2 = this.factory.createBrick(2, 2, c, opts);
          t2.position.set(xPos, -0.08, w);
          this.groundGroup.add(t2);
        });
      }
    }
  }

  /**
   * Helper to register a smashable prop composed of individual bricks.
   */
  _registerProp({ name, category, x, z, rotationY = 0, radius = 1.2, height = 2.0, maxHp = 1, studCount = 5, isFountain = false, bricks = [] }) {
    const propGroup = new THREE.Group();
    propGroup.position.set(x, 0, z);
    propGroup.rotation.y = rotationY;
    this.scene.add(propGroup);

    const brickEntries = bricks.map((b) => {
      const mesh = this.factory.createBrick(
        b.sx,
        b.sz,
        b.color,
        b.opts || {}
      );
      mesh.position.set(b.lx, b.ly, b.lz);
      mesh.rotation.y = b.ry || 0;
      propGroup.add(mesh);

      return {
        mesh,
        localPos: new THREE.Vector3(b.lx, b.ly, b.lz),
        localRotY: b.ry || 0,
        detached: false,
      };
    });

    const prop = {
      id: `prop_${this.props.length}`,
      name,
      category,
      group: propGroup,
      x,
      z,
      rotationY,
      radius,
      height,
      maxHp,
      hp: maxHp,
      studCount,
      isFountain,
      smashed: false,
      smashedAt: 0,
      wobbleTime: 0,
      brickEntries,
    };

    this.props.push(prop);
    return prop;
  }

  _populateGarden() {
    // 1. GRAND CENTERPIECE WATER FOUNTAIN (0, 0)
    this.createGrandFountain(0, 0);

    // 2. TWO SMALLER CORNER WATER FOUNTAINS
    this.createCornerFountain(-13, -13, 'Northwest Bubbling Fountain');
    this.createCornerFountain(13, -13, 'Northeast Bubbling Fountain');

    // 3. SIX WOODEN & IRON PARK BENCHES ALONG THE PLAZA & PATHS
    this.createParkBench(-4.8, -3.2, Math.PI * 0.25);
    this.createParkBench(4.8, -3.2, -Math.PI * 0.25);
    this.createParkBench(-4.8, 3.2, Math.PI * 0.75);
    this.createParkBench(4.8, 3.2, -Math.PI * 0.75);
    this.createParkBench(-3.4, -11.5, Math.PI * 0.5);
    this.createParkBench(3.4, 11.5, -Math.PI * 0.5);

    // 4. TREES (Oak, Cherry Blossom, and Cypress)
    this.createOakTree(-9.5, -6.5, 1.0);
    this.createOakTree(9.5, 6.5, 1.15);
    this.createOakTree(-17.5, 8.5, 0.95);
    this.createOakTree(17.5, -8.5, 1.1);

    this.createCherryBlossomTree(9.0, -7.0);
    this.createCherryBlossomTree(-9.0, 7.0);
    this.createCherryBlossomTree(-15.5, -16.5);
    this.createCherryBlossomTree(15.5, 16.5);

    this.createCypressTree(-6.5, -16.0);
    this.createCypressTree(6.5, -16.0);
    this.createCypressTree(-18.0, -3.5);
    this.createCypressTree(18.0, 3.5);

    // 5. FLOWER BEDS & GIANT BRICK FLOWERS
    const flowerBedCoords = [
      [-6.5, 3.8, BRICK_PALETTE.red, BRICK_PALETTE.brightYellow],
      [6.5, 3.8, BRICK_PALETTE.magenta, BRICK_PALETTE.orange],
      [-6.5, -3.8, BRICK_PALETTE.lavender, BRICK_PALETTE.brightYellow],
      [6.5, -3.8, BRICK_PALETTE.cyan, BRICK_PALETTE.softPink],
      [-11.5, 11.5, BRICK_PALETTE.red, BRICK_PALETTE.magenta],
      [11.5, 11.5, BRICK_PALETTE.brightYellow, BRICK_PALETTE.orange],
      [-12.5, -8.5, BRICK_PALETTE.blossomPink, BRICK_PALETTE.lavender],
      [12.5, -8.5, BRICK_PALETTE.red, BRICK_PALETTE.cyan],
    ];
    flowerBedCoords.forEach(([fx, fz, c1, c2]) => {
      this.createFlowerBed(fx, fz, c1, c2);
    });

    // Individual oversized vibrant garden flowers you can run through and kick!
    const singleFlowerSpots = [
      [-4.2, 8.2, BRICK_PALETTE.red],
      [4.2, 8.2, BRICK_PALETTE.brightYellow],
      [-4.2, -8.2, BRICK_PALETTE.magenta],
      [4.2, -8.2, BRICK_PALETTE.orange],
      [-8.5, 14.0, BRICK_PALETTE.cyan],
      [8.5, 14.0, BRICK_PALETTE.lavender],
      [-14.0, 4.2, BRICK_PALETTE.brightYellow],
      [14.0, -4.2, BRICK_PALETTE.red],
      [-8.0, -11.5, BRICK_PALETTE.softPink],
      [8.0, -11.5, BRICK_PALETTE.orange],
    ];
    singleFlowerSpots.forEach(([fx, fz, petalColor]) => {
      this.createGiantFlowerCluster(fx, fz, petalColor);
    });

    // 6. GARDEN LAMP POSTS
    const lampCoords = [
      [-3.2, -6.8],
      [3.2, -6.8],
      [-3.2, 6.8],
      [3.2, 6.8],
      [-6.8, -3.2],
      [6.8, 3.2],
    ];
    lampCoords.forEach(([lx, lz]) => {
      this.createGardenLamp(lx, lz);
    });

    // 7. GARDEN ARCHWAYS OVER NORTH & SOUTH PATHWAYS
    this.createGardenArchway(0, -14.5, 0);
    this.createGardenArchway(0, 14.5, 0);

    // 8. LOW BRICK HEDGES & TOADSTOOL CLUSTERS
    this.createBrickHedge(-10.5, 0, Math.PI * 0.5);
    this.createBrickHedge(10.5, 0, Math.PI * 0.5);
    this.createToadstoolPatch(-15.0, 13.5);
    this.createToadstoolPatch(15.0, -13.5);
  }

  createGrandFountain(x, z) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Outer octagonal stone basin wall (2 layers high)
    const rimSegments = [
      // North & South walls
      { lx: 0, lz: -2.25, sx: 6, sz: 1, ry: 0 },
      { lx: 0, lz: 2.25, sx: 6, sz: 1, ry: 0 },
      // East & West walls
      { lx: -2.25, lz: 0, sx: 1, sz: 6, ry: 0 },
      { lx: 2.25, lz: 0, sx: 1, sz: 6, ry: 0 },
      // 4 Corner connectors
      { lx: -1.75, lz: -1.75, sx: 2, sz: 2, ry: 0 },
      { lx: 1.75, lz: -1.75, sx: 2, sz: 2, ry: 0 },
      { lx: -1.75, lz: 1.75, sx: 2, sz: 2, ry: 0 },
      { lx: 1.75, lz: 1.75, sx: 2, sz: 2, ry: 0 },
    ];

    for (let layer = 0; layer < 2; layer++) {
      rimSegments.forEach((seg, idx) => {
        bricks.push({
          ...seg,
          ly: layer * h,
          color: layer === 1 ? BRICK_PALETTE.white : (idx % 2 === 0 ? BRICK_PALETTE.lightStone : BRICK_PALETTE.mediumStone),
        });
      });
    }

    // Translucent blue water bricks filling the basin
    for (let wx = -1.25; wx <= 1.25; wx += 1.0) {
      for (let wz = -1.25; wz <= 1.25; wz += 1.0) {
        if (Math.abs(wx) < 0.4 && Math.abs(wz) < 0.4) continue;
        bricks.push({
          lx: wx,
          ly: h * 0.8,
          lz: wz,
          sx: 2,
          sz: 2,
          color: (Math.round(wx + wz) % 2 === 0) ? BRICK_PALETTE.transLightBlue : BRICK_PALETTE.transDarkBlue,
          opts: { translucent: true },
        });
      }
    }

    // Center stone pedestal column (5 layers tall)
    for (let layer = 0; layer < 5; layer++) {
      bricks.push({
        lx: 0,
        ly: layer * h,
        lz: 0,
        sx: 2,
        sz: 2,
        color: layer % 2 === 0 ? BRICK_PALETTE.white : BRICK_PALETTE.lightStone,
      });
    }

    // Upper tier water bowl
    bricks.push({
      lx: 0,
      ly: 5 * h,
      lz: 0,
      sx: 4,
      sz: 4,
      color: BRICK_PALETTE.white,
      opts: { isPlate: true },
    });
    bricks.push({
      lx: -0.75,
      ly: 5 * h + PLATE_HEIGHT,
      lz: 0,
      sx: 1,
      sz: 3,
      color: BRICK_PALETTE.transLightBlue,
      opts: { translucent: true, isPlate: true },
    });
    bricks.push({
      lx: 0.75,
      ly: 5 * h + PLATE_HEIGHT,
      lz: 0,
      sx: 1,
      sz: 3,
      color: BRICK_PALETTE.transLightBlue,
      opts: { translucent: true, isPlate: true },
    });

    // Top golden finial spout
    bricks.push({
      lx: 0,
      ly: 5 * h + PLATE_HEIGHT,
      lz: 0,
      sx: 2,
      sz: 2,
      color: BRICK_PALETTE.brightYellow,
    });
    bricks.push({
      lx: 0,
      ly: 6 * h + PLATE_HEIGHT,
      lz: 0,
      sx: 1,
      sz: 1,
      color: BRICK_PALETTE.transLightBlue,
      opts: { isRound: true, translucent: true, emissive: true },
    });

    const prop = this._registerProp({
      name: 'Grand Garden Fountain',
      category: 'Fountain',
      x,
      z,
      radius: 2.6,
      height: 3.2,
      maxHp: 2,
      studCount: 16,
      isFountain: true,
      bricks,
    });

    this._createFountainJets(prop, 2.9, 14);
  }

  createCornerFountain(x, z, name) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Basin walls
    const walls = [
      { lx: 0, lz: -1.25, sx: 4, sz: 1 },
      { lx: 0, lz: 1.25, sx: 4, sz: 1 },
      { lx: -1.25, lz: 0, sx: 1, sz: 4 },
      { lx: 1.25, lz: 0, sx: 1, sz: 4 },
    ];
    walls.forEach((w) => {
      bricks.push({ ...w, ly: 0, color: BRICK_PALETTE.lightStone });
      bricks.push({ ...w, ly: h, color: BRICK_PALETTE.white, opts: { isPlate: true } });
    });

    // Water bricks inside
    [-0.5, 0.5].forEach((wx) => {
      [-0.5, 0.5].forEach((wz) => {
        bricks.push({
          lx: wx,
          ly: h * 0.5,
          lz: wz,
          sx: 2,
          sz: 2,
          color: BRICK_PALETTE.transLightBlue,
          opts: { translucent: true },
        });
      });
    });

    // Center spout pillar
    for (let i = 0; i < 3; i++) {
      bricks.push({
        lx: 0,
        ly: i * h,
        lz: 0,
        sx: 2,
        sz: 2,
        color: i === 2 ? BRICK_PALETTE.cyan : BRICK_PALETTE.white,
      });
    }
    bricks.push({
      lx: 0,
      ly: 3 * h,
      lz: 0,
      sx: 1,
      sz: 1,
      color: BRICK_PALETTE.transLightBlue,
      opts: { isRound: true, translucent: true, emissive: true },
    });

    const prop = this._registerProp({
      name,
      category: 'Fountain',
      x,
      z,
      radius: 1.6,
      height: 1.8,
      maxHp: 1,
      studCount: 10,
      isFountain: true,
      bricks,
    });

    this._createFountainJets(prop, 1.6, 8);
  }

  _createFountainJets(prop, spoutHeight, count) {
    for (let i = 0; i < count; i++) {
      const droplet = this.factory.createBrick(
        1,
        1,
        i % 2 === 0 ? BRICK_PALETTE.transLightBlue : BRICK_PALETTE.cyan,
        { isRound: true, isPlate: true, translucent: true }
      );
      const angle = (i / count) * Math.PI * 2;
      this.scene.add(droplet);
      this.waterDroplets.push({
        mesh: droplet,
        prop,
        angle,
        phase: i / count,
        spoutHeight,
        spreadRadius: prop.radius * 0.68,
      });
    }
  }

  createParkBench(x, z, rotationY = 0) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Left & right dark iron legs
    [-1.25, 1.25].forEach((lx) => {
      bricks.push({
        lx,
        ly: 0,
        lz: 0,
        sx: 1,
        sz: 2,
        color: BRICK_PALETTE.darkStone,
      });
      // Armrests
      bricks.push({
        lx,
        ly: h + PLATE_HEIGHT,
        lz: 0,
        sx: 1,
        sz: 2,
        color: BRICK_PALETTE.darkStone,
      });
    });

    // Wooden seat planks (two 1x6-like rows built from 1x3 bricks so more pieces fly!)
    [-0.75, 0.75].forEach((lx) => {
      [-0.25, 0.25].forEach((lz, zIdx) => {
        bricks.push({
          lx,
          ly: h,
          lz,
          sx: 3,
          sz: 1,
          color: zIdx === 0 ? BRICK_PALETTE.woodBrown : BRICK_PALETTE.tan,
          opts: { isPlate: true },
        });
      });
    });

    // Wooden backrest planks
    for (let layer = 1; layer <= 2; layer++) {
      [-0.75, 0.75].forEach((lx) => {
        bricks.push({
          lx,
          ly: layer * h + PLATE_HEIGHT,
          lz: -0.35,
          sx: 3,
          sz: 1,
          color: layer === 1 ? BRICK_PALETTE.woodBrown : BRICK_PALETTE.reddishBrown,
        });
      });
    }

    this._registerProp({
      name: 'Garden Park Bench',
      category: 'Bench',
      x,
      z,
      rotationY,
      radius: 1.55,
      height: 1.5,
      maxHp: 1,
      studCount: 7,
      bricks,
    });
  }

  createOakTree(x, z, scale = 1) {
    const bricks = [];
    const h = BRICK_HEIGHT;
    const trunkLayers = scale > 1.05 ? 6 : 5;

    // Root flares
    [
      [-0.5, 0],
      [0.5, 0],
      [0, -0.5],
      [0, 0.5],
    ].forEach(([rx, rz]) => {
      bricks.push({
        lx: rx,
        ly: 0,
        lz: rz,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.reddishBrown,
      });
    });

    // Sturdy brown brick trunk
    for (let i = 0; i < trunkLayers; i++) {
      bricks.push({
        lx: 0,
        ly: i * h,
        lz: 0,
        sx: 2,
        sz: 2,
        color: i % 2 === 0 ? BRICK_PALETTE.woodBrown : BRICK_PALETTE.reddishBrown,
      });
    }

    // Lush multi-layered green leaf brick canopy
    const canopyBase = trunkLayers * h;
    const leafColors = [
      BRICK_PALETTE.brightGreen,
      BRICK_PALETTE.darkGreen,
      BRICK_PALETTE.limeGreen,
    ];

    // Layer 1 & 2 wide canopy bricks
    for (let cl = 0; cl < 3; cl++) {
      const radiusBricks = cl === 1 ? 2 : 1;
      for (let cx = -radiusBricks; cx <= radiusBricks; cx++) {
        for (let cz = -radiusBricks; cz <= radiusBricks; cz++) {
          if (Math.abs(cx) === 2 && Math.abs(cz) === 2) continue;
          const color = leafColors[(Math.abs(cx + cz + cl)) % leafColors.length];
          bricks.push({
            lx: cx * 0.9,
            ly: canopyBase + cl * h,
            lz: cz * 0.9,
            sx: 2,
            sz: 2,
            color,
          });
        }
      }
    }

    // Crown top + hidden golden apple / flower on top
    bricks.push({
      lx: 0,
      ly: canopyBase + 3 * h,
      lz: 0,
      sx: 2,
      sz: 2,
      color: BRICK_PALETTE.limeGreen,
    });
    bricks.push({
      lx: 0.75,
      ly: canopyBase + 0.5 * h,
      lz: 0.75,
      sx: 1,
      sz: 1,
      color: BRICK_PALETTE.red,
      opts: { isRound: true },
    });

    this._registerProp({
      name: 'Brick Oak Tree',
      category: 'Tree',
      x,
      z,
      radius: 1.65,
      height: canopyBase + 4 * h,
      maxHp: 2,
      studCount: 11,
      bricks,
    });
  }

  createCherryBlossomTree(x, z) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Trunk with slight artistic offset
    for (let i = 0; i < 5; i++) {
      bricks.push({
        lx: i >= 3 ? 0.15 : 0,
        ly: i * h,
        lz: 0,
        sx: 2,
        sz: 2,
        color: BRICK_PALETTE.reddishBrown,
      });
    }

    const canopyY = 5 * h;
    const blossomPalette = [
      BRICK_PALETTE.blossomPink,
      BRICK_PALETTE.softPink,
      BRICK_PALETTE.magenta,
      BRICK_PALETTE.white,
    ];

    const clusters = [
      [0, 0, 0],
      [-1.0, 0, 0],
      [1.0, 0, 0],
      [0, 0, -1.0],
      [0, 0, 1.0],
      [-0.85, 1, -0.85],
      [0.85, 1, -0.85],
      [-0.85, 1, 0.85],
      [0.85, 1, 0.85],
      [0, 1, 0],
      [-0.5, 2, 0],
      [0.5, 2, 0],
      [0, 2, -0.5],
      [0, 2, 0.5],
      [0, 3, 0],
    ];

    clusters.forEach(([cx, cy, cz], idx) => {
      bricks.push({
        lx: cx,
        ly: canopyY + cy * h,
        lz: cz,
        sx: 2,
        sz: 2,
        color: blossomPalette[idx % blossomPalette.length],
      });
    });

    this._registerProp({
      name: 'Cherry Blossom Tree',
      category: 'Tree',
      x,
      z,
      radius: 1.5,
      height: canopyY + 3.5 * h,
      maxHp: 2,
      studCount: 12,
      bricks,
    });
  }

  createCypressTree(x, z) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Short trunk
    for (let i = 0; i < 2; i++) {
      bricks.push({
        lx: 0,
        ly: i * h,
        lz: 0,
        sx: 2,
        sz: 2,
        color: BRICK_PALETTE.woodBrown,
      });
    }

    // Tall tapered spire of dark & bright green bricks
    for (let layer = 0; layer < 7; layer++) {
      const isTop = layer >= 5;
      const color = layer % 2 === 0 ? BRICK_PALETTE.darkGreen : BRICK_PALETTE.brightGreen;
      if (isTop) {
        bricks.push({
          lx: 0,
          ly: (2 + layer) * h,
          lz: 0,
          sx: 2,
          sz: 2,
          color: BRICK_PALETTE.limeGreen,
        });
      } else {
        bricks.push({
          lx: -0.35,
          ly: (2 + layer) * h,
          lz: 0,
          sx: 2,
          sz: 3,
          color,
        });
        bricks.push({
          lx: 0.35,
          ly: (2 + layer) * h,
          lz: 0,
          sx: 2,
          sz: 3,
          color,
        });
      }
    }

    this._registerProp({
      name: 'Garden Cypress Tree',
      category: 'Tree',
      x,
      z,
      radius: 1.2,
      height: 9 * h,
      maxHp: 1,
      studCount: 8,
      bricks,
    });
  }

  createFlowerBed(x, z, colorA, colorB) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // White/tan stone border planter box
    const planterWalls = [
      { lx: 0, lz: -1.0, sx: 4, sz: 1 },
      { lx: 0, lz: 1.0, sx: 4, sz: 1 },
      { lx: -1.0, lz: 0, sx: 1, sz: 3 },
      { lx: 1.0, lz: 0, sx: 1, sz: 3 },
    ];
    planterWalls.forEach((w) => {
      bricks.push({
        ...w,
        ly: 0,
        color: BRICK_PALETTE.tan,
      });
    });

    // 4 Stems + Colorful Blossom Heads inside the planter
    const flowerOffsets = [
      [-0.45, -0.45, colorA],
      [0.45, -0.45, colorB],
      [-0.45, 0.45, colorB],
      [0.45, 0.45, colorA],
    ];

    flowerOffsets.forEach(([fx, fz, fColor]) => {
      // Green stem
      bricks.push({
        lx: fx,
        ly: 0,
        lz: fz,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.brightGreen,
        opts: { isRound: true },
      });
      bricks.push({
        lx: fx,
        ly: h,
        lz: fz,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.limeGreen,
        opts: { isRound: true },
      });
      // Blossom petals plate
      bricks.push({
        lx: fx,
        ly: 2 * h,
        lz: fz,
        sx: 2,
        sz: 2,
        color: fColor,
        opts: { isPlate: true },
      });
      // Golden pollen center stud
      bricks.push({
        lx: fx,
        ly: 2 * h + PLATE_HEIGHT,
        lz: fz,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.brightYellow,
        opts: { isRound: true, isPlate: true },
      });
    });

    this._registerProp({
      name: 'Blooming Flower Bed',
      category: 'Flowers',
      x,
      z,
      radius: 1.35,
      height: 1.4,
      maxHp: 1,
      studCount: 6,
      bricks,
    });
  }

  createGiantFlowerCluster(x, z, petalColor) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Base leaves
    bricks.push({
      lx: -0.35,
      ly: 0,
      lz: 0,
      sx: 2,
      sz: 1,
      color: BRICK_PALETTE.brightGreen,
      opts: { isPlate: true },
    });
    bricks.push({
      lx: 0.35,
      ly: 0,
      lz: 0,
      sx: 2,
      sz: 1,
      color: BRICK_PALETTE.limeGreen,
      opts: { isPlate: true },
    });

    // Stem (3 round 1x1 bricks)
    for (let i = 0; i < 3; i++) {
      bricks.push({
        lx: 0,
        ly: PLATE_HEIGHT + i * h,
        lz: 0,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.brightGreen,
        opts: { isRound: true },
      });
    }

    const headY = PLATE_HEIGHT + 3 * h;
    // 4 Petals around center
    [
      [-0.5, 0, 1, 2],
      [0.5, 0, 1, 2],
      [0, -0.5, 2, 1],
      [0, 0.5, 2, 1],
    ].forEach(([px, pz, sx, sz]) => {
      bricks.push({
        lx: px,
        ly: headY,
        lz: pz,
        sx,
        sz,
        color: petalColor,
        opts: { isPlate: true },
      });
    });

    // Yellow center brick
    bricks.push({
      lx: 0,
      ly: headY,
      lz: 0,
      sx: 1,
      sz: 1,
      color: BRICK_PALETTE.brightYellow,
    });

    this._registerProp({
      name: 'Giant Toy Flower',
      category: 'Flowers',
      x,
      z,
      radius: 0.95,
      height: headY + h,
      maxHp: 1,
      studCount: 4,
      bricks,
    });
  }

  createGardenLamp(x, z) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Base
    bricks.push({
      lx: 0,
      ly: 0,
      lz: 0,
      sx: 2,
      sz: 2,
      color: BRICK_PALETTE.darkStone,
    });

    // Black lamp post pole
    for (let i = 1; i <= 4; i++) {
      bricks.push({
        lx: 0,
        ly: i * h,
        lz: 0,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.black,
        opts: { isRound: true },
      });
    }

    // Glowing translucent yellow lantern brick
    bricks.push({
      lx: 0,
      ly: 5 * h,
      lz: 0,
      sx: 2,
      sz: 2,
      color: BRICK_PALETTE.transYellow,
      opts: { translucent: true, emissive: true },
    });

    // Hat cap
    bricks.push({
      lx: 0,
      ly: 6 * h,
      lz: 0,
      sx: 2,
      sz: 2,
      color: BRICK_PALETTE.darkStone,
      opts: { isPlate: true },
    });

    this._registerProp({
      name: 'Garden Lamp Post',
      category: 'Lamp',
      x,
      z,
      radius: 0.85,
      height: 6.5 * h,
      maxHp: 1,
      studCount: 5,
      bricks,
    });
  }

  createGardenArchway(x, z, rotationY = 0) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    // Two white & red columns on either side of the path
    [-2.0, 2.0].forEach((px) => {
      for (let i = 0; i < 6; i++) {
        bricks.push({
          lx: px,
          ly: i * h,
          lz: 0,
          sx: 2,
          sz: 2,
          color: i % 2 === 0 ? BRICK_PALETTE.white : BRICK_PALETTE.red,
        });
      }
    });

    // Top trellis beam + climbing vines & blossoms
    for (let bx = -2.0; bx <= 2.0; bx += 1.0) {
      bricks.push({
        lx: bx,
        ly: 6 * h,
        lz: 0,
        sx: 2,
        sz: 2,
        color: BRICK_PALETTE.white,
      });
      bricks.push({
        lx: bx,
        ly: 7 * h,
        lz: 0,
        sx: 2,
        sz: 1,
        color: Math.abs(bx) === 1 ? BRICK_PALETTE.blossomPink : BRICK_PALETTE.brightGreen,
      });
    }

    this._registerProp({
      name: 'Rose Garden Archway',
      category: 'Archway',
      x,
      z,
      rotationY,
      radius: 2.35,
      height: 8 * h,
      maxHp: 2,
      studCount: 12,
      bricks,
    });
  }

  createBrickHedge(x, z, rotationY = 0) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    for (let layer = 0; layer < 3; layer++) {
      [-1.0, 0, 1.0].forEach((hx, i) => {
        bricks.push({
          lx: hx,
          ly: layer * h,
          lz: 0,
          sx: 2,
          sz: 2,
          color: (layer + i) % 2 === 0 ? BRICK_PALETTE.darkGreen : BRICK_PALETTE.brightGreen,
        });
      });
    }

    // Little flowers on top of the hedge
    [-1.0, 0, 1.0].forEach((hx, i) => {
      bricks.push({
        lx: hx,
        ly: 3 * h,
        lz: 0,
        sx: 1,
        sz: 1,
        color: i === 1 ? BRICK_PALETTE.brightYellow : BRICK_PALETTE.magenta,
        opts: { isRound: true, isPlate: true },
      });
    });

    this._registerProp({
      name: 'Clipped Brick Hedge',
      category: 'Hedge',
      x,
      z,
      rotationY,
      radius: 1.6,
      height: 3.5 * h,
      maxHp: 1,
      studCount: 6,
      bricks,
    });
  }

  createToadstoolPatch(x, z) {
    const bricks = [];
    const h = BRICK_HEIGHT;

    const mushrooms = [
      { ox: -0.6, oz: -0.3, tall: 2, capColor: BRICK_PALETTE.red },
      { ox: 0.6, oz: 0.4, tall: 3, capColor: BRICK_PALETTE.red },
      { ox: 0.1, oz: -0.6, tall: 2, capColor: BRICK_PALETTE.orange },
    ];

    mushrooms.forEach((m) => {
      for (let i = 0; i < m.tall; i++) {
        bricks.push({
          lx: m.ox,
          ly: i * h,
          lz: m.oz,
          sx: 1,
          sz: 1,
          color: BRICK_PALETTE.tan,
          opts: { isRound: true },
        });
      }
      bricks.push({
        lx: m.ox,
        ly: m.tall * h,
        lz: m.oz,
        sx: 2,
        sz: 2,
        color: m.capColor,
      });
      bricks.push({
        lx: m.ox,
        ly: (m.tall + 1) * h,
        lz: m.oz,
        sx: 1,
        sz: 1,
        color: BRICK_PALETTE.white,
        opts: { isPlate: true, isRound: true },
      });
    });

    this._registerProp({
      name: 'Brick Toadstool Patch',
      category: 'Flowers',
      x,
      z,
      radius: 1.25,
      height: 4 * h,
      maxHp: 1,
      studCount: 6,
      bricks,
    });
  }

  /**
   * Animates fountain water droplets and any hit-wobbling structures.
   */
  update(dt, elapsed) {
    // 1. Animate fountain water brick droplets arcing out of intact fountains
    for (const drop of this.waterDroplets) {
      if (drop.prop.smashed) {
        drop.mesh.visible = false;
        continue;
      }
      drop.mesh.visible = true;
      const t = (elapsed * 1.45 + drop.phase) % 1;
      const arcRadius = t * drop.spreadRadius;
      const wx = drop.prop.x + Math.cos(drop.angle + elapsed * 0.4) * arcRadius;
      const wz = drop.prop.z + Math.sin(drop.angle + elapsed * 0.4) * arcRadius;
      // Parabolic fountain water arc
      const wy =
        drop.spoutHeight +
        Math.sin(t * Math.PI) * 1.15 -
        t * t * (drop.spoutHeight - 0.55);

      drop.mesh.position.set(wx, wy, wz);
      drop.mesh.rotation.x = elapsed * 4;
      drop.mesh.rotation.z = elapsed * 3;
    }

    // 2. Animate wobble on props that took partial damage
    for (const prop of this.props) {
      if (prop.wobbleTime > 0 && !prop.smashed) {
        prop.wobbleTime = Math.max(0, prop.wobbleTime - dt);
        const shake = Math.sin(prop.wobbleTime * 45) * 0.12 * (prop.wobbleTime / 0.35);
        prop.group.rotation.z = shake;
        prop.group.rotation.x = shake * 0.6;
      } else {
        prop.group.rotation.z = 0;
        prop.group.rotation.x = 0;
      }
    }
  }
}
