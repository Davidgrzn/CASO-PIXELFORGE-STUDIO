import React, { useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { CreditCard, ShoppingBag, TrendingDown, ArrowRight } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const TransactionHistory = () => {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [spends, setSpends] = useState([])
  const [activeTab, setActiveTab] = useState('purchases') // 'purchases' | 'spends'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [txRes, spendRes] = await Promise.all([
        api.getTransactionHistory(),
        api.getSpendingHistory()
      ])
      setTransactions(txRes.data)
      setSpends(spendRes.data)
    } catch (err) {
      toast.error('Error al cargar el historial de transacciones')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPackageEmoji = (packageName) => {
    switch (packageName?.toLowerCase()) {
      case 'basico': return '🪙'
      case 'estandar': return '💎'
      case 'premium': return '👑'
      default: return '📦'
    }
  }

  if (!user) return null

  return (
    <div style={{ padding: '30px 20px', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh' }}>
      <Toaster position="top-right" />

      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px' }} className="glow-text-cyan">
         Historial de Transacciones
      </h2>

      {/* Tab Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '15px', 
        marginBottom: '25px',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '15px'
      }}>
        <button
          onClick={() => setActiveTab('purchases')}
          className={activeTab === 'purchases' ? 'glow-text-purple' : ''}
          style={{
            background: activeTab === 'purchases' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
            border: activeTab === 'purchases' ? '1px solid rgba(168, 85, 247, 0.4)' : 'none',
            color: activeTab === 'purchases' ? '#d8b4fe' : '#94a3b8',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'all 0.3s'
          }}
        >
          <CreditCard size={18} style={{ display: 'inline', marginRight: '8px' }} />
          Compra de Tokens
        </button>

        <button
          onClick={() => setActiveTab('spends')}
          className={activeTab === 'spends' ? 'glow-text-cyan' : ''}
          style={{
            background: activeTab === 'spends' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
            border: activeTab === 'spends' ? '1px solid rgba(6, 182, 212, 0.4)' : 'none',
            color: activeTab === 'spends' ? '#a5f3fc' : '#94a3b8',
            padding: '10px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'all 0.3s'
          }}
        >
          <ShoppingBag size={18} style={{ display: 'inline', marginRight: '8px' }} />
          Gasto en Items
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
          Cargando historial...
        </div>
      ) : (
        <>
          {/* Purchases Tab */}
          {activeTab === 'purchases' && (
            <div>
              {transactions.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <CreditCard size={48} style={{ opacity: 0.3, margin: '0 auto 20px' }} />
                  <p>No tienes compras de tokens registradas.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {transactions.map(tx => (
                    <div 
                      key={tx.id}
                      className="glass-card"
                      style={{
                        padding: '20px',
                        borderLeft: tx.result === 'aprobada' ? '4px solid #10b981' : '4px solid #ef4444',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        gap: '20px',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Paquete</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                          {getPackageEmoji(tx.package_name)} {tx.package_name?.charAt(0).toUpperCase() + tx.package_name?.slice(1)}
                        </p>
                      </div>

                      <div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Tokens</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#06b6d4' }}>
                          +{tx.tokens_amount} 
                        </p>
                      </div>

                      <div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Valor</p>
                        <p style={{ fontSize: '1rem', fontWeight: 600 }}>
                          ${tx.price_cop?.toLocaleString('es-CO')} COP
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Estado</p>
                        <p style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          background: tx.result === 'aprobada' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: tx.result === 'aprobada' ? '#86efac' : '#fca5a5'
                        }}>
                          {tx.result === 'aprobada' ? ' Aprobada' : ` ${tx.rejection_reason}`}
                        </p>
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          color: '#64748b',
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                          paddingTop: '12px'
                        }}>
                          <span>Tarjeta: •••• {tx.last_four_used}</span>
                          <span>{formatDate(tx.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spends Tab */}
          {activeTab === 'spends' && (
            <div>
              {spends.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <ShoppingBag size={48} style={{ opacity: 0.3, margin: '0 auto 20px' }} />
                  <p>No tienes compras de items registradas.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {spends.map(spend => (
                    <div 
                      key={spend.id}
                      className="glass-card"
                      style={{
                        padding: '20px',
                        borderLeft: '4px solid #a855f7',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        gap: '20px',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Artículo Comprado</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                          {spend.item_name}
                        </p>
                      </div>

                      <div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Costo</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ef4444' }}>
                          -{spend.tokens_spent} 
                        </p>
                      </div>

                      <div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Saldo Después</p>
                        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#fbbf24' }}>
                          {spend.balance_after} 
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Fecha</p>
                        <p style={{ fontSize: '0.9rem' }}>
                          {formatDate(spend.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TransactionHistory
