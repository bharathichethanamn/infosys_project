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

  // Ensure app link opened directly ALWAYS requires explicit login or registration first
  useEffect(() => {
    localStorage.removeItem('maritime_user')
  }, [])

  const handleLogin = (user) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
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
    accounts.push(newUser)
    localStorage.setItem('maritime_demo_accounts', JSON.stringify(accounts))

    // Direct transition: New user -> Register -> Dashboard
    setCurrentUser(newUser)
    setIsAuthenticated(true)
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
