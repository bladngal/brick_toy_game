import * as THREE from 'three';

// Unit scale:
// 1 stud width/depth = 0.5 world units
// 1 standard brick height = 0.45 world units
// 1 plate height = 0.15 world units
export const STUD_UNIT = 0.5;
export const BRICK_HEIGHT = 0.45;
export const PLATE_HEIGHT = 0.15;

export const BRICK_PALETTE = {
  // Classic ABS Toy Brick colors
  red: 0xd92626,
  brightYellow: 0xf7d117,
  brightBlue: 0x1e66d0,
  brightGreen: 0x289e45,
  darkGreen: 0x1a6830,
  limeGreen: 0x7ac72c,
  orange: 0xf47b20,
  magenta: 0xd8348f,
   blossomPink: 0xff9ec6,
  softPink: 0xffc8dd,
  lavender: 0x9b6be6,
  cyan: 0x26b7d9,
  white: 0xf5f7fa,
  lightStone: 0xdce1e7,
  mediumStone: 0x9ea7b3,
  darkStone: 0x4c535e,
  black: 0x1f2328,
  woodBrown: 0x7c4722,
  reddishBrown: 0x5d3216,
  tan: 0xe4cd9e,
  // Translucent & Special bricks
  transLightBlue: 0x4fd2ff,
  transDarkBlue: 0x1589e8,
  transYellow: 0xffe94d,
  // Collectible Stud tiers
  studSilver: 0xd8e0e8,
  studGold: 0xffcf26,
  studBlue: 0x2a84ff,
  studPurple: 0xa63aff,
};

export class BrickFactory {
  constructor() {
    this.materialCache = new Map();
    this.geometryCache = new Map();
    this.studGeo = new THREE.CylinderGeometry(
      STUD_UNIT * 0.3,
      STUD_UNIT * 0.3,
      0.085,
      12
    );
    this.studGeo.translate(0, 0.085 / 2, 0);
  }

  getMaterial(colorHex, options = {}) {
    const key = `${colorHex}_${options.translucent ? 'T' : 'S'}_${options.metallic ? 'M' : 'P'}_${options.emissive ? 'E' : 'N'}`;
    if (this.materialCache.has(key)) {
      return this.materialCache.get(key);
    }

    let mat;
    if (options.translucent) {
      mat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: 0.12,
        metalness: 0.05,
        transmission: 0.55,
        transparent: true,
        opacity: 0.82,
        emissive: options.emissive ? colorHex : 0x000000,
        emissiveIntensity: options.emissive ? 0.45 : 0,
      });
    } else if (options.metallic) {
      mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.18,
        metalness: 0.78,
        emissive: colorHex,
        emissiveIntensity: 0.16,
      });
    } else {
      // Glossy ABS plastic finish
      mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.23,
        metalness: 0.04,
      });
    }

    this.materialCache.set(key, mat);
    return mat;
  }

  /**
   * Builds a single toy brick mesh with top studs.
   * Origin is centered in X/Z and at the bottom (y=0) of the brick.
   *
   * @param {number} studsX - Number of studs along X
   * @param {number} studsZ - Number of studs along Z
   * @param {number} colorHex - Color hex
   * @param {object} opts - { isPlate, isTile, isRound, translucent, metallic, emissive }
   */
  createBrick(studsX = 2, studsZ = 2, colorHex = BRICK_PALETTE.red, opts = {}) {
    const height = opts.isPlate || opts.isTile ? PLATE_HEIGHT : (opts.height || BRICK_HEIGHT);
    const width = studsX * STUD_UNIT;
    const depth = studsZ * STUD_UNIT;
    // Slight seam inset (0.018) so adjacent stacked bricks show crisp toy brick lines
    const gap = 0.018;

    const mat = this.getMaterial(colorHex, opts);
    const group = new THREE.Group();

    const bodyKey = `body_${studsX}_${studsZ}_${height.toFixed(3)}_${opts.isRound ? 'R' : 'B'}`;
    let bodyGeo = this.geometryCache.get(bodyKey);
    if (!bodyGeo) {
      if (opts.isRound && studsX === 1 && studsZ === 1) {
        bodyGeo = new THREE.CylinderGeometry(
          (STUD_UNIT - gap) * 0.48,
          (STUD_UNIT - gap) * 0.48,
          height - gap * 0.5,
          14
        );
        bodyGeo.translate(0, (height - gap * 0.5) / 2, 0);
      } else {
        bodyGeo = new THREE.BoxGeometry(
          width - gap,
          height - gap * 0.5,
          depth - gap
        );
        bodyGeo.translate(0, (height - gap * 0.5) / 2, 0);
      }
      this.geometryCache.set(bodyKey, bodyGeo);
    }

    const bodyMesh = new THREE.Mesh(bodyGeo, mat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Add cylindrical top studs unless it's a smooth flat tile
    if (!opts.isTile) {
      const startX = -((studsX - 1) * STUD_UNIT) / 2;
      const startZ = -((studsZ - 1) * STUD_UNIT) / 2;
      for (let ix = 0; ix < studsX; ix++) {
        for (let iz = 0; iz < studsZ; iz++) {
          const studMesh = new THREE.Mesh(this.studGeo, mat);
          studMesh.position.set(
            startX + ix * STUD_UNIT,
            height - gap * 0.5,
            startZ + iz * STUD_UNIT
          );
          studMesh.castShadow = true;
          studMesh.receiveShadow = true;
          group.add(studMesh);
        }
      }
    }

    group.userData = {
      studsX,
      studsZ,
      height,
      colorHex,
      radius: Math.max(width, depth, height) * 0.55,
    };

    return group;
  }

  /**
   * Creates a collectible shiny 1x1 round stud (Silver, Gold, Blue, or Purple)
   */
  createCollectibleStud(tier = 1) {
    let color = BRICK_PALETTE.studSilver;
    let value = 10;
    if (tier === 2) {
      color = BRICK_PALETTE.studGold;
      value = 100;
    } else if (tier === 3) {
      color = BRICK_PALETTE.studBlue;
      value = 1000;
    } else if (tier >= 4) {
      color = BRICK_PALETTE.studPurple;
      value = 10000;
    }

    const mat = this.getMaterial(color, { metallic: true });
    const group = new THREE.Group();

    const baseGeoKey = 'collectible_stud_base';
    let baseGeo = this.geometryCache.get(baseGeoKey);
    if (!baseGeo) {
      baseGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 16);
      this.geometryCache.set(baseGeoKey, baseGeo);
    }

    const topGeoKey = 'collectible_stud_top';
    let topGeo = this.geometryCache.get(topGeoKey);
    if (!topGeo) {
      topGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16);
      topGeo.translate(0, 0.1, 0);
      this.geometryCache.set(topGeoKey, topGeo);
    }

    const base = new THREE.Mesh(baseGeo, mat);
    const top = new THREE.Mesh(topGeo, mat);
    base.castShadow = true;
    top.castShadow = true;
    group.add(base);
    group.add(top);

    group.userData = {
      tier,
      value,
      color,
    };
    return group;
  }
}
