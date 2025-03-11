import 'phaser';

export class MenuScene extends Phaser.Scene {
    private hunterSprite!: Phaser.GameObjects.Sprite;
    private scoutSprite!: Phaser.GameObjects.Sprite;

    constructor() {
        super({ key: 'MenuScene' });
    }

    preload() {
        // Load both character spritesheets
        this.load.spritesheet('hunter', 'assets/hunter.png', { 
            frameWidth: 32, 
            frameHeight: 48 
        });
        this.load.spritesheet('scout', 'assets/scout.png', { 
            frameWidth: 32, 
            frameHeight: 48 
        });
    }

    create() {
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;

        // Add title text
        this.add.text(centerX, centerY - 150, 'Haunted House Adventures', {
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Add character selection text
        this.add.text(centerX, centerY - 70, 'Choose your character:', {
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Create character selection containers
        const hunterX = centerX - 100;
        const scoutX = centerX + 100;
        const characterY = centerY + 20;

        // Create character sprites
        this.hunterSprite = this.add.sprite(hunterX, characterY, 'hunter', 4)
            .setScale(2);
        this.scoutSprite = this.add.sprite(scoutX, characterY, 'scout', 4)
            .setScale(2);

        // Create selection boxes
        const hunterBox = this.add.rectangle(hunterX, characterY, 80, 120, 0x666666)
            .setInteractive();
        const scoutBox = this.add.rectangle(scoutX, characterY, 80, 120, 0x666666)
            .setInteractive();

        // Make sure sprites are above boxes
        this.hunterSprite.setDepth(1);
        this.scoutSprite.setDepth(1);

        // Add character names
        this.add.text(hunterX, characterY + 80, 'Ghost Hunter', {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        this.add.text(scoutX, characterY + 80, 'Spirit Scout', {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Create hover animations
        [hunterBox, scoutBox].forEach(box => {
            box.on('pointerover', () => {
                box.setFillStyle(0x888888);
            });
            box.on('pointerout', () => {
                box.setFillStyle(0x666666);
            });
        });

        // Create idle animations
        this.createCharacterAnimations();

        // Add click handlers
        hunterBox.on('pointerdown', () => {
            this.scene.start('GameScene', { character: 'hunter' });
        });

        scoutBox.on('pointerdown', () => {
            this.scene.start('GameScene', { character: 'scout' });
        });

        // Start idle animations
        this.hunterSprite.play('hunter-idle');
        this.scoutSprite.play('scout-idle');
    }

    private createCharacterAnimations() {
        // Hunter idle animation
        this.anims.create({
            key: 'hunter-idle',
            frames: this.anims.generateFrameNumbers('hunter', { frames: [4, 4, 4, 5, 5, 4] }),
            frameRate: 4,
            repeat: -1
        });

        // Scout idle animation
        this.anims.create({
            key: 'scout-idle',
            frames: this.anims.generateFrameNumbers('scout', { frames: [4, 4, 4, 5, 5, 4] }),
            frameRate: 4,
            repeat: -1
        });
    }
} 