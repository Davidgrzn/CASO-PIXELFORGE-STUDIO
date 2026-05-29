import Phaser from 'phaser'

/**
 * AstroBlastGame Phaser 3 Engine
 * Uses on-the-fly generated texture maps to prevent load errors.
 */
class AstroBlastScene extends Phaser.Scene {
  constructor() {
    super('AstroBlastScene')
  }

  init(data) {
    this.customConfig = data.config || { skin: 'default', trail: 'none', shield: 'none' }
    this.onGameOverCallback = data.onGameOver
    
    // Game variables
    this.score = 0
    this.level = 1
    this.gameOver = false
    this.hasShield = this.customConfig.shield !== 'none'
    this.shieldCharges = this.customConfig.shield === 'shield_plasma' ? 2 : (this.customConfig.shield === 'shield_energy' ? 1 : 0)
    this.lastTrailAt = 0
  }

  preload() {
    // Generate simple textures on-the-fly using graphics context
    this.createTextures()
  }

  create() {
    // Background starfield particles
    this.stars = this.add.group()
    for (let i = 0; i < 60; i++) {
      let x = Phaser.Math.Between(0, 800)
      let y = Phaser.Math.Between(0, 500)
      let speed = Phaser.Math.Between(1, 4)
      let star = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff, 0.5)
      this.stars.add(star)
      star.setData('speed', speed)
    }

    // Set player ship skin color based on inventory choice
    let shipColor = 0x00ffff // Default Cyan
    if (this.customConfig.skin === 'ship_phoenix') shipColor = 0xff4500 // Phoenix red-orange
    if (this.customConfig.skin === 'ship_galaxy') shipColor = 0xda70d6 // Galaxy pink/violet
    if (this.customConfig.skin === 'ship_stealth') shipColor = 0x32cd32 // Stealth lime green

    // Spawn player ship
    this.player = this.physics.add.sprite(400, 440, 'player_ship')
    this.player.setTint(shipColor)
    this.player.setCollideWorldBounds(true)

    // Spawn visual shield ring if shield equipped
    if (this.hasShield) {
      this.shieldRing = this.add.circle(400, 440, 24, 0x00dfff, 0.25)
      this.shieldRing.setStrokeStyle(2, 0x00dfff, 0.8)
    }

    // Input handlers
    this.cursors = this.input.keyboard.createCursorKeys()
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    // Laser group
    this.lasers = this.physics.add.group({
      defaultKey: 'laser',
      maxSize: 30
    })

    // Meteor group
    this.meteors = this.physics.add.group()

    // Emitters for explosions and engines
    this.createEmitters()

    // Collision detections
    this.physics.add.collider(this.lasers, this.meteors, this.destroyMeteor, null, this)
    this.physics.add.overlap(this.player, this.meteors, this.hitPlayer, null, this)

    // Score texts
    this.scoreText = this.add.text(16, 16, 'Score: 0', { 
      fontSize: '20px', 
      fill: '#06b6d4', 
      fontFamily: 'Orbitron',
      fontWeight: 'bold' 
    })
    
    this.levelText = this.add.text(16, 45, 'Nivel: 1', { 
      fontSize: '14px', 
      fill: '#a855f7', 
      fontFamily: 'Orbitron'
    })

    if (this.hasShield) {
      this.shieldText = this.add.text(650, 16, `Escudo: ${this.shieldCharges}`, { 
        fontSize: '16px', 
        fill: '#34d399', 
        fontFamily: 'Orbitron' 
      })
    }

