import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { ShieldCheck, Mail, Lock, KeyRound } from 'lucide-react'

const Login = () => {
  const { login, verifyMFA } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Form states
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otpCode, setOtpCode] = useState('')
  
  // Step tracking (1: credentials, 2: MFA)
  const [step, setStep] = useState(1)
  const [mfaToken, setMfaToken] = useState(null)
  const [mfaMethod, setMfaMethod] = useState('totp')
  
  // Status states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('error') === 'oauth2_email_mismatch') {
      setError('La cuenta OAuth2 no coincide con el correo registrado en PixelForge.')
    }
  }, [location])

  const handleStep1Submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const result = await login(identifier, password)
      if (result.mfaRequired) {
        setMfaToken(result.partialToken)
        setMfaMethod(result.mfaMethod || 'totp')
        setStep(2)
      } else {
        navigate('/')
      }
    } catch (err) {
      // Return generic error message to satisfy OWASP A07 (user enumeration prevention)
      setError(err.response?.data?.detail || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth2Mfa = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.startOAuth2MFALogin(mfaToken)
      window.location.assign(response.data.authorization_url)
    } catch (err) {
      setError(err.response?.data?.detail || 'No fue posible iniciar OAuth2 MFA')
      setLoading(false)
    }
  }

  const handleStep2Submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      await verifyMFA(otpCode, mfaToken)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Código de verificación incorrecto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '80vh',
      padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '420px' }}>
        
        {/* Header Logo */}
        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
          <div style={{
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '50%',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            marginBottom: '10px'
          }}>
            <ShieldCheck color="#06b6d4" size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Ingresar al Portal</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            {step === 1 ? 'Accede a tu cuenta de juego' : 'Verificación de doble factor (MFA)'}
          </p>
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

        {step === 1 ? (
          /* STEP 1: Credentials Form */
          <form onSubmit={handleStep1Submit}>
            <div className="form-group">
              <label className="form-label" htmlFor="identifier">Correo o Usuario</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  id="identifier"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '40px' }}
                  placeholder="correo@pixelforge.gg o usuario"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
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
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? 'Validando...' : 'Iniciar Sesión'}
            </button>
            
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>¿No tienes una cuenta? </span>
              <Link to="/register" style={{ color: '#06b6d4', textDecoration: 'none', fontWeight: 600 }}>Regístrate</Link>
            </div>
          </form>
        ) : mfaMethod === 'oauth2' ? (
          <div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '15px',
              fontSize: '0.85rem',
              color: '#94a3b8',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              Su cuenta usa OAuth2 como segundo factor. Continúe con el proveedor configurado para completar la autenticación.
            </div>

            <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading} onClick={handleOAuth2Mfa}>
              {loading ? 'Redirigiendo...' : 'Continuar con OAuth2'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '10px', padding: '10px' }}
              onClick={() => {
                setStep(1)
                setMfaToken(null)
                setMfaMethod('totp')
                setError(null)
              }}
            >
              Volver al inicio
            </button>
          </div>
        ) : (
          /* STEP 2: MFA Form */
          <form onSubmit={handleStep2Submit}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '15px',
              fontSize: '0.85rem',
              color: '#94a3b8',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              Su cuenta tiene activado la autenticación de doble factor. Por favor ingrese el código de 6 dígitos de su aplicación autenticadora.
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="otp">Código OTP</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '15px' }} />
                <input
                  id="otp"
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '40px', letterSpacing: '0.2em', fontSize: '1.25rem', textAlign: 'center' }}
                  placeholder="000000"
                  maxLength="6"
                  pattern="\d{6}"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
              {loading ? 'Verificando...' : 'Verificar Código'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', marginTop: '10px', padding: '10px' }}
              onClick={() => {
                setStep(1)
                setMfaToken(null)
                setError(null)
              }}
            >
              Volver al inicio
            </button>
          </form>
        )}

      </div>
    </div>
  )
}

export default Login
