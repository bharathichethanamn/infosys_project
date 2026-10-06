import React, { useState } from 'react'

function Register({ onRegisterSuccess, onBackToLogin }) {
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [role, setRole] = useState('Customer')
  const [error, setError] = useState('')

  const handleRegister = (e) => {
    e.preventDefault()
    setError('')

    // Profile validation: all fields required
    if (
      !fullName.trim() ||
      !companyName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError('All profile fields are required.')
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

    // Check duplicate account
    const cleanEmail = email.trim().toLowerCase()
    const demoAccountsRaw = localStorage.getItem('maritime_demo_accounts')
    let accounts = []
    if (demoAccountsRaw) {
      try {
        accounts = JSON.parse(demoAccountsRaw)
      } catch (err) {}
    }
    const isDuplicate = accounts.some(acc => acc.email.toLowerCase() === cleanEmail) ||
      cleanEmail === 'admin@maritime.com' || cleanEmail === 'customer@maritime.com'

    if (isDuplicate) {
      setError('An account with this email address already exists. Please log in.')
      return
    }

    // Call registration success callback with complete user profile record
    const cleanRole = role === 'Broker' || role === 'Registered Broker' ? 'Broker' : 'Customer'
    const newUserId = cleanRole === 'Customer'
      ? `CUST-${Math.floor(10000 + Math.random() * 90000)}`
      : `BRK-${Math.floor(1000 + Math.random() * 9000)}`

    const newUser = {
      id: newUserId,
      fullName: fullName.trim(),
      companyName: companyName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      address: address.trim(),
      password: password,
      role: cleanRole
    }

    onRegisterSuccess(newUser)
  }

  return (
    <div className="login-wrapper" style={{ padding: '1.5rem 0' }}>
      <div className="login-card" style={{ maxWidth: '520px', width: '95%' }}>
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
          <h1 className="brand-title">Create Account</h1>
          <p className="brand-subtitle">Join the Agentic Maritime Freight SaaS Platform</p>
        </div>

        {/* Error Alert Banner */}
        {error && <div className="alert-banner alert-error">{error}</div>}

        {/* Registration Form */}
        <form onSubmit={handleRegister} className="login-form">
          <div className="form-group">
            <label htmlFor="role">Account Type (Role)</label>
            <select
              id="role"
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="Customer">Customer (Importer / Exporter)</option>
              <option value="Broker">Broker (Freight Broker / Agent)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                className="form-control"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="companyName">Company Name</label>
              <input
                id="companyName"
                type="text"
                className="form-control"
                placeholder="Global Freight Inc"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
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
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="text"
              className="form-control"
              placeholder="+1 (555) 019-2831"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              type="text"
              className="form-control"
              placeholder="100 Harbor Blvd, Suite 200"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
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
            Register Account
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
