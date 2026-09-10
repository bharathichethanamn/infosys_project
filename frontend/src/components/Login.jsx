import React, { useState, useEffect } from 'react'

function Login({ onLogin, onNavigateRegister, initialMessage, registeredUser }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState(initialMessage || '')

  useEffect(() => {
    if (registeredUser) {
      setEmail(registeredUser.email)
      setPassword(registeredUser.password)
    }
  }, [registeredUser])

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')

    const cleanEmail = email.trim().toLowerCase()

    // Retrieve dynamically registered demo accounts from state/localStorage
    const demoAccountsRaw = localStorage.getItem('maritime_demo_accounts')
    let demoAccounts = []
    if (demoAccountsRaw) {
      try {
        demoAccounts = JSON.parse(demoAccountsRaw)
      } catch (err) {}
    }

    // Default admin demo account
    const isAdmin = cleanEmail === 'admin@maritime.com' && password === 'admin123'
    const foundUser = demoAccounts.find(
      (acc) => acc.email.toLowerCase() === cleanEmail && acc.password === password
    )

    if (isAdmin) {
      onLogin({ email: 'admin@maritime.com', fullName: 'Maritime Admin', role: 'Maritime Broker Admin' }, rememberMe)
    } else if (foundUser) {
      onLogin({ email: foundUser.email, fullName: foundUser.fullName, role: 'Registered Broker' }, rememberMe)
    } else {
      setError('Invalid email or password. Please check your credentials.')
    }
  }

  const fillDemoCredentials = () => {
    setEmail('admin@maritime.com')
    setPassword('admin123')
    setError('')
    setInfoMessage('Demo credentials autofilled!')
  }

  const handleForgotPassword = (e) => {
    e.preventDefault()
    setInfoMessage('Password reset instructions have been sent to your email (Demo Mode).')
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Maritime Logo & Branding */}
        <div className="brand-header">
          <div className="ship-icon-badge">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.48 2.38 7" />
              <path d="M12 10V4.5" />
              <path d="M12 4.5 15.5 8" />
            </svg>
          </div>
          <h1 className="brand-title">Agentic Maritime Brokerage</h1>
          <p className="brand-subtitle">AI-Powered Maritime Freight Brokerage Platform</p>
        </div>

        {/* Demo Helper Banner */}
        <div className="demo-credentials-box">
          <div className="demo-info-text">
            <span>Demo Email: <strong>admin@maritime.com</strong></span>
            <span>Password: <strong>admin123</strong></span>
          </div>
          <button type="button" className="btn-auto-fill" onClick={fillDemoCredentials}>
            Auto-fill Credentials
          </button>
        </div>

        {/* Alert Banners */}
        {error && <div className="alert-banner alert-error">{error}</div>}
        {infoMessage && <div className="alert-banner alert-info">{infoMessage}</div>}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email / Username</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkbox-label">Remember me</span>
            </label>
            <a href="#forgot" className="link-text" onClick={handleForgotPassword}>
              Forgot Password?
            </a>
          </div>

          <button type="submit" className="btn-login">
            Login to Platform
          </button>
        </form>

        <div className="card-footer">
          <span>Don't have an account? </span>
          <a
            href="#signup"
            className="link-text highlighted"
            onClick={(e) => {
              e.preventDefault()
              onNavigateRegister()
            }}
          >
            Create Account
          </a>
        </div>
      </div>
    </div>
  )
}

export default Login
