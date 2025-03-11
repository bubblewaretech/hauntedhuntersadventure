import 'phaser';

interface Character {
    sprite: Phaser.Physics.Arcade.Sprite;
    canJump: boolean;
    jumpCount: number;
    canShoot: boolean;  // Add shooting cooldown flag
}

export class GameScene extends Phaser.Scene {
    private platforms!: Phaser.Physics.Arcade.StaticGroup;
    private player!: Character;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private spikes!: Phaser.Physics.Arcade.StaticGroup;
    private ghosts!: Phaser.Physics.Arcade.Group;
    private coins!: Phaser.Physics.Arcade.StaticGroup;
    private projectiles!: Phaser.Physics.Arcade.Group;  // Add projectiles group
    private score: number = 0;
    private scoreText!: Phaser.GameObjects.Text;
    private characterType: string = 'hunter';
    private animsCreated: boolean = false;
    private playerSprite: string = '';
    private levelEndPoint!: Phaser.GameObjects.Zone;
    private levelWidth: number = 3200; // 4 times the screen width
    private levelHeight: number = 600;
    private backgroundMusic!: Phaser.Sound.BaseSound;
    private shootKey!: Phaser.Input.Keyboard.Key;  // Add shoot key

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { character: string }) {
        this.characterType = data.character;
        this.playerSprite = this.characterType === 'hunter' ? 'hunter' : 'scout';
        this.animsCreated = false;
    }

    preload() {
        // Load game assets
        this.load.image('background', 'assets/haunted-bg.png');
        this.load.image('platform', 'assets/platform.png');
        this.load.image('spike', 'assets/spike.png');
        this.load.image('coin', 'assets/coin.png');
        this.load.image('projectile', 'assets/projectile.png');  // Add projectile asset
        
        // Load spritesheets
        this.load.spritesheet(this.playerSprite, `assets/${this.playerSprite}.png`, { 
            frameWidth: 32, 
            frameHeight: 48 
        });
        this.load.spritesheet('ghost', 'assets/ghost.png', { 
            frameWidth: 32, 
            frameHeight: 32 
        });

        // Load audio
        this.load.audio('haunted-theme', 'assets/haunted-theme.webm');

        // Add load complete listener
        this.load.on('complete', () => {
            this.animsCreated = this.createPlayerAnimations();
        });
    }

    create() {
        // Start background music
        this.backgroundMusic = this.sound.add('haunted-theme', {
            volume: 0.5,
            loop: true
        });
        this.backgroundMusic?.play();

        // Set world bounds
        this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

        // Create a larger background
        const background = this.add.tileSprite(0, 0, this.levelWidth, this.levelHeight, 'background');
        background.setOrigin(0, 0);
        background.setScrollFactor(0.5); // Parallax effect

        // Create platforms group
        this.platforms = this.physics.add.staticGroup();

        // Create the ground - now extended
        for (let x = 0; x < this.levelWidth; x += 400) {
            this.platforms.create(x + 200, 580, 'platform').setScale(2).refreshBody();
        }

        // Create haunted house platforms
        this.createHauntedHousePlatforms();

        // Initialize input
        if (!this.input.keyboard) {
            throw new Error('Keyboard input not available');
        }

        // Add shoot key (SPACE)
        this.shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Initialize projectiles group
        this.projectiles = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            maxSize: 10,
            collideWorldBounds: true,
            allowGravity: false
        });

        // Initialize player with shooting capability BEFORE creating hazards
        this.player = {
            sprite: this.physics.add.sprite(100, 450, this.playerSprite),
            canJump: true,
            jumpCount: 0,
            canShoot: true
        };

        this.player.sprite.setBounce(0.2);
        this.player.sprite.setCollideWorldBounds(true);

        // Setup camera
        this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
        this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);

        // Create hazards and collectibles AFTER player is created
        this.createHazards();
        this.createCollectibles();

        // Add projectile-ghost collision AFTER creating hazards
        this.physics.add.collider(
            this.projectiles,
            this.ghosts,
            (projectile, ghost) => {
                this.handleProjectileHit(
                    projectile as Phaser.Physics.Arcade.Sprite,
                    ghost as Phaser.Physics.Arcade.Sprite
                );
            },
            undefined,
            this
        );

        // Create level end point
        this.levelEndPoint = this.add.zone(this.levelWidth - 100, this.levelHeight - 100, 50, 100);
        this.physics.world.enable(this.levelEndPoint);
        (this.levelEndPoint.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (this.levelEndPoint.body as Phaser.Physics.Arcade.Body).moves = false;

        // Add end point marker (visible rectangle)
        const endPointMarker = this.add.rectangle(
            this.levelWidth - 100,
            this.levelHeight - 100,
            50,
            100,
            0x00ff00,
            0.5
        );

        // Cursors
        if (this.input && this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        // Add platform collider AFTER both player and platforms exist
        this.physics.add.collider(this.player.sprite, this.platforms);
        
        // Add level end point overlap
        this.physics.add.overlap(
            this.player.sprite,
            this.levelEndPoint,
            this.handleLevelComplete,
            undefined,
            this
        );

        // Score - make it follow the camera
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '32px',
            color: '#ffffff'
        });
        this.scoreText.setScrollFactor(0);

        // Set initial state
        this.player.sprite.setFrame(4);
    }

    update() {
        if (!this.cursors || !this.animsCreated || !this.player?.sprite) return;

        const sprite = this.player.sprite;

        // Handle movement
        if (this.cursors.left.isDown) {
            sprite.setVelocityX(-160);
            if (this.animsCreated && (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== 'left')) {
                sprite.anims.play('left', true);
            }
        } else if (this.cursors.right.isDown) {
            sprite.setVelocityX(160);
            if (this.animsCreated && (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== 'right')) {
                sprite.anims.play('right', true);
            }
        } else {
            sprite.setVelocityX(0);
            if (this.animsCreated) {
                sprite.anims.stop();
                sprite.setFrame(4); // Use the "turn" frame
            }
        }

        // Jump logic
        if (this.cursors.up.isDown && this.player.canJump && this.player.jumpCount < 2) {
            sprite.setVelocityY(-330);
            this.player.jumpCount++;
            if (this.player.jumpCount === 2) {
                this.player.canJump = false;
            }
        }

        // Reset jump ability when touching any platform or the ground
        const isTouchingDown = sprite.body?.touching.down || false;
        const isOnPlatform = sprite.body?.blocked.down || false;

        if (isTouchingDown || isOnPlatform) {
            this.player.canJump = true;
            this.player.jumpCount = 0;
        }

        // Move ghosts - smoother ghost movement with slight delay
        this.ghosts.children.iterate((entry: Phaser.GameObjects.GameObject) => {
            const ghost = entry as Phaser.Physics.Arcade.Sprite;
            if (ghost) {
                const dx = sprite.x - ghost.x;
                const dy = sprite.y - ghost.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // Speed increases as ghosts get closer to the player
                const baseSpeed = 50;
                const maxSpeed = 100;
                const speedMultiplier = Math.max(0.5, Math.min(1.5, 300 / distance));
                const speed = Math.min(maxSpeed, baseSpeed * speedMultiplier);

                ghost.setVelocity(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed
                );

                // Fade effect based on movement
                ghost.setAlpha(0.7 + Math.sin(this.time.now / 500) * 0.3);
            }
            return true;
        });

        // Handle shooting for ghost hunter
        if (this.characterType === 'hunter' && this.shootKey.isDown && this.player.canShoot) {
            this.shoot();
            this.player.canShoot = false;
            this.time.delayedCall(500, () => {  // 500ms cooldown between shots
                this.player.canShoot = true;
            });
        }

        // Update projectile positions and cleanup
        this.projectiles.getChildren().forEach((projectile) => {
            const p = projectile as Phaser.Physics.Arcade.Sprite;
            // Remove projectiles that are out of bounds
            if (p.x < 0 || p.x > this.levelWidth || p.y < 0 || p.y > this.levelHeight) {
                p.destroy();
            }
        });
    }

    private createPlayerAnimations(): boolean {
        try {
            if (!this.textures.exists(this.playerSprite)) {
                console.error('Player sprite texture not loaded:', this.playerSprite);
                return false;
            }

            // Remove any existing animations
            this.anims.remove('left');
            this.anims.remove('right');

            // Create new animations
            this.anims.create({
                key: 'left',
                frames: this.anims.generateFrameNumbers(this.playerSprite, { start: 0, end: 3 }),
                frameRate: 10,
                repeat: -1
            });

            this.anims.create({
                key: 'right',
                frames: this.anims.generateFrameNumbers(this.playerSprite, { start: 5, end: 8 }),
                frameRate: 10,
                repeat: -1
            });

            return true;
        } catch (error) {
            console.error('Error creating animations:', error);
            return false;
        }
    }

    private createHauntedHousePlatforms() {
        // Create platforms for the haunted house level - now spread across the level
        const platformPositions = [
            // First section
            { x: 600, y: 400 },
            { x: 50, y: 250 },
            { x: 750, y: 220 },
            { x: 400, y: 300 },
            { x: 200, y: 350 },
            // Middle section
            { x: 1200, y: 350 },
            { x: 1500, y: 250 },
            { x: 1800, y: 400 },
            { x: 2000, y: 300 },
            // Final section
            { x: 2400, y: 350 },
            { x: 2700, y: 250 },
            { x: 3000, y: 400 },
            { x: 2800, y: 200 }
        ];

        platformPositions.forEach(pos => {
            this.platforms.create(pos.x, pos.y, 'platform');
        });
    }

    private createHazards() {
        // Create spikes
        this.spikes = this.physics.add.staticGroup();
        const spikePositions = [
            // First section
            { x: 300, y: 550 },
            { x: 500, y: 550 },
            { x: 600, y: 370 },
            // Middle section
            { x: 1300, y: 550 },
            { x: 1700, y: 550 },
            { x: 1900, y: 370 },
            // Final section
            { x: 2500, y: 550 },
            { x: 2800, y: 550 },
            { x: 2900, y: 370 }
        ];

        spikePositions.forEach(pos => {
            this.spikes.create(pos.x, pos.y, 'spike');
        });

        // Create ghosts
        this.ghosts = this.physics.add.group({
            allowGravity: false,
            collideWorldBounds: true,
            immovable: false
        });

        const ghostPositions = [
            // First section
            { x: 400, y: 100 },
            { x: 600, y: 200 },
            // Middle section
            { x: 1500, y: 150 },
            { x: 1800, y: 200 },
            // Final section
            { x: 2500, y: 150 },
            { x: 2800, y: 200 }
        ];

        ghostPositions.forEach(pos => {
            const ghost = this.ghosts.create(pos.x, pos.y, 'ghost') as Phaser.Physics.Arcade.Sprite;
            ghost.setBounce(0);
            ghost.setCollideWorldBounds(true);
        });

        // Colliders - remove ghost-platform collision
        this.physics.add.collider(this.player.sprite, this.spikes, this.handleDeath, undefined, this);
        this.physics.add.overlap(this.player.sprite, this.ghosts, this.handleDeath, undefined, this);
    }

    private createCollectibles() {
        // Create coins as a static group
        this.coins = this.physics.add.staticGroup();
        const coinPositions = [
            // First section
            { x: 100, y: 200 },
            { x: 300, y: 250 },
            { x: 500, y: 350 },
            { x: 700, y: 180 },
            // Middle section
            { x: 1200, y: 200 },
            { x: 1500, y: 150 },
            { x: 1800, y: 300 },
            { x: 2000, y: 200 },
            // Final section
            { x: 2400, y: 200 },
            { x: 2700, y: 150 },
            { x: 2900, y: 300 },
            { x: 3100, y: 200 }
        ];

        coinPositions.forEach(pos => {
            const coin = this.coins.create(pos.x, pos.y, 'coin');
            this.tweens.add({
                targets: coin,
                y: pos.y - 5,
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        });

        // Collider
        this.physics.add.overlap(
            this.player.sprite,
            this.coins,
            (_: any, object2: any) => {
                const coin = object2 as Phaser.Physics.Arcade.Sprite;
                this.collectCoin(coin);
            },
            undefined,
            this
        );
    }

    private handleDeath() {
        // Stop the current music
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
            this.backgroundMusic.destroy();
        }

        // Restart the scene after a short delay to ensure cleanup
        this.time.delayedCall(200, () => {
            this.scene.restart();
            this.score = 0;
            this.scoreText.setText('Score: ' + this.score);
        });
    }

    private collectCoin(coin: Phaser.Physics.Arcade.Sprite) {
        coin.destroy();
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
    }

    private handleLevelComplete() {
        // Fade out music on level complete
        if (this.backgroundMusic) {
            this.tweens.add({
                targets: this.backgroundMusic,
                volume: 0,
                duration: 1000
            });
        }

        // You can add more complex level completion logic here
        this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'Level Complete!\nFinal Score: ' + this.score,
            {
                fontSize: '48px',
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5).setScrollFactor(0);

        // Pause the game
        this.physics.pause();
        this.player.sprite.setVelocity(0, 0);

        // Add a restart button
        const restartButton = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 100,
            'Click to Restart',
            {
                fontSize: '32px',
                color: '#ffffff'
            }
        ).setOrigin(0.5).setScrollFactor(0).setInteractive();

        restartButton.on('pointerdown', () => {
            this.scene.restart();
        });
    }

    private shoot() {
        const projectile = this.projectiles.create(
            this.player.sprite.x,
            this.player.sprite.y,
            'projectile'
        ) as Phaser.Physics.Arcade.Sprite;

        if (!projectile.body) return;

        // Set projectile properties
        const speed = 400;
        const direction = this.player.sprite.flipX ? -1 : 1;  // Shoot based on player direction
        
        projectile.setVelocityX(speed * direction);
        projectile.setScale(0.5);  // Make projectile smaller
        
        // Ensure projectile has proper physics settings
        const body = projectile.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setImmovable(true);  // Make projectiles immovable for better collision
        
        // Add a glowing effect
        projectile.setTint(0x00ffff);

        // Destroy projectile after 2 seconds if it hasn't hit anything
        this.time.delayedCall(2000, () => {
            if (projectile && projectile.active) {
                projectile.destroy();
            }
        });
    }

    private handleProjectileHit(projectile: Phaser.Physics.Arcade.Sprite, ghost: Phaser.Physics.Arcade.Sprite) {
        if (!projectile || !ghost || !projectile.active || !ghost.active) return;
        
        // Destroy both the projectile and the ghost
        projectile.destroy();
        ghost.destroy();
        
        // Add score for killing a ghost
        this.score += 20;
        this.scoreText.setText('Score: ' + this.score);
        
        // Add a particle effect for ghost destruction
        this.addGhostDestroyEffect(ghost.x, ghost.y);
    }

    private addGhostDestroyEffect(x: number, y: number) {
        const particles = this.add.particles(x, y, 'ghost', {
            speed: { min: -100, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            lifespan: 500,
            quantity: 10,
            blendMode: 'ADD'
        });

        // Auto-destroy the particle system after animation completes
        this.time.delayedCall(500, () => {
            particles.destroy();
        });
    }
} 