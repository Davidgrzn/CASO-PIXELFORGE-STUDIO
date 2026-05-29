import React, { createContext, useState, useEffect, useContext } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

// Configure default axios properties globally
axios.defaults.baseURL = '/api'
axios.defaults.withCredentials = true

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [partialToken, setPartialToken] = useState(null) // Only in-memory (XSS protection!)

  const loadCurrentUser = async () => {
    const response = await axios.get('/auth/me')
    setUser(response.data)
    return response.data
  }

  const fetchUser = async () => {
    try {
      return await loadCurrentUser()
    } catch (error) {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const login = async (identifier, password) => {
    setLoading(true)
    try {
      const response = await axios.post('/auth/login', { identifier, password })
      if (response.data.requires_mfa) {
        // Step 1 successful, MFA required
        setPartialToken(response.data.partial_token)
        setLoading(false)
        return {
          mfaRequired: true,
          partialToken: response.data.partial_token,
          mfaMethod: response.data.mfa_method || 'totp'
        }
      } else {
        // Full login successful
        const profile = await loadCurrentUser()
        setPartialToken(null)
        setLoading(false)
        return { mfaRequired: false, user: profile }
      }
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const verifyMFA = async (code, inMemoryToken) => {
    setLoading(true)
    const tokenToUse = inMemoryToken || partialToken
    try {
      await axios.post(
        '/mfa/verify', 
        { code },
        {
          headers: {
            Authorization: `Bearer ${tokenToUse}`
          }
        }
      )
      const profile = await loadCurrentUser()
      setPartialToken(null)
      setLoading(false)
      return profile
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const register = async (username, email, password) => {
    setLoading(true)
    try {
      const response = await axios.post('/auth/register', { username, email, password })
      setLoading(false)
      return response.data
    } catch (error) {
      setLoading(false)
      throw error
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await axios.post('/auth/logout')
    } catch (error) {
      console.error('Logout error', error)
    } finally {
      setUser(null)
      setPartialToken(null)
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      partialToken,
      login,
      logout,
      register,
      verifyMFA,
      fetchUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
