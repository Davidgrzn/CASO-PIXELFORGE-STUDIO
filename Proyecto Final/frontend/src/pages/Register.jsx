import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { UserPlus, User, Mail, Lock, Check, X } from 'lucide-react'

const Register = () => {
  const { register } = useAuth()
  const navigate = useNavigate()

  // Form states
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Status states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Real-time password strength checks
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }

  const isPasswordValid = Object.values(checks).every(Boolean)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (!isPasswordValid) {
      setError('La contraseña no cumple con los requisitos mínimos de seguridad')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      await register(username, email, password)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '85vh',
      padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '460px' }}>
        
        {/* Header Logo */}
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <div style={{
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '50%',
            background: 'rgba(124, 58, 237, 0.1)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            marginBottom: '10px'
          }}>
            <UserPlus color="#a855f7" size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Crear una Cuenta</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Únete a la plataforma de juego PixelForge</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {success ? (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--success)',
            color: '#a7f3d0',
            padding: '20px',
            borderRadius: '8px',
            fontSize: '0.95rem',
            textAlign: 'center',
            lineHeight: '1.6'
          }}>
             <b>¡Registro Exitoso!</b><br />
            Redirigiendo al inicio de sesión para acceder a tu cuenta...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Nombre de Usuario</label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="ej. astro_player"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="tu_correo@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Real-time Validation Checkboxes */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginTop: '10px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: checks.length ? '#34d399' : '#94a3b8' }}>
                  {checks.length ? <Check size={12} /> : <X size={12} />} Mín. 8 caracteres
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: checks.uppercase ? '#34d399' : '#94a3b8' }}>
                  {checks.uppercase ? <Check size={12} /> : <X size={12} />} Una mayúscula
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: checks.number ? '#34d399' : '#94a3b8' }}>
                  {checks.number ? <Check size={12} /> : <X size={12} />} Un número
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: checks.special ? '#34d399' : '#94a3b8' }}>
                  {checks.special ? <Check size={12} /> : <X size={12} />} Un carácter especial
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirmar Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading || !isPasswordValid}>
              {loading ? 'Creando Cuenta...' : 'Registrarse'}
            </button>
            
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>¿Ya tienes una cuenta? </span>
              <Link to="/login" style={{ color: '#06b6d4', textDecoration: 'none', fontWeight: 600 }}>Inicia sesión</Link>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

export default Register