    // Set spawn timer for meteors
    this.time.addEvent({
      delay: 1000,
      callback: this.spawnMeteor,
      callbackScope: this,
      loop: true
    })
  }

  update() {
    if (this.gameOver) return

    // Move background stars
    this.stars.children.iterate((star) => {
      let speed = star.getData('speed')
      star.y += speed
      if (star.y > 500) {
        star.y = 0
        star.x = Phaser.Math.Between(0, 800)
      }
    })

    // Ship controls
    let moveSpeed = 350
    if (this.cursors.left.isDown || this.keyA.isDown) {
      this.player.setVelocityX(-moveSpeed)
    } else if (this.cursors.right.isDown || this.keyD.isDown) {
      this.player.setVelocityX(moveSpeed)
    } else {
      this.player.setVelocityX(0)
    }

    // Keep shield Ring floating on top of player
    if (this.hasShield && this.shieldRing) {
      this.shieldRing.x = this.player.x
      this.shieldRing.y = this.player.y
    }

    this.renderEngineTrail()

    // Fire laser
    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.fireLaser()
    }

    // Recalculate level based on score (increases difficulty speed)
    let newLevel = Math.floor(this.score / 200) + 1
    if (newLevel !== this.level) {
      this.level = newLevel
      this.levelText.setText(`Nivel: ${this.level}`)
    }

    // Recycle lasers off-screen
    this.lasers.children.iterate((laser) => {
      if (laser && laser.y < 0) {
        this.lasers.killAndHide(laser)
        laser.body.enable = false
      }
    })
  }

  fireLaser() {
    let laser = this.lasers.get(this.player.x, this.player.y - 15)
    if (laser) {
      laser.setActive(true)
      laser.setVisible(true)
      laser.body.enable = true
      laser.setVelocityY(-400)
      laser.setTint(0x06b6d4)
    }
  }

  spawnMeteor() {
    if (this.gameOver) return

    let x = Phaser.Math.Between(20, 780)
    let meteor = this.meteors.create(x, 0, 'meteor')
    meteor.setVelocityY(Phaser.Math.Between(100 + (this.level * 15), 180 + (this.level * 20)))
    meteor.setTint(0xffd700)
    
    // Scale randomly
    let scale = Phaser.Math.FloatBetween(0.8, 1.6)
    meteor.setScale(scale)
  }

  destroyMeteor(laser, meteor) {
    // Hide laser
    this.lasers.killAndHide(laser)
    laser.body.enable = false
    
    // Play explosion particles at meteor coordinates
    this.explosionEmitter.emitParticleAt(meteor.x, meteor.y, 10)

    meteor.destroy()

    // Increment score
    this.score += 20
    this.scoreText.setText(`Score: ${this.score}`)
  }

  hitPlayer(player, meteor) {
    meteor.destroy()

    if (this.hasShield && this.shieldCharges > 0) {
      // Consume a shield charge
      this.shieldCharges--
      this.shieldText.setText(`Escudo: ${this.shieldCharges}`)
      this.explosionEmitter.emitParticleAt(player.x, player.y, 15)
      
      // Flash player ship to indicate hit
      this.tweens.add({
        targets: player,
        alpha: 0.2,
        duration: 80,
        yoyo: true,
        repeat: 3
      })

      if (this.shieldCharges === 0) {
        this.hasShield = false
        if (this.shieldRing) {
          this.shieldRing.destroy()
          this.shieldRing = null
        }
        this.shieldText.setText("Escudo: AGOTADO")
      }
    } else {
      // End game
      this.gameOver = true
      this.physics.pause()
      this.player.setTint(0xff0000)
      this.explosionEmitter.emitParticleAt(player.x, player.y, 40)
      
      this.add.text(400, 200, 'GAME OVER', { 
        fontSize: '48px', 
        fill: '#ef4444', 
        fontFamily: 'Orbitron',
        fontWeight: 'bold' 
      }).setOrigin(0.5)

      this.add.text(400, 260, 'Enviando puntaje al servidor...', { 
        fontSize: '18px', 
        fill: '#94a3b8', 
        fontFamily: 'Orbitron' 
      }).setOrigin(0.5)

      // Wait 2 seconds and trigger game completed callback
      this.time.delayedCall(2000, () => {
        if (this.onGameOverCallback) {
          this.onGameOverCallback(this.score, this.level)
        }
      })
    }
  }

  createTextures() {
    // 1. Generate player ship texture
    let rtShip = this.make.graphics({ x: 0, y: 0, add: false })
    rtShip.fillStyle(0xffffff)
    // Draw triangle
    rtShip.beginPath()
    rtShip.moveTo(16, 0)
    rtShip.lineTo(0, 32)
    rtShip.lineTo(32, 32)
    rtShip.closePath()
    rtShip.fill()
    rtShip.generateTexture('player_ship', 32, 32)

    // 2. Generate laser texture
    let rtLaser = this.make.graphics({ x: 0, y: 0, add: false })
    rtLaser.fillStyle(0xffffff)
    rtLaser.fillRect(0, 0, 4, 12)
    rtLaser.generateTexture('laser', 4, 12)

    // 3. Generate meteor texture
    let rtMeteor = this.make.graphics({ x: 0, y: 0, add: false })
    rtMeteor.fillStyle(0xffffff)
    rtMeteor.beginPath()
    rtMeteor.arc(12, 12, 12, 0, Math.PI * 2)
    rtMeteor.fill()
    rtMeteor.generateTexture('meteor', 24, 24)

    // 4. Generate dot texture for particles
    let rtDot = this.make.graphics({ x: 0, y: 0, add: false })
    rtDot.fillStyle(0xffffff)
    rtDot.fillRect(0, 0, 3, 3)
    rtDot.generateTexture('dot', 3, 3)
  }

  createEmitters() {
    // Phaser 3.60 changed the particle API. This lightweight effect avoids
    // version-specific emitter calls that can break the whole scene.
    this.explosionEmitter = {
      emitParticleAt: (x, y, count = 10) => {
        for (let i = 0; i < count; i++) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
          const distance = Phaser.Math.Between(20, 70)
          const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), 0xffd166, 0.9)
          this.tweens.add({
            targets: particle,
            x: x + Math.cos(angle) * distance,
            y: y + Math.sin(angle) * distance,
            alpha: 0,
            scale: 0,
            duration: 450,
            onComplete: () => particle.destroy()
          })
        }
      }
    }
  }

  renderEngineTrail() {
    if (!this.player || this.customConfig.trail === 'none') return
    if (this.time.now - this.lastTrailAt < 70) return

    this.lastTrailAt = this.time.now
    let trailColor = 0xff8c00
    if (this.customConfig.trail === 'trail_ice') trailColor = 0x00ffff
    if (this.customConfig.trail === 'trail_rainbow') trailColor = Phaser.Display.Color.RandomRGB().color

    const trail = this.add.circle(this.player.x, this.player.y + 18, 4, trailColor, 0.75)
    this.tweens.add({
      targets: trail,
      y: trail.y + 24,
      alpha: 0,
      scale: 0,
      duration: 300,
      onComplete: () => trail.destroy()
    })
  }
}

const startAstroBlast = (containerId, config, onGameOver) => {
  const phaserConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 500,
    parent: containerId,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: AstroBlastScene
  }

  const game = new Phaser.Game(phaserConfig)
  
  // Send variables to registry
  game.scene.start('AstroBlastScene', { config, onGameOver })
  return game
}

export default startAstroBlast
