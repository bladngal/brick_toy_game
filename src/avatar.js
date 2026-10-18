import * as THREE from 'three';
import { BRICK_PALETTE } from './brickBuilder.js';

export class BrickAvatar {
  constructor(scene, brickFactory, audio) {
    this.scene = scene;
    this.factory = brickFactory;
    this.audio = audio;

    this.root = new THREE.Group();
    this.root.position.set(0, 0, 8.5); // Start on the south garden walkway facing the grand fountain
    this.root.rotation.y = Math.PI;
    this.scene.add(this.root);

    this.bodyPivot = new THREE.Group();
    this.root.add(this.bodyPivot);

    // Movement & physics state
    this.velocity = new THREE.Vector3();
    this.moveSpeed = 9.2;
    this.jumpSpeed = 11.2;
    this.gravity = 28.0;
    this.isGrounded = true;
    this.isGroundPounding = false;

    // Attack / kick animation state
    this.kickTimer = 0;
    this.kickDuration = 0.32;
    this.kickCooldown = 0;

    // Walk animation state
    this.walkCycle = 0;
    this.stepCounter = 0;

    this._buildMinifigure();
    this._buildShockwaveRing();
  }

  _createFaceMaterial(isActionFace = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Classic yellow ABS minifigure head background
    ctx.fillStyle = '#f7d117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Front of cylinder is centered around x = 128
    ctx.fillStyle = '#181a1c';
    ctx.strokeStyle = '#181a1c';
    ctx.lineCap = 'round';

    // Left & Right Eyes
    ctx.beginPath();
    ctx.arc(108, 52, 7.5, 0, Math.PI * 2);
    ctx.arc(148, 52, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // White eye catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(105.5, 49.5, 2.6, 0, Math.PI * 2);
    ctx.arc(145.5, 49.5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = '#181a1c';
    ctx.lineWidth = 4;
    if (isActionFace) {
      ctx.beginPath();
      ctx.moveTo(98, 37);
      ctx.lineTo(116, 42);
      ctx.moveTo(158, 37);
      ctx.lineTo(140, 42);
      ctx.stroke();

      // Action "O" / grin mouth
      ctx.fillStyle = '#181a1c';
      ctx.beginPath();
      ctx.roundRect(114, 70, 28, 16, 7);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(118, 72, 20, 5);
    } else {
      ctx.beginPath();
      ctx.moveTo(99, 40);
      ctx.quadraticCurveTo(108, 35, 116, 39);
      ctx.moveTo(140, 39);
      ctx.quadraticCurveTo(148, 35, 157, 40);
      ctx.stroke();

      // Cheerful classic smile
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(128, 64, 18, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Rotate UV offset so face aligns with +Z forward direction of avatar
    texture.offset.x = 0.25;
    texture.wrapS = THREE.RepeatWrapping;

    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.22,
      metalness: 0.04,
    });
  }

  _buildMinifigure() {
    const yellowMat = this.factory.getMaterial(BRICK_PALETTE.brightYellow);
    const blueMat = this.factory.getMaterial(BRICK_PALETTE.brightBlue);
    const redMat = this.factory.getMaterial(BRICK_PALETTE.red);
    const whiteMat = this.factory.getMaterial(BRICK_PALETTE.white);
    const darkMat = this.factory.getMaterial(BRICK_PALETTE.darkStone);

    // 1. LEGS (Hip pivot at y = 0.52)
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.19, 0.52, 0);
    this.bodyPivot.add(this.leftLegPivot);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.19, 0.52, 0);
    this.bodyPivot.add(this.rightLegPivot);

    const legGeo = new THREE.BoxGeometry(0.32, 0.48, 0.34);
    legGeo.translate(0, -0.24, 0);
    const footGeo = new THREE.BoxGeometry(0.33, 0.12, 0.44);
    footGeo.translate(0, -0.46, 0.05);

    const leftLegMesh = new THREE.Mesh(legGeo, blueMat);
    const leftFootMesh = new THREE.Mesh(footGeo, blueMat);
    leftLegMesh.castShadow = true;
    leftFootMesh.castShadow = true;
    this.leftLegPivot.add(leftLegMesh, leftFootMesh);

    const rightLegMesh = new THREE.Mesh(legGeo, blueMat);
    const rightFootMesh = new THREE.Mesh(footGeo, blueMat);
    rightLegMesh.castShadow = true;
    rightFootMesh.castShadow = true;
    this.rightLegPivot.add(rightLegMesh, rightFootMesh);

    // Hip waist brick
    const hipMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.14, 0.36),
      darkMat
    );
    hipMesh.position.set(0, 0.56, 0);
    hipMesh.castShadow = true;
    this.bodyPivot.add(hipMesh);

    // 2. TORSO (y = 0.62 to 1.24)
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.62, 0);
    this.bodyPivot.add(this.torsoGroup);

    const torsoGeo = new THREE.BoxGeometry(0.76, 0.62, 0.4);
    torsoGeo.translate(0, 0.31, 0);
    const torsoMesh = new THREE.Mesh(torsoGeo, redMat);
    torsoMesh.castShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Overalls bib & golden brick badge on chest
    const bibMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.38, 0.42),
      blueMat
    );
    bibMesh.position.set(0, 0.22, 0);
    this.torsoGroup.add(bibMesh);

    const pocketStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12),
      this.factory.getMaterial(BRICK_PALETTE.brightYellow)
    );
    pocketStud.rotation.x = Math.PI * 0.5;
    pocketStud.position.set(0, 0.28, 0.22);
    this.torsoGroup.add(pocketStud);

    // 3. ARMS (Shoulder pivots attached to torso)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.48, 0.54, 0);
    this.torsoGroup.add(this.leftArmPivot);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.48, 0.54, 0);
    this.torsoGroup.add(this.rightArmPivot);

    const armGeo = new THREE.CylinderGeometry(0.11, 0.12, 0.44, 10);
    armGeo.translate(0, -0.18, 0);
    const handGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.14, 10);
    handGeo.translate(0, -0.44, 0);

    const leftArm = new THREE.Mesh(armGeo, redMat);
    const leftHand = new THREE.Mesh(handGeo, yellowMat);
    leftArm.castShadow = true;
    leftHand.castShadow = true;
    this.leftArmPivot.add(leftArm, leftHand);

    const rightArm = new THREE.Mesh(armGeo, redMat);
    const rightHand = new THREE.Mesh(handGeo, yellowMat);
    rightArm.castShadow = true;
    rightHand.castShadow = true;
    this.rightArmPivot.add(rightArm, rightHand);

    // 4. HEAD (Neck at y = 0.62 on torso)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.64, 0);
    this.torsoGroup.add(this.headGroup);

    this.normalFaceMat = this._createFaceMaterial(false);
    this.actionFaceMat = this._createFaceMaterial(true);

    const headGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.44, 20);
    headGeo.translate(0, 0.22, 0);
    this.headMesh = new THREE.Mesh(headGeo, [
      this.normalFaceMat,
      yellowMat,
      yellowMat,
    ]);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Top head stud + cute red & white brick cap
    const headStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.09, 14),
      yellowMat
    );
    headStud.position.set(0, 0.48, 0);
    this.headGroup.add(headStud);

    const capCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.14, 16),
      redMat
    );
    capCrown.position.set(0, 0.49, 0);
    capCrown.castShadow = true;
    this.headGroup.add(capCrown);

    const capVisor = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.06, 0.26),
      whiteMat
    );
    capVisor.position.set(0, 0.44, 0.24);
    capVisor.castShadow = true;
    this.headGroup.add(capVisor);

    const capButtonStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12),
      whiteMat
    );
    capButtonStud.position.set(0, 0.58, 0);
    this.headGroup.add(capButtonStud);
  }

  _buildShockwaveRing() {
    const ringGeo = new THREE.RingGeometry(0.4, 0.72, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: BRICK_PALETTE.brightYellow,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.shockwaveMesh = new THREE.Mesh(ringGeo, this.shockwaveMat);
    this.shockwaveMesh.position.y = 0.08;
    this.scene.add(this.shockwaveMesh);
    this.shockwaveTimer = 0;
  }

  triggerShockwave(colorHex = BRICK_PALETTE.brightYellow, maxScale = 3.8) {
    this.shockwaveMat.color.setHex(colorHex);
    this.shockwaveMesh.position.set(this.root.position.x, 0.08, this.root.position.z);
    this.shockwaveMesh.scale.setScalar(0.5);
    this.shockwaveTimer = 0.28;
    this.shockwaveMaxScale = maxScale;
  }

  jump() {
    if (this.isGrounded) {
      this.velocity.y = this.jumpSpeed;
      this.isGrounded = false;
      this.isGroundPounding = false;
      this.audio.playJump();
      return 'jump';
    } else if (!this.isGroundPounding && this.velocity.y < 6.0) {
      // Mid-air press triggers a fast Ground-Pound Stomp!
      this.isGroundPounding = true;
      this.velocity.y = -22.0;
      this.audio.playKick();
      return 'groundpound';
    }
    return null;
  }

  kick() {
    if (this.kickCooldown > 0) return false;
    this.kickTimer = this.kickDuration;
    this.kickCooldown = 0.26;
    this.headMesh.material[0] = this.actionFaceMat;

    if (!this.isGrounded && !this.isGroundPounding) {
      // Air-kick turns into a spinning stomp!
      this.isGroundPounding = true;
      this.velocity.y = -21.0;
    }

    this.audio.playKick();
    this.triggerShockwave(BRICK_PALETTE.orange, 3.4);
    return true;
  }

  update(dt, moveDirVector) {
    if (this.kickCooldown > 0) {
      this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    }

    // Update shockwave ring visual
    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt);
      const progress = 1 - this.shockwaveTimer / 0.28;
      const scale = 0.6 + progress * (this.shockwaveMaxScale || 3.5);
      this.shockwaveMesh.scale.setScalar(scale);
      this.shockwaveMat.opacity = (1 - progress) * 0.85;
    } else {
      this.shockwaveMat.opacity = 0;
    }

    // Horizontal movement
    const isMoving = moveDirVector.lengthSq() > 0.001;
    if (isMoving) {
      this.velocity.x = moveDirVector.x * this.moveSpeed;
      this.velocity.z = moveDirVector.z * this.moveSpeed;

      // Smoothly rotate minifigure toward movement direction
      const targetAngle = Math.atan2(moveDirVector.x, moveDirVector.z);
      let diff = targetAngle - this.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.root.rotation.y += diff * Math.min(1, dt * 14);
    } else {
      this.velocity.x *= Math.pow(0.001, dt);
      this.velocity.z *= Math.pow(0.001, dt);
    }

    // Apply horizontal velocity and clamp within garden boundary
    this.root.position.x = THREE.MathUtils.clamp(
      this.root.position.x + this.velocity.x * dt,
      -26.2,
      26.2
    );
    this.root.position.z = THREE.MathUtils.clamp(
      this.root.position.z + this.velocity.z * dt,
      -26.2,
      26.2
    );

    // Vertical physics (Jump & Gravity)
    let justLanded = false;
    let landedFromPound = false;

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
      this.root.position.y += this.velocity.y * dt;

      if (this.root.position.y <= 0) {
        this.root.position.y = 0;
        this.velocity.y = 0;
        this.isGrounded = true;
        justLanded = true;
        landedFromPound = this.isGroundPounding;
        this.isGroundPounding = false;
        this.headMesh.material[0] = this.normalFaceMat;
      }
    }

    // Limb & body procedural animation
    if (this.kickTimer > 0) {
      this.kickTimer = Math.max(0, this.kickTimer - dt);
      const t = 1 - this.kickTimer / this.kickDuration;
      // Energetic roundhouse spin + high kick!
      this.bodyPivot.rotation.y = t * Math.PI * 2;
      this.rightLegPivot.rotation.x = -Math.sin(t * Math.PI) * 1.45;
      this.leftLegPivot.rotation.x = Math.sin(t * Math.PI) * 0.35;
      this.rightArmPivot.rotation.x = -Math.sin(t * Math.PI) * 1.6;
      this.leftArmPivot.rotation.x = Math.sin(t * Math.PI) * 1.1;
      this.torsoGroup.rotation.x = -Math.sin(t * Math.PI) * 0.22;

      if (this.kickTimer === 0) {
        this.bodyPivot.rotation.y = 0;
        this.torsoGroup.rotation.x = 0;
        this.headMesh.material[0] = this.normalFaceMat;
      }
    } else if (!this.isGrounded) {
      // Mid-air jump or ground-pound pose
      if (this.isGroundPounding) {
        this.bodyPivot.rotation.x += dt * 18;
      } else {
        this.bodyPivot.rotation.x = 0;
      }
      this.leftLegPivot.rotation.x = -0.55;
      this.rightLegPivot.rotation.x = 0.45;
      this.leftArmPivot.rotation.x = -2.2;
      this.rightArmPivot.rotation.x = -2.2;
    } else if (isMoving) {
      this.bodyPivot.rotation.x = 0;
      this.bodyPivot.rotation.y = 0;
      const prevCycle = this.walkCycle;
      this.walkCycle += dt * 13.5;

      // Trigger plastic footstep tap every half-cycle
      if (Math.floor(this.walkCycle / Math.PI) !== Math.floor(prevCycle / Math.PI)) {
        this.stepCounter++;
        this.audio.playFootstep(this.stepCounter);
      }

      const swing = Math.sin(this.walkCycle) * 0.78;
      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftArmPivot.rotation.x = -swing * 0.85;
      this.rightArmPivot.rotation.x = swing * 0.85;
      this.bodyPivot.position.y = Math.abs(Math.sin(this.walkCycle)) * 0.09;
      this.headGroup.rotation.z = Math.sin(this.walkCycle) * 0.05;
    } else {
      // Idle breathing & reset pose
      this.bodyPivot.rotation.x = 0;
      this.bodyPivot.rotation.y = 0;
      this.bodyPivot.position.y = 0;
      this.leftLegPivot.rotation.x *= 0.8;
      this.rightLegPivot.rotation.x *= 0.8;
      this.leftArmPivot.rotation.x *= 0.8;
      this.rightArmPivot.rotation.x *= 0.8;
      this.headGroup.rotation.z = 0;
    }

    return { justLanded, landedFromPound };
  }
}
