import * as THREE from 'three';
import { BrickAudio } from './audio.js';
import { BrickFactory, BRICK_PALETTE } from './brickBuilder.js';
import { GardenWorld } from './gardenWorld.js';
import { BrickAvatar } from './avatar.js';

class BrickGardenGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.audio = new BrickAudio();
    this.brickFactory = new BrickFactory();

    // Game stats
    this.studScore = 0;
    this.displayedScore = 0;
    this.studsCollected = 0;
    this.trueBuilderGoal = 15000;
    this.trueBuilderAchieved = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.autoRebuild = false;
    this.autoRebuildDelay = 12.0; // seconds

    // Physics lists
    this.looseBricks = []; // Detached bricks from smashed props
    this.rebuildingBricks = []; // Bricks currently flying back to their prop
    this.collectibleStuds = []; // Bouncing/spinning studs to pick up

    // Camera state
    this.cameraYaw = 0;
    this.cameraPitch = 0.31;
    this.cameraDistance = 12.5;
    this.cameraShake = 0;
    this.isDraggingCamera = false;
    this.lastPointer = { x: 0, y: 0 };
    this.pointerDownPos = { x: 0, y: 0 };

    // Input state
    this.keys = new Set();

    this._initThree();
    this.world = new GardenWorld(this.scene, this.brickFactory);
    this.avatar = new BrickAvatar(this.scene, this.brickFactory, this.audio);

    this._bindEvents();
    this._setupDialogFallback();
    this._updateHUD(true);

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd3fe);
    this.scene.fog = new THREE.FogExp2(0x8fd3fe, 0.0065);

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      180
    );

    // Warm cheerful sunlight + sky hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3b7d3b, 0.85);
    hemiLight.position.set(0, 30, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff7e8, 1.65);
    dirLight.position.set(22, 34, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 2;
    dirLight.shadow.camera.far = 90;
    const d = 30;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Decorative floating toy brick clouds in the sky (purely visual, non-smashable)
    this._buildBrickClouds();
  }

  _buildBrickClouds() {
    // 3 distinct multi-layered brick cloud blueprints (with lightStone base plates + white brick puffs)
    const blueprints = [
      // Blueprint 0: Classic wide cumulus brick cloud
      [
        { sx: 6, sz: 2, lx: 0, ly: 0, lz: 0, color: BRICK_PALETTE.lightStone, opts: { isPlate: true } },
        { sx: 4, sz: 2, lx: -0.5, ly: 0.15, lz: 0.5, color: BRICK_PALETTE.white },
        { sx: 6, sz: 3, lx: 0, ly: 0.15, lz: -0.25, color: BRICK_PALETTE.white },
        { sx: 4, sz: 2, lx: 0.75, ly: 0.15, lz: 0.5, color: BRICK_PALETTE.white },
        { sx: 4, sz: 2, lx: -0.25, ly: 0.6, lz: 0, color: BRICK_PALETTE.white },
        { sx: 3, sz: 2, lx: 0.75, ly: 0.6, lz: -0.25, color: BRICK_PALETTE.white },
        { sx: 2, sz: 2, lx: 0, ly: 1.05, lz: 0, color: BRICK_PALETTE.white },
      ],
      // Blueprint 1: Double-peak puffy brick cloud
      [
        { sx: 5, sz: 2, lx: 0, ly: 0, lz: 0, color: BRICK_PALETTE.lightStone, opts: { isPlate: true } },
        { sx: 5, sz: 3, lx: 0, ly: 0.15, lz: 0, color: BRICK_PALETTE.white },
        { sx: 3, sz: 2, lx: -1.25, ly: 0.15, lz: 0.25, color: BRICK_PALETTE.white },
        { sx: 3, sz: 2, lx: 1.25, ly: 0.15, lz: -0.25, color: BRICK_PALETTE.white },
        { sx: 3, sz: 2, lx: -0.6, ly: 0.6, lz: 0, color: BRICK_PALETTE.white },
        { sx: 2, sz: 2, lx: 0.85, ly: 0.6, lz: 0.15, color: BRICK_PALETTE.white },
        { sx: 2, sz: 2, lx: -0.5, ly: 1.05, lz: 0, color: BRICK_PALETTE.white },
      ],
      // Blueprint 2: Compact cluster cloud with trailing pufflet
      [
        { sx: 4, sz: 2, lx: -0.25, ly: 0, lz: 0, color: BRICK_PALETTE.lightStone, opts: { isPlate: true } },
        { sx: 4, sz: 3, lx: -0.25, ly: 0.15, lz: 0, color: BRICK_PALETTE.white },
        { sx: 2, sz: 2, lx: -0.25, ly: 0.6, lz: 0, color: BRICK_PALETTE.white },
        // Little companion puff next to main cloud
        { sx: 2, sz: 2, lx: 1.85, ly: 0.2, lz: 0.35, color: BRICK_PALETTE.white },
        { sx: 1, sz: 2, lx: 1.85, ly: 0.65, lz: 0.35, color: BRICK_PALETTE.white },
      ],
    ];

    // Placed at visible sky altitudes (y = 6.2 to 11.2) across the garden & horizon
    const cloudConfigs = [
      { x: -12, y: 7.4, z: -16, scale: 1.15, bp: 0, ry: 0.12, speed: 0.55 },
      { x: 10, y: 8.1, z: -19, scale: 1.25, bp: 1, ry: -0.18, speed: 0.42 },
      { x: 0, y: 9.2, z: -26, scale: 1.4, bp: 0, ry: 0.05, speed: 0.38 },
      { x: -24, y: 8.5, z: -24, scale: 1.3, bp: 2, ry: 0.25, speed: 0.48 },
      { x: 23, y: 7.8, z: -12, scale: 1.1, bp: 2, ry: -0.22, speed: 0.62 },
      { x: -19, y: 6.8, z: -5, scale: 1.0, bp: 1, ry: 0.35, speed: 0.52 },
      { x: 16, y: 7.2, z: -3, scale: 1.05, bp: 0, ry: -0.15, speed: 0.46 },
      { x: -8, y: 7.9, z: 6, scale: 1.08, bp: 2, ry: 0.08, speed: 0.58 },
      { x: 14, y: 8.4, z: 12, scale: 1.2, bp: 1, ry: -0.3, speed: 0.44 },
      { x: -18, y: 7.6, z: 17, scale: 1.15, bp: 0, ry: 0.2, speed: 0.5 },
      { x: 4, y: 8.8, z: 22, scale: 1.3, bp: 1, ry: -0.1, speed: 0.4 },
      { x: -28, y: 9.4, z: 4, scale: 1.35, bp: 0, ry: 0.4, speed: 0.36 },
      { x: 28, y: 9.0, z: -22, scale: 1.3, bp: 2, ry: -0.35, speed: 0.5 },
      { x: 0, y: 10.4, z: -8, scale: 1.2, bp: 1, ry: 0.0, speed: 0.47 },
    ];

    this.clouds = [];
    cloudConfigs.forEach((cfg, idx) => {
      const cloudGroup = new THREE.Group();
      const parts = blueprints[cfg.bp % blueprints.length];

      parts.forEach((b) => {
        const brick = this.brickFactory.createBrick(b.sx, b.sz, b.color, b.opts || {});
        brick.position.set(b.lx, b.ly, b.lz);
        // Disable ground shadow casting so low sky clouds stay bright and airy without darkening the garden
        brick.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = true;
          }
        });
        cloudGroup.add(brick);
      });

      cloudGroup.position.set(cfg.x, cfg.y, cfg.z);
      cloudGroup.rotation.y = cfg.ry;
      cloudGroup.scale.setScalar(cfg.scale);
      this.scene.add(cloudGroup);

      this.clouds.push({
        group: cloudGroup,
        baseY: cfg.y,
        speed: cfg.speed,
        bobSpeed: 0.7 + (idx % 5) * 0.18,
        bobPhase: idx * 1.3,
      });
    });
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      // Ignore shortcuts if modal dialog is open and Esc isn't pressed
      const dialog = document.getElementById('help-dialog');
      if (dialog && dialog.open && e.code !== 'Escape') return;

      this.audio.init();
      this.keys.add(e.code);

      if (e.code === 'Space') {
        e.preventDefault();
        const action = this.avatar.jump();
        if (action === 'groundpound') {
          this._showToast('GROUND POUND!', '#f47b20');
        }
      } else if (
        e.code === 'KeyF' ||
        e.code === 'KeyE' ||
        e.code === 'KeyJ' ||
        e.code === 'Enter'
      ) {
        e.preventDefault();
        this._performKickAttack();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        this.rebuildAllProps();
      } else if (e.code === 'KeyM') {
        this._toggleAudio();
      } else if (e.code === 'KeyH' || e.code === 'Slash') {
        if (dialog && !dialog.open) dialog.showModal();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    // Pointer controls on canvas: click to kick/smash, drag to orbit camera
    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.init();
      this.isDraggingCamera = true;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;
      this.pointerDownPos.x = e.clientX;
      this.pointerDownPos.y = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDraggingCamera) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer.x = e.clientX;
      this.lastPointer.y = e.clientY;

      this.cameraYaw -= dx * 0.0065;
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch + dy * 0.005,
        0.06,
        1.15
      );
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDraggingCamera) return;
      this.isDraggingCamera = false;
      const moveDist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y
      );
      // Quick click/tap without dragging triggers a Brick Kick / Smash!
      if (moveDist < 8 && e.button === 0) {
        this._performKickAttack();
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.cameraDistance = THREE.MathUtils.clamp(
          this.cameraDistance + e.deltaY * 0.01,
          6.0,
          24.0
        );
      },
      { passive: false }
    );

    // HUD buttons
    document.getElementById('btn-kick')?.addEventListener('click', () => {
      this.audio.init();
      this._performKickAttack();
    });

    document.getElementById('btn-jump')?.addEventListener('click', () => {
      this.audio.init();
      this.avatar.jump();
    });

    document.getElementById('btn-rebuild')?.addEventListener('click', () => {
      this.audio.init();
      this.rebuildAllProps();
    });

    document.getElementById('btn-auto-rebuild')?.addEventListener('click', (e) => {
      this.autoRebuild = !this.autoRebuild;
      const btn = e.currentTarget;
      btn.setAttribute('aria-pressed', String(this.autoRebuild));
      btn.querySelector('.btn-label').textContent = this.autoRebuild
        ? 'Auto-Rebuild: ON'
        : 'Auto-Rebuild: OFF';
      this._showToast(
        this.autoRebuild
          ? 'Auto-Rebuild enabled (rebuilds after 12s)'
          : 'Auto-Rebuild disabled',
        '#26b7d9'
      );
    });

    document.getElementById('btn-audio')?.addEventListener('click', () => {
      this._toggleAudio();
    });

    document.getElementById('btn-help')?.addEventListener('click', () => {
      const dialog = document.getElementById('help-dialog');
      if (dialog) dialog.showModal();
    });
  }

  _setupDialogFallback() {
    const dialog = document.getElementById('help-dialog');
    if (!dialog) return;

    // Fallback for browsers without closedby support (e.g., Safari)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    }
  }

  _toggleAudio() {
    const enabled = this.audio.toggle();
    const btn = document.getElementById('btn-audio');
    if (btn) {
      btn.setAttribute('aria-pressed', String(enabled));
      btn.querySelector('.btn-label').textContent = enabled ? 'Sound: ON' : 'Sound: Muted';
    }
  }

  _performKickAttack() {
    const didKick = this.avatar.kick();
    if (!didKick) return;

    // Check all intact props within kick/spin reach of the avatar
    const avatarPos = this.avatar.root.position;
    const forward = new THREE.Vector3(
      Math.sin(this.avatar.root.rotation.y),
      0,
      Math.cos(this.avatar.root.rotation.y)
    );

    let hitAny = false;
    for (const prop of this.world.props) {
      if (prop.smashed) continue;
      const dx = prop.x - avatarPos.x;
      const dz = prop.z - avatarPos.z;
      const dist = Math.hypot(dx, dz);

      // Generous radial + forward reach so kicking feels snappy and rewarding
      const toProp = new THREE.Vector3(dx, 0, dz).normalize();
      const dot = forward.dot(toProp);
      const effectiveReach = dot > 0.15 ? prop.radius + 2.35 : prop.radius + 1.55;

      if (dist <= effectiveReach) {
        this._damageProp(prop, 1, avatarPos, false);
        hitAny = true;
      }
    }

    // Also kick any loose bricks near the avatar so they fly dramatically!
    for (const lb of this.looseBricks) {
      const dx = lb.mesh.position.x - avatarPos.x;
      const dz = lb.mesh.position.z - avatarPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2.8) {
        const dirX = dist > 0.01 ? dx / dist : Math.random() - 0.5;
        const dirZ = dist > 0.01 ? dz / dist : Math.random() - 0.5;
        lb.vel.set(
          dirX * (6 + Math.random() * 6),
          4.5 + Math.random() * 4.5,
          dirZ * (6 + Math.random() * 6)
        );
        lb.angVel.set(
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16,
          (Math.random() - 0.5) * 16
        );
        lb.sleeping = false;
        this.audio.playBounceClatter(0.8);
      }
    }

    if (hitAny) {
      this.cameraShake = Math.max(this.cameraShake, 0.22);
    }
  }

  _damageProp(prop, damageAmount, impactOrigin, isStomp = false) {
    if (prop.smashed) return;

    prop.hp -= damageAmount;
    if (prop.hp <= 0 || isStomp) {
      this._smashPropCompletely(prop, impactOrigin, isStomp);
    } else {
      // Partial hit: wobble the structure and pop off 30% of its top bricks!
      prop.wobbleTime = 0.35;
      const candidates = prop.brickEntries.filter((b) => !b.detached);
      const shedCount = Math.max(2, Math.floor(candidates.length * 0.3));
      // Detach from top down
      candidates
        .slice(-shedCount)
        .forEach((entry) => this._detachBrickEntry(prop, entry, impactOrigin, 0.85));

      this.audio.playSmash(shedCount, prop.isFountain);
      this._spawnCollectibleStuds(prop.x, prop.height * 0.6, prop.z, 3);
      this._showToast(`Cracked ${prop.name}! Hit again!`, '#f7d117');
    }
  }

  _smashPropCompletely(prop, impactOrigin, isStomp = false) {
    prop.smashed = true;
    prop.smashedAt = this.elapsed;
    prop.hp = 0;

    let detachedCount = 0;
    for (const entry of prop.brickEntries) {
      if (!entry.detached) {
        this._detachBrickEntry(prop, entry, impactOrigin, isStomp ? 1.35 : 1.05);
        detachedCount++;
      }
    }

    this.audio.playSmash(detachedCount, prop.isFountain);
    this.cameraShake = Math.max(this.cameraShake, isStomp ? 0.42 : 0.28);

    // Combo tracking
    this.comboCount = this.comboTimer > 0 ? this.comboCount + 1 : 1;
    this.comboTimer = 4.0;

    // Spawn a shower of collectible studs!
    this._spawnCollectibleStuds(
      prop.x,
      Math.min(1.6, prop.height * 0.5),
      prop.z,
      prop.studCount
    );

    const verb = isStomp ? 'STOMP-SMASHED' : 'SMASHED';
    const comboText = this.comboCount > 1 ? ` (${this.comboCount}x COMBO!)` : '';
    this._showToast(
      `${verb} ${prop.name} into ${ prop.brickEntries.length } bricks!${comboText}`,
      prop.isFountain ? '#4fd2ff' : '#f7d117'
    );

    this._updateHUD();
  }

  _detachBrickEntry(prop, entry, impactOrigin, forceMultiplier = 1.0) {
    entry.detached = true;

    // Compute world transform before detaching from prop.group
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    entry.mesh.getWorldPosition(worldPos);
    entry.mesh.getWorldQuaternion(worldQuat);

    this.scene.add(entry.mesh);
    entry.mesh.position.copy(worldPos);
    entry.mesh.quaternion.copy(worldQuat);

    // Outward blast vector from impact origin + prop center
    const dx = worldPos.x - (impactOrigin.x * 0.4 + prop.x * 0.6);
    const dz = worldPos.z - (impactOrigin.z * 0.4 + prop.z * 0.6);
    const dist = Math.hypot(dx, dz) || 0.1;
    const nx = dx / dist + (Math.random() - 0.5) * 0.55;
    const nz = dz / dist + (Math.random() - 0.5) * 0.55;

    const speed = (3.5 + Math.random() * 6.5) * forceMultiplier;
    const upSpeed = (5.0 + Math.random() * 6.8 + worldPos.y * 0.8) * forceMultiplier;

    this.looseBricks.push({
      mesh: entry.mesh,
      entry,
      prop,
      vel: new THREE.Vector3(nx * speed, upSpeed, nz * speed),
      angVel: new THREE.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14
      ),
      bounces: 0,
      sleeping: false,
    });
  }

  _spawnCollectibleStuds(x, y, z, count) {
    for (let i = 0; i < count; i++) {
      // Determine stud tier (Silver = 10, Gold = 100, Blue = 1000, rare Purple = 10000)
      const roll = Math.random();
      let tier = 1;
      if (roll > 0.96) tier = 4;
      else if (roll > 0.78) tier = 3;
      else if (roll > 0.35) tier = 2;

      const studMesh = this.brickFactory.createCollectibleStud(tier);
      studMesh.position.set(
        x + (Math.random() - 0.5) * 0.8,
        Math.max(0.35, y + Math.random() * 0.6),
        z + (Math.random() - 0.5) * 0.8
      );
      this.scene.add(studMesh);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const horizSpeed = 2.4 + Math.random() * 4.2;

      this.collectibleStuds.push({
        mesh: studMesh,
        tier,
        value: studMesh.userData.value,
        vel: new THREE.Vector3(
          Math.cos(angle) * horizSpeed,
          5.5 + Math.random() * 4.5,
          Math.sin(angle) * horizSpeed
        ),
        age: 0,
      });
    }
  }

  rebuildProp(prop) {
    if (!prop.smashed && prop.hp === prop.maxHp) return false;

    prop.smashed = false;
    prop.hp = prop.maxHp;

    // Pull all detached bricks belonging to this prop back into place
    for (let i = this.looseBricks.length - 1; i >= 0; i--) {
      const lb = this.looseBricks[i];
      if (lb.prop === prop) {
        this.looseBricks.splice(i, 1);

        // Compute target world position & quaternion
        const targetWorldPos = lb.entry.localPos
          .clone()
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotationY)
          .add(new THREE.Vector3(prop.x, 0, prop.z));

        const targetQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          prop.rotationY + lb.entry.localRotY
        );

        this.rebuildingBricks.push({
          mesh: lb.mesh,
          entry: lb.entry,
          prop,
          startPos: lb.mesh.position.clone(),
          startQuat: lb.mesh.quaternion.clone(),
          targetPos: targetWorldPos,
          targetQuat,
          progress: 0,
          duration: 0.45 + Math.random() * 0.35,
          swirlPhase: Math.random() * Math.PI * 2,
        });
      }
    }

    return true;
  }

  rebuildAllProps() {
    let rebuiltCount = 0;
    for (const prop of this.world.props) {
      if (this.rebuildProp(prop)) {
        rebuiltCount++;
      }
    }

    if (rebuiltCount > 0) {
      this.audio.playRebuild();
      this._showToast(
        `Rebuilding ${rebuiltCount} brick structure${rebuiltCount > 1 ? 's' : ''}!`,
        '#7ac72c'
      );
      this._updateHUD();
    } else {
      this._showToast('All garden structures are already intact!', '#dce1e7');
    }
  }

  _showToast(message, accentColor = '#f7d117') {
    const toast = document.getElementById('action-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = accentColor;
    toast.classList.add('visible');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2200);
  }

  _updateHUD(force = false) {
    const intactCount = this.world.props.filter((p) => !p.smashed).length;
    const totalCount = this.world.props.length;
    const smashedCount = totalCount - intactCount;

    const intactEl = document.getElementById('intact-counter');
    if (intactEl) {
      intactEl.textContent = `${smashedCount} / ${totalCount} Smashed`;
    }

    const looseEl = document.getElementById('loose-bricks-counter');
    if (looseEl) {
      looseEl.textContent = `${this.looseBricks.length} Loose Bricks`;
    }

    const progressPct = Math.min(100, (this.studScore / this.trueBuilderGoal) * 100);
    const barFill = document.getElementById('true-builder-fill');
    if (barFill) {
      barFill.style.width = `${progressPct.toFixed(1)}%`;
    }

    const rankLabel = document.getElementById('builder-rank');
    if (rankLabel) {
      if (progressPct >= 100) {
        rankLabel.textContent = 'TRUE BRICK SMASHER!';
        rankLabel.classList.add('complete');
        if (!this.trueBuilderAchieved) {
          this.trueBuilderAchieved = true;
          this._showToast('RANK UNLOCKED: TRUE BRICK SMASHER!', '#ffcf26');
        }
      } else {
        rankLabel.textContent = `True Smasher (${Math.floor(progressPct)}%)`;
      }
    }

    if (force) {
      const scoreEl = document.getElementById('stud-score');
      if (scoreEl) scoreEl.textContent = this.studScore.toLocaleString();
    }
  }

  _getMoveInputVector() {
    let rawX = 0;
    let rawZ = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) rawZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) rawZ += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) rawX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) rawX += 1;

    const vec = new THREE.Vector3(rawX, 0, rawZ);
    if (vec.lengthSq() > 0) {
      vec.normalize();
      // Rotate movement relative to camera yaw
      vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
    }
    return vec;
  }

  _updateAvatarAndCollisions(dt) {
    // Allow Q / E or Left/Right brackets for smooth keyboard camera orbit
    if (this.keys.has('KeyQ')) this.cameraYaw += dt * 1.8;

    const moveVec = this._getMoveInputVector();
    const prevY = this.avatar.root.position.y;
    const { justLanded, landedFromPound } = this.avatar.update(dt, moveVec);

    const avatarPos = this.avatar.root.position;
    let minFountainDist = 999;
    let anyFountainIntact = false;

    for (const prop of this.world.props) {
      if (prop.smashed) {
        // Optional auto-rebuild timer check
        if (this.autoRebuild && this.elapsed - prop.smashedAt >= this.autoRebuildDelay) {
          if (this.rebuildProp(prop)) {
            this.audio.playRebuild();
            this._updateHUD();
          }
        }
        continue;
      }

      const dx = avatarPos.x - prop.x;
      const dz = avatarPos.z - prop.z;
      const horizDist = Math.hypot(dx, dz);

      if (prop.isFountain) {
        anyFountainIntact = true;
        minFountainDist = Math.min(minFountainDist, horizDist);
      }

      // 1. Check Jump-On / Stomp Smash!
      // If the avatar lands near/on the prop, OR is descending onto the prop from a jump:
      const stompRadius = landedFromPound ? prop.radius + 2.2 : prop.radius + 0.75;
      const isDescendingOntoProp =
        !this.avatar.isGrounded &&
        this.avatar.velocity.y < -1.0 &&
        avatarPos.y <= prop.height + 0.4 &&
        horizDist < prop.radius + 0.55;

      if (isDescendingOntoProp || (justLanded && horizDist < stompRadius)) {
        this._damageProp(prop, prop.maxHp, avatarPos, true);
        this.avatar.triggerShockwave(BRICK_PALETTE.brightYellow, landedFromPound ? 4.8 : 3.2);
        // Little celebratory bounce when stomping an object in mid-air!
        if (isDescendingOntoProp && !landedFromPound) {
          this.avatar.velocity.y = 7.8;
        }
        continue;
      }

      // 2. Check horizontal collision / running into props
      const minSep = prop.radius + 0.42;
      if (horizDist < minSep && avatarPos.y < prop.height) {
        // Delicate props (Flowers / Toadstools) smash immediately when you sprint right through them!
        if (prop.category === 'Flowers' && moveVec.lengthSq() > 0.1) {
          this._damageProp(prop, 1, avatarPos, false);
          continue;
        }

        // Solid props (Trees, Benches, Fountains, Lamps, Archways): push avatar out or smash if kicking
        if (this.avatar.kickTimer > 0) {
          this._damageProp(prop, 1, avatarPos, false);
          continue;
        }

        const nx = horizDist > 0.001 ? dx / horizDist : 0;
        const nz = horizDist > 0.001 ? dz / horizDist : 1;
        avatarPos.x = prop.x + nx * minSep;
        avatarPos.z = prop.z + nz * minSep;
      }
    }

    this.audio.updateWaterProximity(minFountainDist, anyFountainIntact);
  }

  _updateLooseBricks(dt) {
    const avatarPos = this.avatar.root.position;
    const isAvatarMoving = this.avatar.velocity.lengthSq() > 0.5;

    for (const lb of this.looseBricks) {
      // Check if avatar runs through resting bricks on the ground — kick them aside!
      const dx = lb.mesh.position.x - avatarPos.x;
      const dz = lb.mesh.position.z - avatarPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 0.85 && avatarPos.y < 0.8 && isAvatarMoving) {
        const dist = Math.sqrt(distSq) || 0.1;
        lb.vel.set(
          (dx / dist) * 4.5 + this.avatar.velocity.x * 0.45,
          2.2 + Math.random() * 2.0,
          (dz / dist) * 4.5 + this.avatar.velocity.z * 0.45
        );
        lb.angVel.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
        lb.sleeping = false;
        this.audio.playBounceClatter(0.45);
      }

      if (lb.sleeping) continue;

      lb.vel.y -= 24.0 * dt;
      lb.mesh.position.addScaledVector(lb.vel, dt);

      lb.mesh.rotation.x += lb.angVel.x * dt;
      lb.mesh.rotation.y += lb.angVel.y * dt;
      lb.mesh.rotation.z += lb.angVel.z * dt;

      // Ground bounce
      if (lb.mesh.position.y <= 0.02) {
        lb.mesh.position.y = 0.02;
        if (Math.abs(lb.vel.y) > 1.6) {
          lb.vel.y = -lb.vel.y * 0.42;
          lb.vel.x *= 0.76;
          lb.vel.z *= 0.76;
          lb.angVel.multiplyScalar(0.68);
          lb.bounces++;
          if (lb.bounces <= 3) {
            this.audio.playBounceClatter(Math.min(1, Math.abs(lb.vel.y) / 6));
          }
        } else {
          lb.vel.y = 0;
          lb.vel.x *= 0.82;
          lb.vel.z *= 0.82;
          lb.angVel.multiplyScalar(0.75);
          // Snap pitch/roll flat like a resting toy brick
          lb.mesh.rotation.x *= 0.7;
          lb.mesh.rotation.z *= 0.7;

          if (lb.vel.lengthSq() < 0.05) {
            lb.sleeping = true;
            lb.mesh.rotation.x = 0;
            lb.mesh.rotation.z = 0;
          }
        }
      }
    }

    // Update bricks that are magically rebuilding into their structure
    for (let i = this.rebuildingBricks.length - 1; i >= 0; i--) {
      const rb = this.rebuildingBricks[i];
      rb.progress += dt / rb.duration;

      if (rb.progress >= 1) {
        // Re-attach cleanly to prop group
        rb.prop.group.add(rb.mesh);
        rb.mesh.position.copy(rb.entry.localPos);
        rb.mesh.rotation.set(0, rb.entry.localRotY, 0);
        rb.entry.detached = false;
        this.rebuildingBricks.splice(i, 1);
        this._updateHUD();
      } else {
        const t = rb.progress;
        // Smooth ease-in-out with an upward arc and swirl
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        rb.mesh.position.lerpVectors(rb.startPos, rb.targetPos, ease);
        rb.mesh.position.y += Math.sin(t * Math.PI) * 2.4;
        rb.mesh.position.x += Math.cos(t * Math.PI * 2 + rb.swirlPhase) * (1 - t) * 0.45;
        rb.mesh.position.z += Math.sin(t * Math.PI * 2 + rb.swirlPhase) * (1 - t) * 0.45;
        rb.mesh.quaternion.slerpQuaternions(rb.startQuat, rb.targetQuat, ease);
      }
    }
  }

  _updateCollectibleStuds(dt) {
    const avatarPos = this.avatar.root.position;
    let scoreChanged = false;

    for (let i = this.collectibleStuds.length - 1; i >= 0; i--) {
      const stud = this.collectibleStuds[i];
      stud.age += dt;
      stud.mesh.rotation.y += dt * 4.5;

      const dx = avatarPos.x - stud.mesh.position.x;
      const dy = avatarPos.y + 0.65 - stud.mesh.position.y;
      const dz = avatarPos.z - stud.mesh.position.z;
      const dist = Math.hypot(dx, dy, dz);

      // Magnetic attraction toward the avatar after a brief pop-out delay
      if (stud.age > 0.22 && dist < 4.5) {
        const pullSpeed = 14.5 + (4.5 - dist) * 3.5;
        stud.mesh.position.x += (dx / dist) * pullSpeed * dt;
        stud.mesh.position.y += (dy / dist) * pullSpeed * dt;
        stud.mesh.position.z += (dz / dist) * pullSpeed * dt;

        if (dist < 0.72) {
          // Collected!
          this.scene.remove(stud.mesh);
          this.collectibleStuds.splice(i, 1);
          const multiplier = Math.max(1, Math.min(5, this.comboCount));
          this.studScore += stud.value * multiplier;
          this.studsCollected++;
          this.audio.playStudPickup(stud.tier);
          scoreChanged = true;
          continue;
        }
      } else {
        // Normal bounce physics
        stud.vel.y -= 22.0 * dt;
        stud.mesh.position.addScaledVector(stud.vel, dt);

        if (stud.mesh.position.y <= 0.14) {
          stud.mesh.position.y = 0.14;
          if (Math.abs(stud.vel.y) > 1.2) {
            stud.vel.y = -stud.vel.y * 0.55;
            stud.vel.x *= 0.78;
            stud.vel.z *= 0.78;
          } else {
            stud.vel.set(0, 0, 0);
            // Gentle floating bob on the ground
            stud.mesh.position.y = 0.16 + Math.sin(this.elapsed * 5 + i) * 0.04;
          }
        }
      }
    }

    if (scoreChanged) {
      this._updateHUD();
    }

    // Smoothly roll the displayed stud score number
    if (this.displayedScore < this.studScore) {
      const step = Math.max(10, Math.ceil((this.studScore - this.displayedScore) * 0.22));
      this.displayedScore = Math.min(this.studScore, this.displayedScore + step);
      const scoreEl = document.getElementById('stud-score');
      if (scoreEl) scoreEl.textContent = this.displayedScore.toLocaleString();
    }
  }

  _updateCamera(dt) {
    const target = new THREE.Vector3(
      this.avatar.root.position.x,
      this.avatar.root.position.y + 1.35,
      this.avatar.root.position.z
    );

    const offsetX =
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;
    const offsetY = Math.sin(this.cameraPitch) * this.cameraDistance;
    const offsetZ =
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch) * this.cameraDistance;

    const desiredPos = new THREE.Vector3(
      target.x + offsetX,
      Math.max(1.2, target.y + offsetY),
      target.z + offsetZ
    );

    this.camera.position.lerp(desiredPos, Math.min(1, dt * 10));

    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
    }

    this.camera.lookAt(target);
  }

  _animate() {
    requestAnimationFrame(this._animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.comboCount = 0;
    }

    // Drift & gently bob brick clouds across the sky
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 36) c.group.position.x = -36;
      c.group.position.y =
        c.baseY + Math.sin(this.elapsed * c.bobSpeed + c.bobPhase) * 0.22;
    }

    this._updateAvatarAndCollisions(dt);
    this.world.update(dt, this.elapsed);
    this._updateLooseBricks(dt);
    this._updateCollectibleStuds(dt);
    this._updateCamera(dt);

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new BrickGardenGame();
});
