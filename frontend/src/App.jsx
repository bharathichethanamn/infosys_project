import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentView, setCurrentView] = useState('login') // 'login', 'register'
  const [infoMessage, setInfoMessage] = useState('')
  const [registeredUser, setRegisteredUser] = useState(null)

  // Restore active login session on app load if saved in localStorage
  useEffect(() => {
    const savedUserRaw = localStorage.getItem('maritime_user')
    if (savedUserRaw) {
      try {
        const savedUser = JSON.parse(savedUserRaw)
        if (savedUser && savedUser.email) {
          setCurrentUser(savedUser)
          setIsAuthenticated(true)
        }
      } catch (e) {
        console.error('Error parsing stored user session:', e)
      }
    }
  }, [])

  const handleLogin = (user, remember = true) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
    if (remember) {
      localStorage.setItem('maritime_user', JSON.stringify(user))
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser(null)
    setCurrentView('login')
    setInfoMessage('')
    setRegisteredUser(null)
    localStorage.removeItem('maritime_user')
  }

  const handleRegisterSuccess = (newUser) => {
    // Save to demo accounts list in localStorage
    const existingRaw = localStorage.getItem('maritime_demo_accounts')
    let accounts = []
    if (existingRaw) {
      try {
        accounts = JSON.parse(existingRaw)
      } catch (e) {}
    }
    // Prevent duplicates
    const filtered = accounts.filter(acc => acc.email.toLowerCase() !== newUser.email.toLowerCase())
    filtered.push(newUser)
    localStorage.setItem('maritime_demo_accounts', JSON.stringify(filtered))

    // Direct transition: New user -> Register -> Dashboard
    setCurrentUser(newUser)
    setIsAuthenticated(true)
    localStorage.setItem('maritime_user', JSON.stringify(newUser))
  }

  return (
    <div className="app-root">
      {!isAuthenticated ? (
        currentView === 'register' ? (
          <Register
            onRegisterSuccess={handleRegisterSuccess}
            onBackToLogin={() => {
              setInfoMessage('')
              setCurrentView('login')
            }}
          />
        ) : (
          <Login
            onLogin={handleLogin}
            onNavigateRegister={() => {
              setInfoMessage('')
              setCurrentView('register')
            }}
            initialMessage={infoMessage}
            registeredUser={registeredUser}
          />
        )
      ) : (
        <Dashboard user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
