import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, User as UserIcon, Coins, Shield, Gamepad2, ShoppingBag, TrendingUp } from 'lucide-react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav style={{
      background: 'rgba(7, 7, 10, 0.75)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(124, 58, 237, 0.15)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Brand logo */}
      <Link to="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none'
      }}>
        {/* Retro Rocket/Pixel Logo */}
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 22H6L12 18L18 22H22L12 2Z" fill="url(#logoGlow)" stroke="#06b6d4" strokeWidth="1.5" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="logoGlow" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7c3aed" />
              <stop offset="1" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <span style={{
          fontFamily: 'Orbitron',
          fontWeight: 900,
          fontSize: '1.25rem',
          background: 'linear-gradient(to right, #a855f7, #06b6d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '1px'
        }}>
          PIXELFORGE
        </span>
      </Link>

      {/* Nav Links */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginLeft: 'auto'
      }}>
        <Link to="/" style={{
          color: isActive('/') ? '#06b6d4' : '#94a3b8',
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 600,
          transition: 'color 0.2s',
          fontFamily: 'Orbitron'
        }}>
          Ranking
        </Link>

        {user && user.role === 'jugador' && (
          <>
            <Link to="/game" style={{
              color: isActive('/game') ? '#06b6d4' : '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Orbitron'
            }}>
              <Gamepad2 size={16} /> Jugar
            </Link>
            <Link to="/shop" style={{
              color: isActive('/shop') ? '#06b6d4' : '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Orbitron'
            }}>
              <ShoppingBag size={16} /> Tienda
            </Link>

            <Link to="/transactions" style={{
              color: isActive('/transactions') ? '#06b6d4' : '#94a3b8',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Orbitron'
            }}>
              <TrendingUp size={16} /> Transacciones
            </Link>
          </>
        )}

        {user && (user.role === 'admin_juego' || user.role === 'moderador') && (
          <Link to="/admin" style={{
            color: isActive('/admin') ? '#06b6d4' : '#94a3b8',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'Orbitron'
          }}>
            <Shield size={16} /> Admin Panel
          </Link>
        )}

        {/* User profile & Actions */}
        {user ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            {/* Tokens Balance Badge (only players) */}
            {user.role === 'jugador' && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid #f59e0b',
                color: '#fbbf24',
                padding: '4px 10px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 700
              }}>
                <Coins size={14} />
                <span>{user.token_balance} Tokens</span>
              </div>
            )}

            <Link to="/profile" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: isActive('/profile') ? '#06b6d4' : '#e2e8f0',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <UserIcon size={16} />
              <span>{user.username}</span>
            </Link>

            <button onClick={handleLogout} style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem',
              fontWeight: 500
            }}>
              <LogOut size={16} />
              <span>Salir</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <Link to="/login" className="btn btn-secondary" style={{ padding: '6px 16px' }}>
              Ingresar
            </Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: '6px 16px' }}>
              Registro
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
