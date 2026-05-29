import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Game from './pages/Game'
import Shop from './pages/Shop'
import Profile from './pages/Profile'
import TransactionHistory from './pages/TransactionHistory'
import Dashboard from './pages/admin/Dashboard'

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          
          <div style={{ flexGrow: 1 }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Player Only Protected Routes */}
              <Route path="/game" element={
                <ProtectedRoute allowedRoles={['jugador']}>
                  <Game />
                </ProtectedRoute>
              } />
              
              <Route path="/shop" element={
                <ProtectedRoute allowedRoles={['jugador']}>
                  <Shop />
                </ProtectedRoute>
              } />

              <Route path="/transactions" element={
                <ProtectedRoute allowedRoles={['jugador']}>
                  <TransactionHistory />
                </ProtectedRoute>
              } />

              {/* General Protected Profile Route */}
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />

              {/* Technical Team Only Protected Route */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin_juego', 'moderador']}>
                  <Dashboard />
                </ProtectedRoute>
              } />

              {/* Fallback Route */}
              <Route path="*" element={<Home />} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
