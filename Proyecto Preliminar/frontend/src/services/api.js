import axios from 'axios'

// Axios is configured in AuthContext, but let's double check settings:
axios.defaults.baseURL = '/api'
axios.defaults.withCredentials = true

export const api = {
  // Auth
  register: (username, email, password) => axios.post('/auth/register', { username, email, password }),
  login: (identifier, password) => axios.post('/auth/login', { identifier, password }),
  logout: () => axios.post('/auth/logout'),
  getMe: () => axios.get('/auth/me'),

  // MFA
  setupMFA: () => axios.post('/mfa/setup', {}, { responseType: 'blob' }),
  cancelMFASetup: () => axios.post('/mfa/setup/cancel'),
  confirmMFA: (code) => axios.post('/mfa/confirm', { code }),
  verifyMFA: (code, partialToken) => axios.post('/mfa/verify', { code }, {
    headers: { Authorization: `Bearer ${partialToken}` }
  }),
  startOAuth2MFASetup: () => axios.post('/mfa/oauth2/setup/start'),
  startOAuth2MFALogin: (partialToken) => axios.post('/mfa/oauth2/login/start', {}, {
    headers: { Authorization: `Bearer ${partialToken}` }
  }),

  // Scores
  submitScore: (score, level_completed) => axios.post('/scores', { score, level_completed }),
  getRanking: (page = 1, limit = 50) => axios.get(`/scores/ranking?page=${page}&limit=${limit}`),
  getMyScores: () => axios.get('/scores/my'),

  // Payment Methods (Cards)
  getCards: () => axios.get('/cards'),
  addCard: (cardNumber, cardholderName, expiryMonth, expiryYear, cvv) => 
    axios.post('/cards', { 
      card_number: cardNumber, 
      cardholder_name: cardholderName, 
      expiry_month: expiryMonth, 
      expiry_year: expiryYear, 
      cvv 
    }),
  deleteCard: (cardToken) => axios.delete(`/cards/${cardToken}`),

  // Shop & Transactions
  getShopItems: () => axios.get('/shop/items'),
  buyShopItem: (itemId) => axios.post('/shop/buy', { item_id: itemId }),
  getOwnedItems: () => axios.get('/shop/my-items'),
  buyTokens: (cardToken, packageName) => axios.post('/cards/purchase', { card_token: cardToken, package_name: packageName }),

  // Reports (PDF Downloads)
  downloadMyData: () => axios.get('/reports/my-data', { responseType: 'blob' }),
  downloadPlayerReport: (playerId) => axios.get(`/reports/player/${playerId}`, { responseType: 'blob' }),
  downloadGlobalReport: (dateFrom, dateTo) => 
    axios.get(`/reports/global?date_from=${dateFrom}&date_to=${dateTo}`, { responseType: 'blob' }),

  // Transactions & Spending History
  getTransactionHistory: () => axios.get('/cards/transactions'),
  getSpendingHistory: () => axios.get('/shop/spending'),

  // Admin Dashboard
  getPlayers: () => axios.get('/admin/players'),
  updatePlayerStatus: (playerId) => axios.patch(`/admin/players/${playerId}/status`),
  getAdminStats: () => axios.get('/admin/stats')
}
