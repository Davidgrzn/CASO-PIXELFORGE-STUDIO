import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'
import { ShieldCheck, Download, Plus, Trash2, Key, CreditCard } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const Profile = () => {
  const { user, fetchUser } = useAuth()
  const mfaMethodLabel = user?.mfa_method === 'oauth2' ? 'OAuth2 con PKCE' : 'Google Authenticator'
  
  // MFA activation flows
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfa_enabled)
  const [qrBlobUrl, setQrBlobUrl] = useState(null)
  const [otpCode, setOtpCode] = useState('')
  const [showMfaSetup, setShowMfaSetup] = useState(false)
  const [activatingMfa, setActivatingMfa] = useState(false)
  const [pendingMfaSetup, setPendingMfaSetup] = useState(false)

  // Card management
  const [cards, setCards] = useState([])
  const [cardNumber, setCardNumber] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [cvv, setCvv] = useState('')
  const [registeringCard, setRegisteringCard] = useState(false)
  
  // PDF download
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('error') === 'oauth2_email_mismatch') {
      toast.error('La cuenta OAuth2 no coincide con el correo registrado.')
    }
  }, [location])

  const loadCards = async () => {
    if (user?.role !== 'jugador') return
    try {
      const response = await api.getCards()
      setCards(response.data)
    } catch (err) {
      console.error('Error listing cards', err)
    }
  }

  useEffect(() => {
    setMfaEnabled(user?.mfa_enabled)
    loadCards()
  }, [user])

  useEffect(() => {
    return () => {
      if (qrBlobUrl) {
        URL.revokeObjectURL(qrBlobUrl)
      }
    }
  }, [qrBlobUrl])

  const handleInitMfaSetup = async () => {
    setActivatingMfa(true)
    try {
      const response = await api.setupMFA()
      if (qrBlobUrl) {
        URL.revokeObjectURL(qrBlobUrl)
      }
      const url = URL.createObjectURL(response.data)
      setQrBlobUrl(url)
      setShowMfaSetup(true)
      setPendingMfaSetup(false)
      toast.success("Se ha generado el código QR de configuración.")
    } catch (err) {
      if (err.response?.status === 409) {
        setPendingMfaSetup(true)
        toast.error("Ya hay un QR pendiente. Cancela la configuración actual y genera uno nuevo.")
      } else {
        toast.error(err.response?.data?.detail || "Error al iniciar configuración de MFA.")
      }
    } finally {
      setActivatingMfa(false)
    }
  }

  const handleCancelMfaSetup = async () => {
    setActivatingMfa(true)
    try {
      await api.cancelMFASetup()
      if (qrBlobUrl) {
        URL.revokeObjectURL(qrBlobUrl)
      }
      setQrBlobUrl(null)
      setOtpCode('')
      setShowMfaSetup(false)
      setPendingMfaSetup(false)
      toast.success("Configuración MFA cancelada. Ya puedes generar un nuevo QR.")
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo cancelar la configuración MFA.")
    } finally {
      setActivatingMfa(false)
    }
  }

  const handleOAuth2MfaSetup = async () => {
    setActivatingMfa(true)
    try {
      const response = await api.startOAuth2MFASetup()
      window.location.assign(response.data.authorization_url)
    } catch (err) {
      toast.error(err.response?.data?.detail || "OAuth2 MFA no está configurado en el servidor.")
      setActivatingMfa(false)
    }
  }

  const handleConfirmMfa = async (e) => {
    e.preventDefault()
    setActivatingMfa(true)
    try {
      await api.confirmMFA(otpCode)
      toast.success("Autenticación multifactor activada con éxito.")
      setShowMfaSetup(false)
      if (qrBlobUrl) {
        URL.revokeObjectURL(qrBlobUrl)
      }
      setQrBlobUrl(null)
      setOtpCode('')
      setPendingMfaSetup(false)
      fetchUser() // Refresh auth state
    } catch (err) {
      toast.error(err.response?.data?.detail || "Código incorrecto. Intente de nuevo.")
    } finally {
      setActivatingMfa(false)
    }
  }

  const handleAddCard = async (e) => {
    e.preventDefault()
    setRegisteringCard(true)
    
    // Quick local checks
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      toast.error("El número de tarjeta debe tener exactamente 16 dígitos.")
      setRegisteringCard(false)
      return
    }

    try {
      const formattedNum = cardNumber.replace(/\s/g, '')
      await api.addCard(formattedNum, cardholderName, expiryMonth, expiryYear, cvv)
      toast.success("Tarjeta de pago registrada correctamente.")
      // Reset form
      setCardNumber('')
      setCardholderName('')
      setExpiryMonth('')
      setExpiryYear('')
      setCvv('')
      loadCards()
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fallo en el registro de la tarjeta.")
    } finally {
      setRegisteringCard(false)
    }
  }

  const handleDeleteCard = async (cardToken) => {
    const confirmation = window.confirm("¿Seguro que desea eliminar esta tarjeta de pago?")
    if (!confirmation) return

    try {
      await api.deleteCard(cardToken)
      toast.success("Tarjeta eliminada correctamente.")
      loadCards()
    } catch (err) {
      toast.error("Fallo al eliminar tarjeta.")
    }
  }

  const handleDownloadMyData = async () => {
    setDownloadingPdf(true)
    const myToast = toast.loading("Generando informe de datos personales en el servidor...")
    try {
      const response = await api.downloadMyData()
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      // Trigger download
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'mis_datos.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      toast.success("Descarga iniciada exitosamente.", { id: myToast })
    } catch (err) {
      toast.error("No se pudo descargar el reporte.", { id: myToast })
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (!user) return null

  return (
    <div style={{ padding: '30px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px' }} className="glow-text-purple">
         Mi Perfil de Seguridad
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Personal Info & MFA & Habeas Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Details Card */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>Detalles de la Cuenta</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Usuario:</span>
                <span style={{ fontWeight: 600 }}>{user.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Rol de Acceso:</span>
                <span style={{ color: '#06b6d4', fontWeight: 600, textTransform: 'uppercase' }}>{user.role}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#94a3b8' }}>Estado de Cuenta:</span>
                <span className="badge badge-success">{user.status}</span>
              </div>
            </div>
          </div>

          {/* MFA configuration */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="#a855f7" /> Autenticación Multifactor (MFA)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '15px', lineHeight: '1.4' }}>
              Añade una capa de seguridad extra para proteger tus transacciones y accesos utilizando códigos OTP temporales.
            </p>

            {mfaEnabled ? (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid var(--success)',
                color: '#a7f3d0',
                padding: '12px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.9rem',
                fontWeight: 600
              }}>
                <ShieldCheck size={20} />
                <span>MFA Activado ({mfaMethodLabel})</span>
              </div>
            ) : (
              <div>
                {!showMfaSetup ? (
                  <>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%' }}
                      onClick={handleInitMfaSetup}
                      disabled={activatingMfa}
                    >
                      {activatingMfa ? 'Configurando...' : 'Configurar Google Authenticator'}
                    </button>
                    {pendingMfaSetup && (
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '10px' }}
                        onClick={handleCancelMfaSetup}
                        disabled={activatingMfa}
                      >
                        Cancelar QR pendiente
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%', marginTop: '10px' }}
                      onClick={handleOAuth2MfaSetup}
                      disabled={activatingMfa}
                    >
                      Configurar OAuth2 con PKCE
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleConfirmMfa} style={{
                    marginTop: '15px',
                    padding: '15px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.01)'
                  }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '12px', color: '#cbd5e1', textAlign: 'center' }}>
                      Escanea este código QR con Google Authenticator e ingresa el código de 6 dígitos:
                    </p>
                    
                    {qrBlobUrl && (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
                        <img 
                          src={qrBlobUrl} 
                          alt="MFA QR Code" 
                          style={{
                            border: '8px solid white',
                            borderRadius: '4px',
                            width: '180px',
                            height: '180px'
                          }} 
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <input 
                        type="text" 
                        placeholder="Código de 6 dígitos"
                        className="form-input"
                        style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '0.2em' }}
                        maxLength="6"
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={activatingMfa}>
                        Confirmar
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={handleCancelMfaSetup}
                        disabled={activatingMfa}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Habeas Data Ley 1581 */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} color="#06b6d4" /> Exportación Habeas Data
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '15px', lineHeight: '1.4' }}>
              De acuerdo con la <b>Ley 1581 de 2012</b> de Protección de Datos Personales, puedes solicitar
              una copia completa de toda la información que almacenamos en tu cuenta.
            </p>
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%' }}
              onClick={handleDownloadMyData}
              disabled={downloadingPdf}
            >
              <Download size={16} /> Descargar mis Datos (PDF)
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Payments & Registered Cards (Only Player) */}
        {user.role === 'jugador' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Cards List */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#fbbf24" /> Tarjetas Registradas
              </h3>

              {cards.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No tienes tarjetas de crédito registradas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cards.map(card => (
                    <div key={card.card_token} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(124, 58, 237, 0.15)',
                      borderRadius: '12px',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>
                          {card.card_type === 'visa' ? ' Visa' : ' MasterCard'}
                        </span>
                        <div>
                          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>•••• •••• •••• {card.last_four}</p>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Exp: {card.expiry_month}/{card.expiry_year}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleDeleteCard(card.card_token)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Register Card Form */}
            {cards.length < 2 ? (
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} color="#a855f7" /> Registrar Nueva Tarjeta
                </h3>

                <form onSubmit={handleAddCard}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cardNumber">Número de Tarjeta</label>
                    <input 
                      id="cardNumber"
                      type="text" 
                      className="form-input" 
                      placeholder="4111 1111 1111 1111" 
                      maxLength="19"
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value.replace(/[^\d]/g, '').replace(/(.{4})/g, '$1 ').trim())}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="cardholder">Titular de la Tarjeta</label>
                    <input 
                      id="cardholder"
                      type="text" 
                      className="form-input" 
                      placeholder="Nombre Completo"
                      value={cardholderName}
                      onChange={e => setCardholderName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="expMonth">Mes Expiración</label>
                      <input 
                        id="expMonth"
                        type="text" 
                        className="form-input" 
                        placeholder="MM"
                        maxLength="2"
                        value={expiryMonth}
                        onChange={e => setExpiryMonth(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="expYear">Año Expiración</label>
                      <input 
                        id="expYear"
                        type="text" 
                        className="form-input" 
                        placeholder="YYYY"
                        maxLength="4"
                        value={expiryYear}
                        onChange={e => setExpiryYear(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="cvv">CVV</label>
                      <input 
                        id="cvv"
                        type="password" 
                        className="form-input" 
                        placeholder="•••"
                        maxLength="4"
                        value={cvv}
                        onChange={e => setCvv(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '10px' }}
                    disabled={registeringCard}
                  >
                    Registrar Tarjeta
                  </button>
                </form>
              </div>
            ) : (
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px dashed rgba(245, 158, 11, 0.3)',
                padding: '15px',
                borderRadius: '12px',
                color: '#fbbf24',
                fontSize: '0.85rem',
                textAlign: 'center'
              }}>
                Máximo de tarjetas registradas alcanzado. Elimine una para registrar otra.
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}

export default Profile
