import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { ShoppingBag, Coins, CreditCard, Check, ShieldAlert } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const Shop = () => {
  const { user, fetchUser } = useAuth()
  
  // Shop & Inventory
  const [items, setItems] = useState([])
  const [ownedItemIds, setOwnedItemIds] = useState(new Set())
  const [loadingShop, setLoadingShop] = useState(false)
  const [buyingItem, setBuyingItem] = useState(null)

  // Tokens purchase state
  const [cards, setCards] = useState([])
  const [selectedCard, setSelectedCard] = useState('')
  const [selectedPackage, setSelectedPackage] = useState('basico')
  const [buyingTokens, setBuyingTokens] = useState(false)

  const loadShopData = async () => {
    setLoadingShop(true)
    try {
      const itemsRes = await api.getShopItems()
      setItems(itemsRes.data)
      
      const ownedRes = await api.getOwnedItems()
      const ids = new Set(ownedRes.data.map(i => i.id))
      setOwnedItemIds(ids)
    } catch (err) {
      console.error("Failed to load shop data", err)
    } finally {
      setLoadingShop(false)
    }
  }

  const loadCards = async () => {
    try {
      const res = await api.getCards()
      setCards(res.data)
      if (res.data.length > 0) {
        setSelectedCard(res.data[0].card_token)
      }
    } catch (err) {
      console.error("Failed to load cards", err)
    }
  }

  useEffect(() => {
    loadShopData()
    loadCards()
  }, [])

  const handleBuyTokens = async (e) => {
    e.preventDefault()
    if (!selectedCard) {
      toast.error("Debe registrar una tarjeta de pago en su perfil primero.")
      return
    }

    setBuyingTokens(true)
    const myToast = toast.loading("Procesando pago con la entidad bancaria...")

    try {
      const res = await api.buyTokens(selectedCard, selectedPackage)
      toast.success(res.data.message || "¡Tokens comprados correctamente!", { id: myToast })
      fetchUser() // Refresh token balance
    } catch (err) {
      toast.error(err.response?.data?.detail || "La transacción fue rechazada.", { id: myToast })
    } finally {
      setBuyingTokens(false)
    }
  }

  const handleBuyItem = async (itemId, price) => {
    if (user.token_balance < price) {
      toast.error("Saldo de tokens insuficiente.")
      return
    }

    setBuyingItem(itemId)
    try {
      const res = await api.buyShopItem(itemId)
      toast.success(`¡Has adquirido el artículo: ${res.data.item_name}!`)
      loadShopData() // Refresh shop items and owned list
      fetchUser() // Refresh token balance
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fallo al comprar artículo.")
    } finally {
      setBuyingItem(null)
    }
  }

  return (
    <div style={{ padding: '30px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Toaster position="top-right" />
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        paddingBottom: '15px'
      }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-purple">
          <ShoppingBag color="#a855f7" /> Tienda del Hangar
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '30px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Cosmetic Catalog */}
        <div>
          {loadingShop ? (
            <p style={{ color: '#94a3b8' }}>Cargando catálogo...</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '20px'
            }}>
              {items.map(item => {
                const isOwned = ownedItemIds.has(item.id)
                return (
                  <div key={item.id} className="glass-card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '260px'
                  }}>
                    {/* Item Category Badge */}
                    <span className="badge badge-warning" style={{ alignSelf: 'start', marginBottom: '10px' }}>
                      {item.category}
                    </span>

                    <h4 style={{ fontSize: '1rem', marginBottom: '8px' }}>{item.name}</h4>
                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', flexGrow: 1, marginBottom: '15px', lineHeight: '1.4' }}>
                      {item.description}
                    </p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '10px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      paddingTop: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24', fontWeight: 'bold' }}>
                        <Coins size={14} />
                        <span>{item.price_tokens} Tokens</span>
                      </div>

                      {isOwned ? (
                        <span style={{
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}>
                          <Check size={14} /> Adquirido
                        </span>
                      ) : (
                        <button 
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.75rem' }}
                          onClick={() => handleBuyItem(item.id, item.price_tokens)}
                          disabled={buyingItem === item.id}
                        >
                          Comprar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Buy Tokens Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={18} color="#fbbf24" /> Recargar Tokens
            </h3>
            
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '15px', lineHeight: '1.4' }}>
              Adquiere paquetes de tokens galácticos para comprar cosméticos exclusivos en la tienda.
            </p>

            <form onSubmit={handleBuyTokens}>
              {/* Package Select */}
              <div className="form-group">
                <label className="form-label">Seleccionar Paquete</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: selectedPackage === 'basico' ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="radio" 
                        name="package" 
                        value="basico" 
                        checked={selectedPackage === 'basico'}
                        onChange={() => setSelectedPackage('basico')}
                      />
                      <span style={{ fontSize: '0.85rem' }}>Paquete Básico</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>10 Tokens ($10k COP)</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: selectedPackage === 'estandar' ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="radio" 
                        name="package" 
                        value="estandar" 
                        checked={selectedPackage === 'estandar'}
                        onChange={() => setSelectedPackage('estandar')}
                      />
                      <span style={{ fontSize: '0.85rem' }}>Paquete Estándar</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>50 Tokens ($45k COP)</span>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: selectedPackage === 'premium' ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="radio" 
                        name="package" 
                        value="premium" 
                        checked={selectedPackage === 'premium'}
                        onChange={() => setSelectedPackage('premium')}
                      />
                      <span style={{ fontSize: '0.85rem' }}>Paquete Premium</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#06b6d4' }}>120 Tokens ($100k COP)</span>
                  </label>
                </div>
              </div>

              {/* Card Select */}
              <div className="form-group">
                <label className="form-label" htmlFor="payCard">Tarjeta de Pago</label>
                {cards.length === 0 ? (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px dashed var(--danger)',
                    padding: '12px',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                    textAlign: 'center'
                  }}>
                    No tiene tarjetas registradas en su hangar. Por favor regístrelas en su perfil.
                  </div>
                ) : (
                  <select 
                    id="payCard"
                    className="form-input"
                    value={selectedCard}
                    onChange={e => setSelectedCard(e.target.value)}
                  >
                    {cards.map(card => (
                      <option key={card.card_token} value={card.card_token}>
                        {card.card_type === 'visa' ? 'Visa' : 'Mastercard'} - ending in {card.last_four}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px' }}
                disabled={buyingTokens || cards.length === 0}
              >
                {buyingTokens ? 'Validando con pasarela...' : ' Comprar Tokens'}
              </button>
            </form>
          </div>

          {/* Test card hint */}
          <div style={{
            background: 'rgba(6, 182, 212, 0.05)',
            border: '1px dashed rgba(6, 182, 212, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            color: '#22d3ee',
            fontSize: '0.8rem',
            lineHeight: '1.4'
          }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', marginBottom: '6px', fontFamily: 'Orbitron' }}>
              <ShieldAlert size={14} /> Tarjetas de Prueba
            </h4>
            <ul style={{ paddingLeft: '15px' }}>
              <li><b>Visa (1111) / MC (0004)</b>: Transacción Aprobada.</li>
              <li><b>Visa (0002)</b>: Rechazada por Fondos Insuficientes.</li>
              <li><b>Visa (0069)</b>: Rechazada por Tarjeta Vencida.</li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  )
}

export default Shop
