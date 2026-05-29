import React, { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import startAstroBlast from '../game/AstroBlastGame'
import { Rocket, Gamepad2, Settings, ShieldCheck, Zap, AlertTriangle } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const Game = () => {
  const { user, fetchUser } = useAuth()
  const gameRef = useRef(null)
  const phaserInstance = useRef(null)
  
  // Customization & Inventory
  const [ownedItems, setOwnedItems] = useState([])
  const [selectedSkin, setSelectedSkin] = useState('default')
  const [selectedTrail, setSelectedTrail] = useState('none')
  const [selectedShield, setSelectedShield] = useState('none')
  
  // Game state
  const [gameActive, setGameActive] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [scoreHistory, setScoreHistory] = useState([])

  const loadInventory = async () => {
    try {
      const response = await api.getOwnedItems()
      setOwnedItems(response.data)
    } catch (err) {
      console.error("Failed to load inventory", err)
    }
  }

  const loadScoreHistory = async () => {
    try {
      const response = await api.getMyScores()
      setScoreHistory(response.data.slice(0, 5))
    } catch (err) {
      console.error("Failed to load scores", err)
    }
  }

  useEffect(() => {
    loadInventory()
    loadScoreHistory()
  }, [])

  // Callback called by Phaser when the game ends
  const handleGameCompleted = async (finalScore, levelReached) => {
    setSubmitting(true)
    const myToast = toast.loading("Registrando puntaje en el servidor seguro...")
    
    try {
      await api.submitScore(finalScore, levelReached)
      toast.success(`¡Puntaje de ${finalScore} pts enviado con éxito!`, { id: myToast })
      // Reload stats
      fetchUser()
      loadScoreHistory()
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fallo en el registro del puntaje.", { id: myToast })
    } finally {
      setSubmitting(false)
      setGameActive(false)
      if (phaserInstance.current) {
        phaserInstance.current.destroy(true)
        phaserInstance.current = null;
      }
    }
  }

  const handleStartGame = () => {
    if (phaserInstance.current) {
      phaserInstance.current.destroy(true)
      phaserInstance.current = null
    }

    setGameActive(true)
    
    // Spawn Phaser game inside the container ref
    // Pass config options: selectedSkin, selectedTrail, selectedShield
    setTimeout(() => {
      phaserInstance.current = startAstroBlast(
        'phaser-game-container',
        {
          skin: selectedSkin,
          trail: selectedTrail,
          shield: selectedShield
        },
        handleGameCompleted
      )
    }, 100)
  }

  const handleStopGame = () => {
    if (phaserInstance.current) {
      phaserInstance.current.destroy(true)
      phaserInstance.current = null
    }
    setGameActive(false)
  }

  // Cleanup game when page is unmounted
  useEffect(() => {
    return () => {
      if (phaserInstance.current) {
        phaserInstance.current.destroy(true)
        phaserInstance.current = null
      }
    }
  }, [])

  const skins = ownedItems.filter(i => i.category === 'skin')
  const trails = ownedItems.filter(i => i.category === 'trail')
  const shields = ownedItems.filter(i => i.category === 'shield')

  return (
    <div style={{ padding: '30px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        paddingBottom: '15px'
      }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-cyan">
          <Rocket color="#06b6d4" /> AstroBlast Arcade
        </h2>
        
        {gameActive && (
          <button className="btn btn-danger" onClick={handleStopGame}>
            Terminar Partida
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: gameActive ? '1fr' : '350px 1fr',
        gap: '30px',
        alignItems: 'start'
      }}>
        
        {/* LEFT COLUMN: Customizer Panel (hidden while playing for full focus) */}
        {!gameActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Customizer */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} color="#a855f7" /> Equipamiento
              </h3>
              
              {/* Ship skin */}
              <div className="form-group">
                <label className="form-label">Nave Seleccionada</label>
                <select 
                  className="form-input" 
                  value={selectedSkin} 
                  onChange={e => setSelectedSkin(e.target.value)}
                >
                  <option value="default">Nave Estándar (Azul)</option>
                  {skins.map(it => (
                    <option key={it.id} value={it.image_key}>{it.name}</option>
                  ))}
                </select>
              </div>

              {/* Engine Trail */}
              <div className="form-group">
                <label className="form-label">Estela del Propulsor</label>
                <select 
                  className="form-input" 
                  value={selectedTrail} 
                  onChange={e => setSelectedTrail(e.target.value)}
                >
                  <option value="none">Sin estela</option>
                  {trails.map(it => (
                    <option key={it.id} value={it.image_key}>{it.name}</option>
                  ))}
                </select>
              </div>

              {/* Energy Shield */}
              <div className="form-group" style={{ marginBottom: '5px' }}>
                <label className="form-label">Escudo Defensivo</label>
                <select 
                  className="form-input" 
                  value={selectedShield} 
                  onChange={e => setSelectedShield(e.target.value)}
                >
                  <option value="none">Sin escudo de energía</option>
                  {shields.map(it => (
                    <option key={it.id} value={it.image_key}>{it.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Score History */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gamepad2 size={18} color="#06b6d4" /> Historial de Partidas
              </h3>
              {scoreHistory.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Aún no has jugado partidas. ¡Empieza una nueva!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {scoreHistory.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      border: '1px solid rgba(255, 255, 255, 0.03)'
                    }}>
                      <span style={{ color: '#94a3b8' }}>Partida #{scoreHistory.length - i}</span>
                      <span style={{ color: '#06b6d4', fontWeight: 'bold' }}>{s.score.toLocaleString()} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: Game Engine Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {gameActive ? (
            /* ACTIVE GAME CANVAS CONTAINER */
            <div className="glass-card pulse-glow-card" style={{ 
              padding: '15px', 
              background: '#020205', 
              border: '2px solid var(--accent)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Target div for Phaser canvas */}
              <div id="phaser-game-container" style={{
                width: '800px',
                height: '500px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#000000',
                boxShadow: '0 0 30px rgba(0,0,0,0.8)'
              }}></div>
              
              <div style={{
                marginTop: '15px',
                display: 'flex',
                gap: '30px',
                color: '#94a3b8',
                fontSize: '0.85rem',
                justifyContent: 'center'
              }}>
                <span><b>Controles:</b> Teclas de flecha ◄ y ► o [A] y [D] para moverte · Barra espaciadora [Space] para disparar</span>
                <span><b>Meta:</b> Destruye los meteoros y sobrevive el mayor tiempo posible.</span>
              </div>
            </div>
          ) : (
            /* PRE-GAME LAUNCHSCREEN */
            <div className="glass-card" style={{ 
              textAlign: 'center', 
              padding: '80px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(6, 182, 212, 0.05)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Gamepad2 size={40} color="#06b6d4" />
              </div>
              
              <h3 style={{ fontSize: '1.4rem' }}>¿Listo para el lanzamiento, Capitán?</h3>
              <p style={{ color: '#94a3b8', maxWidth: '500px', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Tu nave está armada y equipada con los diseños seleccionados. 
                Los meteoros se aproximan al sector 4. ¡Prepárate para defender la galaxia!
              </p>

              {/* Anti-Cheat/Rate Limit warning */}
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px dashed rgba(245, 158, 11, 0.3)',
                padding: '12px 18px',
                borderRadius: '8px',
                color: '#fbbf24',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '550px'
              }}>
                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                <span style={{ textAlign: 'left' }}>
                  <b>Aviso del Servidor:</b> Los puntajes mayores a 10,000 pts serán rechazados. 
                  Límite de velocidad activo: máximo 1 envío de puntaje por minuto.
                </span>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ fontSize: '1.1rem', padding: '14px 40px', marginTop: '10px' }}
                onClick={handleStartGame}
                disabled={submitting}
              >
                 INICIAR COMBATE ESPACIAL
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default Game
