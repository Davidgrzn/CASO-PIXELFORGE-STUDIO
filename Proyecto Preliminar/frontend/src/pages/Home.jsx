import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Trophy, RefreshCw, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Home = () => {
  const { user } = useAuth()
  const [ranking, setRanking] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchRanking = async (p = 1) => {
    setLoading(true)
    try {
      const response = await api.getRanking(p, 10) // 10 per page on landing
      setRanking(response.data.entries)
      setTotalPages(response.data.total_pages)
      setPage(response.data.page)
    } catch (error) {
      console.error('Error fetching ranking', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRanking(1)
    
    // Auto-refresh ranking every 30 seconds
    const interval = setInterval(() => {
      fetchRanking(page)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [page])

  const getRankMedal = (pos) => {
    if (pos === 1) return <span style={{ color: '#fbbf24', fontWeight: 'bold' }}> Oro</span>
    if (pos === 2) return <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}> Plata</span>
    if (pos === 3) return <span style={{ color: '#b45309', fontWeight: 'bold' }}> Bronce</span>
    return `#${pos}`
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Hero Section */}
      <header style={{
        textAlign: 'center',
        padding: '60px 20px',
        background: 'linear-gradient(180deg, rgba(124, 58, 237, 0.05) 0%, transparent 100%)',
        borderRadius: '24px',
        border: '1px solid rgba(124, 58, 237, 0.1)',
        marginBottom: '50px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}></div>

        <h1 style={{
          fontSize: '3rem',
          marginBottom: '20px',
          background: 'linear-gradient(to right, #ffffff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontFamily: 'Orbitron',
          fontWeight: 900
        }}>
          Bienvenido a <span style={{ color: '#06b6d4', textShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}>PixelForge Studio</span>
        </h1>
        
        <p style={{
          color: '#94a3b8',
          fontSize: '1.1rem',
          maxWidth: '700px',
          margin: '0 auto 30px',
          lineHeight: '1.6'
        }}>
          Explota asteroides en <b>AstroBlast</b>, rompe récords, compite en la clasificación global
          y adquiere diseños galácticos exclusivos usando nuestro sistema seguro de tokens.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
          {user ? (
            user.role === 'jugador' ? (
              <Link to="/game" className="btn btn-primary" style={{ fontSize: '1rem', padding: '12px 28px' }}>
                 Jugar Ahora
              </Link>
            ) : (
              <Link to="/admin" className="btn btn-primary" style={{ fontSize: '1rem', padding: '12px 28px' }}>
                 Ir al Panel Administrativo
              </Link>
            )
          ) : (
            <>
              <Link to="/register" className="btn btn-primary" style={{ fontSize: '1rem', padding: '12px 28px' }}>
                Crear Cuenta
              </Link>
              <Link to="/login" className="btn btn-secondary" style={{ fontSize: '1rem', padding: '12px 28px' }}>
                Iniciar Sesión
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Content: Leaderboard */}
      <main style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
        
        {/* Ranking Leaderboard */}
        <section className="glass-card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            paddingBottom: '15px'
          }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy color="#fbbf24" size={24} />
              Tabla de Clasificación Global
            </h2>
            <button 
              onClick={() => fetchRanking(page)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#06b6d4',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Jugador</th>
                  <th>Mejor Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.position}>
                    <td>{getRankMedal(row.position)}</td>
                    <td style={{ fontWeight: '600' }}>{row.username}</td>
                    <td style={{ color: '#06b6d4', fontWeight: 'bold' }}>{row.best_score.toLocaleString()} pts</td>
                  </tr>
                ))}
                {ranking.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: '#94a3b8' }}>
                      No hay puntajes registrados todavía. ¡Sé el primero!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '25px',
              gap: '15px'
            }}>
              <button 
                className="btn btn-secondary"
                style={{ padding: '6px 12px' }}
                onClick={() => fetchRanking(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Página {page} de {totalPages}</span>
              <button 
                className="btn btn-secondary"
                style={{ padding: '6px 12px' }}
                onClick={() => fetchRanking(page + 1)}
                disabled={page === totalPages}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>

        {/* Security Info Card */}
        <section style={{
          background: 'rgba(124, 58, 237, 0.05)',
          border: '1px dashed rgba(124, 58, 237, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          gap: '15px'
        }}>
          <Info color="#a855f7" size={32} style={{ flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '1rem', color: '#ffffff', marginBottom: '8px', fontFamily: 'Orbitron' }}>
              Seguridad y Privacidad
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Este sistema cumple con la <b>Ley 1581 de 2012 (Habeas Data)</b>. Tus datos están completamente seguros.
              No compartimos correos electrónicos ni información privada en la tabla de clasificación.
              Todas las contraseñas están encriptadas bajo <b>bcrypt</b> y las conexiones del panel cuentan con <b>MFA</b>.
            </p>
          </div>
        </section>
      </main>

      <footer style={{
        marginTop: '80px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.8rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        paddingTop: '20px'
      }}>
        <p>PixelForge Studio — Examen Final Seguridad Informática</p>
        <p>Universidad Militar Nueva Granada · 2026-I · Bogotá, Colombia</p>
      </footer>
    </div>
  )
}

export default Home
