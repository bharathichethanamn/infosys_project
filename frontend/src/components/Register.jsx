import React, { useState } from 'react'

function Register({ onRegisterSuccess, onBackToLogin }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')

  const handleRegister = (e) => {
    e.preventDefault()
    setError('')

    // Basic Validation
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.')
      return
    }

    const emailRegex = /\S+@\S+\.\S+/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password and Confirm Password must match.')
      return
    }

    // Call registration success callback
    onRegisterSuccess({
      email: email.trim().toLowerCase(),
      password: password,
      fullName: fullName.trim(),
      role: 'Registered Broker'
    })
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
          <h1 className="brand-title">Create Broker Account</h1>
          <p className="brand-subtitle">Join the Agentic Maritime Brokerage Ecosystem</p>
        </div>

        {/* Error Alert Banner */}
        {error && <div className="alert-banner alert-error">{error}</div>}

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="login-form">
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              className="form-control"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="name@company.com"
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
                placeholder="At least 6 characters"
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-group">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-login" style={{ marginTop: '0.5rem' }}>
            Create Account
          </button>
        </form>

        <div className="card-footer">
          <span>Already have an account? </span>
          <a href="#login" className="link-text highlighted" onClick={(e) => { e.preventDefault(); onBackToLogin(); }}>
            Back to Login
          </a>
        </div>
      </div>
    </div>
  )
}

export default Register
