import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { BarChart3, Users, FileSpreadsheet, Lock, ShieldCheck, Download, RefreshCw } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const Dashboard = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(user?.role === 'admin_juego' ? 'stats' : 'players')
  
  // Tab 1: Stats states
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Tab 2: Players states
  const [players, setPlayers] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  // Tab 3: Global report states
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)

  const loadStats = async () => {
    if (user?.role !== 'admin_juego') return // Moderador has no access
    setLoadingStats(true)
    try {
      const res = await api.getAdminStats()
      setStats(res.data)
    } catch (err) {
      console.error(err)
      toast.error("Error al obtener estadísticas del servidor.")
    } finally {
      setLoadingStats(false)
    }
  }

  const loadPlayers = async () => {
    setLoadingPlayers(true)
    try {
      const res = await api.getPlayers()
      setPlayers(res.data)
    } catch (err) {
      console.error(err)
      toast.error("Error al obtener catálogo de jugadores.")
    } finally {
      setLoadingPlayers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'stats') {
      loadStats()
    } else if (activeTab === 'players') {
      loadPlayers()
    }
  }, [activeTab])

  useEffect(() => {
    if (user?.role === 'moderador' && activeTab !== 'players') {
      setActiveTab('players')
    }
  }, [user?.role, activeTab])

  const handleToggleStatus = async (playerId) => {
    try {
      const res = await api.updatePlayerStatus(playerId)
      toast.success(`Jugador ${res.data.username} ahora está ${res.data.status}`)
      loadPlayers() // Reload lists
    } catch (err) {
      toast.error("Fallo al actualizar el estado de la cuenta.")
    }
  }

  const handleDownloadPlayerReport = async (playerId, username) => {
    const myToast = toast.loading(`Generando informe para ${username}...`)
    try {
      const res = await api.downloadPlayerReport(playerId)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'reporte_jugador.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success("Descarga completada.", { id: myToast })
    } catch (err) {
      toast.error("Error al generar PDF del jugador.", { id: myToast })
    }
  }

  const handleGenerateGlobalReport = async (e) => {
    e.preventDefault()
    if (!dateFrom || !dateTo) {
      toast.error("Debe ingresar ambas fechas.")
      return
    }

    setGeneratingReport(true)
    const myToast = toast.loading("Calculando métricas globales...")
    try {
      const res = await api.downloadGlobalReport(dateFrom, dateTo)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'reporte_global.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success("Reporte descargado correctamente.", { id: myToast })
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fallo en la generación del reporte global.", { id: myToast })
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <div style={{ padding: '30px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Toaster position="top-right" />

      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }} className="glow-text-cyan">
         Panel de Control Administrativo
      </h2>

      {/* Tabs Menu */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        marginBottom: '30px',
        gap: '10px'
      }}>
        {user?.role === 'admin_juego' && (
          <button
            onClick={() => setActiveTab('stats')}
            className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          >
            <BarChart3 size={16} /> Estadísticas de la Red
          </button>
        )}

        <button
          onClick={() => setActiveTab('players')}
          className={`btn ${activeTab === 'players' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
        >
          <Users size={16} /> Gestión de Cuentas
        </button>

        {user?.role === 'admin_juego' && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          >
            <FileSpreadsheet size={16} /> Reportes y Auditoría
          </button>
        )}
      </div>

      {/* TAB CONTENT AREAS */}
      <div>
        
        {/* TAB 1: General Stats */}
        {activeTab === 'stats' && user?.role === 'admin_juego' && (
          <div>
            {loadingStats ? (
              <p style={{ color: '#94a3b8' }}>Obteniendo métricas...</p>
            ) : stats ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* Stats cards grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '20px'
                }}>
                  <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total Jugadores</p>
                    <h3 style={{ fontSize: '2rem', color: '#06b6d4', marginTop: '10px' }}>{stats.total_players}</h3>
                  </div>
                  <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Partidas Registradas</p>
                    <h3 style={{ fontSize: '2rem', color: '#a855f7', marginTop: '10px' }}>{stats.total_scores}</h3>
                  </div>
                  <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Puntaje Más Alto</p>
                    <h3 style={{ fontSize: '2rem', color: '#fbbf24', marginTop: '10px' }}>{stats.max_score.toLocaleString()}</h3>
                  </div>
                  <div className="glass-card" style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Activos (Últimos 7 días)</p>
                    <h3 style={{ fontSize: '2rem', color: '#10b981', marginTop: '10px' }}>{stats.active_last_7d}</h3>
                  </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', gap: '15px' }}>
                  <ShieldCheck color="#10b981" size={28} />
                  <div>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '5px' }}>Auditoría Activa</h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      Todas las acciones administrativas se registran de forma automática en la base de datos audit logs 
                      y están configuradas para su ingesta por el agente Wazuh.
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>No hay estadísticas disponibles.</p>
            )}
          </div>
        )}

        {/* TAB 2: Players Account Control */}
        {activeTab === 'players' && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Catálogo General de Jugadores</h3>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={loadPlayers}>
                <RefreshCw size={14} /> Refrescar
              </button>
            </div>

            {loadingPlayers ? (
              <p style={{ color: '#94a3b8' }}>Descargando base de jugadores...</p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Email</th>
                      <th>Estado</th>
                      <th>Tokens</th>
                      <th>MFA Configurado</th>
                      <th>Fecha Registro</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.username}</td>
                        <td>{p.email}</td>
                        <td>
                          <span className={`badge ${p.status === 'activo' ? 'badge-success' : 'badge-danger'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>{p.token_balance}</td>
                        <td>{p.mfa_enabled ? `Sí (${p.mfa_method === 'oauth2' ? 'OAuth2' : 'TOTP'})` : 'No'}</td>
                        <td>{new Date(p.created_at).toLocaleDateString()}</td>
                        <td style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <button
                            className={`btn ${p.status === 'activo' ? 'btn-danger' : 'btn-secondary'}`}
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            onClick={() => handleToggleStatus(p.id)}
                          >
                            {p.status === 'activo' ? 'Suspender' : 'Reactivar'}
                          </button>
                          
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: '#a855f7', color: '#c084fc' }}
                            onClick={() => handleDownloadPlayerReport(p.id, p.username)}
                          >
                            <Download size={12} /> PDF Reporte
                          </button>
                        </td>
                      </tr>
                    ))}
                    {players.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8' }}>
                          No hay jugadores registrados en la plataforma.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Global Reports Config (Admin Only) */}
        {activeTab === 'reports' && user?.role === 'admin_juego' && (
          <div className="glass-card" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '15px' }}>Generar Reporte Global de Actividad</h3>
            
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Seleccione un rango de fechas. El sistema compilará la actividad global de puntajes,
              jugadores activos y generará un archivo PDF firmado en memoria. Rango máximo permitido: 365 días.
            </p>

            <form onSubmit={handleGenerateGlobalReport}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="dateFrom">Fecha de Inicio</label>
                  <input 
                    id="dateFrom"
                    type="date" 
                    className="form-input" 
                    value={dateFrom} 
                    onChange={e => setDateFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="dateTo">Fecha de Finalización</label>
                  <input 
                    id="dateTo"
                    type="date" 
                    className="form-input" 
                    value={dateTo} 
                    onChange={e => setDateTo(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '10px' }}
                disabled={generatingReport}
              >
                {generatingReport ? 'Calculando Reporte...' : ' Descargar Reporte Global (PDF)'}
              </button>
            </form>
          </div>
        )}

        {/* Access Restriction Warning for Moderador on tabs 1 or 3 */}
        {((activeTab === 'stats' || activeTab === 'reports') && user?.role !== 'admin_juego') && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
            <Lock size={48} color="#ef4444" style={{ margin: '0 auto 15px' }} />
            <h3 style={{ color: '#ef4444', marginBottom: '10px' }}>Acceso Restringido</h3>
            <p style={{ color: '#94a3b8', maxWidth: '450px', margin: '0 auto', fontSize: '0.9rem' }}>
              Su rol de <b>Moderador</b> no cuenta con los privilegios necesarios para ver las estadísticas de red 
              o descargar reportes agregados. Su permiso está restringido a la suspensión de cuentas de jugadores.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

export default Dashboard
