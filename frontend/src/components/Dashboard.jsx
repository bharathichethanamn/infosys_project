import React, { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'

function Dashboard({ user, onLogout }) {
  const [backendStatus, setBackendStatus] = useState({ connected: false, message: 'Connecting...' })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [shipmentTabFilter, setShipmentTabFilter] = useState('all')

  const [formData, setFormData] = useState({
    origin: 'Chennai',
    destination: 'Rotterdam',
    cargo_type: 'Electronics',
    containers: 10
  })

  // Restore latest analysis from localStorage or initialize to null
  const [apiResult, setApiResult] = useState(() => {
    try {
      const saved = localStorage.getItem('maritime_latest_analysis')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Report Export Loading & Toast States
  const [reportLoading, setReportLoading] = useState({ pdf: false, csv: false })
  const [reportToast, setReportToast] = useState('')

  // AI Agent Processing State
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(1)

  // Shipment History state stored in localStorage
  const [shipmentHistory, setShipmentHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('maritime_shipment_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Modal State for "View Details"
  const [selectedShipmentModal, setSelectedShipmentModal] = useState(null)

  const API_URL = 'http://127.0.0.1:8000'

  useEffect(() => {
    fetch(API_URL + '/')
      .then(res => res.json())
      .then(data => {
        setBackendStatus({ connected: true, message: data.message })
      })
      .catch(() => {
        setBackendStatus({ connected: false, message: 'Backend Offline' })
      })

    // Pre-load initial route analysis silently if no saved analysis exists
    const savedAnalysis = localStorage.getItem('maritime_latest_analysis')
    if (!savedAnalysis) {
      triggerRouteAnalysis({
        origin: 'Chennai',
        destination: 'Rotterdam',
        cargo_type: 'Electronics',
        containers: 10
      }, false, false)
    }
  }, [])

  // Persist latest analysis to localStorage whenever apiResult updates
  useEffect(() => {
    if (apiResult) {
      try {
        localStorage.setItem('maritime_latest_analysis', JSON.stringify(apiResult))
      } catch (e) {
        console.error('Failed to save latest analysis:', e)
      }
    }
  }, [apiResult])

  // Save shipmentHistory to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('maritime_shipment_history', JSON.stringify(shipmentHistory))
    } catch (e) {
      console.error('Failed to save shipment history:', e)
    }
  }, [shipmentHistory])

  const triggerRouteAnalysis = async (dataToSubmit, saveToHistory = true, animateSteps = true) => {
    setLoading(true)
    setError('')

    if (animateSteps) {
      setIsProcessing(true)
      setProcessingStep(1)
    }

    try {
      // Step 1: Request Received
      if (animateSteps) {
        await new Promise(r => setTimeout(r, 450))
        setProcessingStep(2)
      }

      const res = await fetch(`${API_URL}/api/routes/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      })

      if (animateSteps) {
        // Step 3: Candidate Evaluation
        setProcessingStep(3)
        await new Promise(r => setTimeout(r, 500))
        // Step 4: Best Route Selection
        setProcessingStep(4)
        await new Promise(r => setTimeout(r, 450))
      }

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`)
      }

      const data = await res.json()
      setApiResult(data)

      if (data && data.matched === false) {
        setError(data.message || 'No matching routes found for this corridor.')
      } else if (data && data.matched && data.best_route && saveToHistory) {
        const newRecord = {
          id: `SHP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          timestamp: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          origin: data.query.origin,
          destination: data.query.destination,
          cargo_type: data.query.cargo_type,
          containers: data.query.containers,
          best_route: data.best_route.route_name,
          transit_days: `${data.best_route.transit_days} Days`,
          route_score: data.best_route.route_score,
          status: 'Completed',
          full_result: data
        }

        setShipmentHistory(prev => [newRecord, ...prev])
      }
    } catch (err) {
      setError(`Failed to analyze route: ${err.message || 'Backend API error'}`)
    } finally {
      setLoading(false)
      if (animateSteps) {
        setTimeout(() => setIsProcessing(false), 300)
      }
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'containers' ? parseInt(value) || 0 : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setActiveTab('route-intelligence')
    triggerRouteAnalysis(formData, true, true)
  }

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all shipment history?')) {
      setShipmentHistory([])
      localStorage.removeItem('maritime_shipment_history')
    }
  }

  // PDF Report Generation Handler
  const handleDownloadPDF = () => {
    if (!apiResult || !apiResult.best_route) {
      alert('No Route Analysis Available. Please analyze a route in Route Intelligence first.')
      return
    }

    setReportLoading(prev => ({ ...prev, pdf: true }))

    try {
      const doc = new jsPDF()
      const best = apiResult.best_route
      const query = apiResult.query

      // Header Banner - Deep Navy (#062B49)
      doc.setFillColor(6, 43, 73)
      doc.rect(0, 0, 210, 38, 'F')

      // White Title Text
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('AGENTIC MARITIME BROKERAGE', 14, 16)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(32, 196, 217) // #20C4D9 Cyan accent
      doc.text('MARITIME FREIGHT ROUTE ANALYSIS REPORT', 14, 25)

      doc.setTextColor(226, 232, 240)
      doc.setFontSize(8)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 25)

      let y = 48

      // Section 1: Query Parameters Box
      doc.setFillColor(242, 249, 251) // Light Cyan Fill
      doc.rect(14, y, 182, 34, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.rect(14, y, 182, 34, 'S')

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('1. SHIPMENT QUERY PARAMETERS', 18, y + 8)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
      doc.text(`Origin Port: ${query.origin}`, 18, y + 17)
      doc.text(`Destination Port: ${query.destination}`, 105, y + 17)
      doc.text(`Cargo Type: ${query.cargo_type}`, 18, y + 26)
      doc.text(`Container Load: ${query.containers} TEU`, 105, y + 26)

      y += 42

      // Section 2: Best Route Recommended Banner
      doc.setFillColor(254, 243, 199) // Soft Gold Fill
      doc.rect(14, y, 182, 54, 'F')
      doc.setDrawColor(245, 166, 35)
      doc.rect(14, y, 182, 54, 'S')

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(146, 64, 14) // Dark Gold
      doc.text(`2. RECOMMENDED BEST ROUTE: ${best.route_name}`, 18, y + 8)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(217, 119, 6)
      doc.text(`Route Score: ${best.route_score} / 100`, 145, y + 8)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(15, 139, 141)
      doc.text(`Ocean Corridor: ${best.ocean_corridor}`, 18, y + 17)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text(`Transit Time: ${best.transit_days} Days`, 18, y + 26)
      doc.text(`Nautical Distance: ${best.distance_nautical_miles.toLocaleString()} NM`, 75, y + 26)
      doc.text(`Transshipments: ${best.transshipments === 0 ? '0 (Direct)' : best.transshipments}`, 145, y + 26)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      doc.text(`Chokepoints: ${best.primary_chokepoints || 'N/A'}`, 18, y + 35)
      doc.text(`Reliability Rating: ${best.reliability_rating}%`, 145, y + 35)

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(71, 85, 105)
      doc.text(`Selection Reason: ${best.selection_reason || 'Optimal balance of transit speed and sea reliability.'}`, 18, y + 45)

      y += 62

      // Section 3: Available Route Candidates Table
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('3. CANDIDATE OCEAN ROUTES COMPARISON', 14, y)

      y += 6

      doc.setFillColor(7, 59, 92)
      doc.rect(14, y, 182, 7, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('Route Name', 16, y + 5)
      doc.text('Transit', 75, y + 5)
      doc.text('Distance', 100, y + 5)
      doc.text('Stops', 130, y + 5)
      doc.text('Score', 152, y + 5)
      doc.text('Status', 174, y + 5)

      y += 7

      const routes = apiResult.available_routes || []
      routes.forEach((r, idx) => {
        const isBest = r.route_id === best.route_id
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252)
          doc.rect(14, y, 182, 7, 'F')
        }
        doc.setDrawColor(226, 232, 240)
        doc.line(14, y + 7, 196, y + 7)

        doc.setFontSize(8)
        doc.setFont('helvetica', isBest ? 'bold' : 'normal')
        doc.setTextColor(6, 43, 73)
        doc.text(String(r.route_name).substring(0, 30), 16, y + 5)
        doc.text(`${r.transit_days} Days`, 75, y + 5)
        doc.text(`${r.distance_nautical_miles.toLocaleString()} NM`, 100, y + 5)
        doc.text(`${r.transshipments} Stop`, 130, y + 5)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(isBest ? 217 : 30, isBest ? 119 : 41, isBest ? 6 : 59)
        doc.text(`${r.route_score}/100`, 152, y + 5)
        doc.setTextColor(isBest ? 5 : 71, isBest ? 150 : 85, isBest ? 105 : 105)
        doc.text(isBest ? 'Best Choice' : 'Alternative', 174, y + 5)

        y += 7
      })

      // Footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('Agentic AI Maritime Freight System • Confidential & Proprietary Report', 14, 285)
      doc.text('Page 1 of 1', 180, 285)

      doc.save(`Maritime_Route_Analysis_${query.origin}_to_${query.destination}.pdf`)
      setReportToast('✅ Route Analysis PDF downloaded successfully!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      alert(`Failed to generate PDF: ${err.message}`)
    } finally {
      setReportLoading(prev => ({ ...prev, pdf: false }))
    }
  }

  // CSV Report Export Handler
  const handleExportCSV = () => {
    setReportLoading(prev => ({ ...prev, csv: true }))

    try {
      let rows = []

      if (shipmentHistory && shipmentHistory.length > 0) {
        rows = shipmentHistory.map(item => ({
          Shipment_ID: item.id,
          Date_Time: item.timestamp,
          Origin: item.origin,
          Destination: item.destination,
          Cargo_Type: item.cargo_type,
          Containers_TEU: item.containers,
          Selected_Route: item.best_route,
          Transit_Days: item.transit_days,
          Route_Score: item.route_score,
          Status: item.status
        }))
      } else if (apiResult && apiResult.available_routes) {
        rows = apiResult.available_routes.map(r => ({
          Shipment_ID: `QUERY-${apiResult.query.origin.substring(0,3).toUpperCase()}-${apiResult.query.destination.substring(0,3).toUpperCase()}`,
          Date_Time: new Date().toLocaleString(),
          Origin: apiResult.query.origin,
          Destination: apiResult.query.destination,
          Cargo_Type: apiResult.query.cargo_type,
          Containers_TEU: apiResult.query.containers,
          Selected_Route: r.route_name,
          Transit_Days: `${r.transit_days} Days`,
          Route_Score: r.route_score,
          Status: r.route_id === apiResult.best_route?.route_id ? 'Recommended' : 'Alternative'
        }))
      }

      if (rows.length === 0) {
        alert('No Route Analysis or Shipment History Available to export.')
        return
      }

      const headers = Object.keys(rows[0]).join(',')
      const csvContent = [
        headers,
        ...rows.map(r => Object.values(r).map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      const filename = `Maritime_Shipment_Performance_${new Date().toISOString().slice(0, 10)}.csv`
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setReportToast('✅ Shipment Performance CSV exported successfully!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      alert(`Failed to export CSV: ${err.message}`)
    } finally {
      setReportLoading(prev => ({ ...prev, csv: false }))
    }
  }

  // Dynamic KPI Helpers
  const totalRoutesCount = apiResult ? (apiResult.matching_count || 71) : 71
  const activeShipmentsCount = shipmentHistory.length > 0 ? shipmentHistory.length : 4
  const bestScore = apiResult?.best_route ? `${apiResult.best_route.route_score}/100` : '91/100'
  const fastestTransit = apiResult?.best_route ? `${apiResult.best_route.transit_days} Days` : '10 Days'
  const hasAnalysisData = Boolean(apiResult && apiResult.matched && apiResult.best_route) || shipmentHistory.length > 0

  // Filtered History for Shipments tab
  const filteredShipments = shipmentHistory.filter(item => {
    if (shipmentTabFilter === 'completed') return item.status === 'Completed'
    if (shipmentTabFilter === 'active') return item.status === 'In Progress' || item.status === 'Completed'
    if (shipmentTabFilter === 'pending') return item.status === 'Pending'
    return true
  })

  return (
    <div className="ocean-app-shell">
      {/* 1. DEEP OCEAN NAVY SIDEBAR (#062B49) */}
      <aside className="ocean-sidebar">
        <div className="sidebar-top">
          {/* BRAND LOGO */}
          <div className="sidebar-brand">
            <div className="brand-logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.48 2.38 7" />
                <path d="M12 10V4.5" />
                <path d="M12 4.5 15.5 8" />
              </svg>
            </div>
            <div className="brand-text-block">
              <span className="brand-title-main">Maritime AI</span>
              <span className="brand-tagline">Logistics SaaS</span>
            </div>
          </div>

          {/* NAVIGATION MENU */}
          <nav className="sidebar-menu">
            <button
              className={`menu-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </span>
              <span className="menu-label">Dashboard</span>
            </button>

            <button
              className={`menu-link ${activeTab === 'route-intelligence' ? 'active' : ''}`}
              onClick={() => setActiveTab('route-intelligence')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              </span>
              <span className="menu-label">Route Intelligence</span>
            </button>

            <button
              className={`menu-link ${activeTab === 'shipments' ? 'active' : ''}`}
              onClick={() => setActiveTab('shipments')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.48 2.38 7"/></svg>
              </span>
              <span className="menu-label">Shipments</span>
              <span className="badge-count-pill">{activeShipmentsCount}</span>
            </button>

            <button
              className={`menu-link ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </span>
              <span className="menu-label">Reports</span>
            </button>

            <button
              className={`menu-link ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </span>
              <span className="menu-label">Analytics</span>
            </button>

            <button
              className={`menu-link ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              <span className="menu-label">Settings</span>
            </button>
          </nav>
        </div>

        {/* BOTTOM SIDEBAR OCEAN GRAPHIC */}
        <div className="sidebar-bottom-ocean">
          <div className="ocean-graphic-icon">
            <span className="leaf-badge">🌿</span>
          </div>
          <div className="ocean-slogan-text">
            <span>Cleaner Oceans</span>
            <span>Stronger Trade</span>
            <span>Brighter Tomorrow</span>
          </div>
          <div className="sidebar-wave-svg">
            <svg width="100%" height="24" viewBox="0 0 200 24" fill="none">
              <path d="M0 12 Q50 4 100 12 T200 12" stroke="#20C4D9" strokeWidth="1.5" opacity="0.4" fill="none"/>
              <path d="M0 18 Q50 10 100 18 T200 18" stroke="#0F8B8D" strokeWidth="1.2" opacity="0.3" fill="none"/>
            </svg>
          </div>
        </div>
      </aside>

      {/* MAIN LAYOUT CANVAS */}
      <div className="ocean-main-canvas">

        {/* 2. HEADER */}
        <header className="ocean-global-header">
          <div className="header-left-brand">
            <div className="header-ship-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#20C4D9" strokeWidth="2.2">
                <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
                <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.48 2.38 7" />
              </svg>
            </div>
            <div>
              <h1 className="header-app-title">Agentic AI for Maritime Freight</h1>
              <p className="header-app-subtitle">Pricing & Route Optimization</p>
            </div>
          </div>

          {/* CENTER SEARCH BAR */}
          <div className="header-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search routes, shipments, ports..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* RIGHT ACTION ITEMS */}
          <div className="header-right-actions">
            <div className="status-pill-green">
              <span className="dot-green"></span>
              <span>Route Agent: <strong>Active</strong></span>
            </div>

            <div className="user-profile-chip">
              <span className="user-avatar">👤</span>
              <div className="user-info">
                <span className="user-email">{user?.email || 'admin@maritime.com'}</span>
                <span className="user-role">Broker Admin</span>
              </div>
            </div>

            <div className="header-motto-pill">
              <span>Safer Seas • Smarter Trade • Brighter Tomorrow</span>
            </div>

            <button className="btn-logout-pill" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {/* CONTENT BODY */}
        <main className="ocean-content-body">

          {/* =================================================================
             PAGE 1: MAIN DASHBOARD VIEW (activeTab === 'dashboard')
             ================================================================= */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-page-view">

              {/* 3. WELCOME HERO BANNER */}
              <div className="ocean-hero-banner" style={{ backgroundImage: `url('/images/hero_banner.png')` }}>
                <div className="hero-banner-overlay"></div>
                <div className="hero-left-content">
                  <h2>Welcome back, Maritime Specialist</h2>
                  <p>Navigating smarter routes for a cleaner, connected world.</p>
                </div>
                <div className="hero-right-content">
                  <span>GLOBAL TRADE</span>
                  <strong>A CLEANER TOMORROW</strong>
                </div>
              </div>

              {/* 4. KPI CARDS ROW (4 CARDS) */}
              <section className="kpi-cards-grid">
                {/* CARD 1: Total Routes Analyzed */}
                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                    </div>
                    <span className="kpi-trend-pill green">↑ 12% vs last week</span>
                  </div>
                  <div className="kpi-label">Total Routes Analyzed</div>
                  <div className="kpi-main-val">{totalRoutesCount}</div>
                  <div className="kpi-sub-text">Ocean corridors processed</div>
                </div>

                {/* CARD 2: Active Shipments */}
                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle orange">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    </div>
                    <span className="kpi-trend-pill blue">Active Session</span>
                  </div>
                  <div className="kpi-label">Active Shipments</div>
                  <div className="kpi-main-val">{activeShipmentsCount}</div>
                  <div className="kpi-sub-row">
                    <span>Logged in history</span>
                    <svg width="48" height="16" viewBox="0 0 48 16" fill="none"><path d="M0 12 Q12 4 24 10 T48 6" stroke="#20C4D9" strokeWidth="2" fill="none"/></svg>
                  </div>
                </div>

                {/* CARD 3: Best Route Score (GOLD HIGHLIGHT) */}
                <div className="kpi-card highlight-gold-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                    <span className="kpi-trend-pill gold">Optimal Score</span>
                  </div>
                  <div className="kpi-label">Best Route Score</div>
                  <div className="kpi-main-val gold-val">{bestScore}</div>
                  <div className="kpi-sub-row">
                    <span>Highest recommendation</span>
                    <svg width="48" height="16" viewBox="0 0 48 16" fill="none"><path d="M0 14 Q12 4 24 8 T48 2" stroke="#F5A623" strokeWidth="2" fill="none"/></svg>
                  </div>
                </div>

                {/* CARD 4: Average Transit Time */}
                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle blue">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5D7A" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <span className="kpi-trend-pill green">Fastest Transit</span>
                  </div>
                  <div className="kpi-label">Average Transit Time</div>
                  <div className="kpi-main-val">{fastestTransit}</div>
                  <div className="kpi-sub-row">
                    <span>Sea transit duration</span>
                    <svg width="48" height="16" viewBox="0 0 48 16" fill="none"><path d="M0 10 Q12 2 24 12 T48 4" stroke="#18A66A" strokeWidth="2" fill="none"/></svg>
                  </div>
                </div>
              </section>

              {/* 5. MAIN DASHBOARD GRID: GLOBAL MARITIME INTELLIGENCE + AI AGENTS */}
              <div className="dashboard-main-grid">

                {/* GLOBAL MARITIME INTELLIGENCE PANEL */}
                <div className="ocean-card global-intelligence-panel">
                  <div className="card-header-between">
                    <div>
                      <h3 className="card-title">Global Maritime Intelligence</h3>
                      <p className="card-subtitle">Real-time insights. Safer routes. A healthier ocean.</p>
                    </div>
                    <select className="select-corridor-filter">
                      <option>All Routes</option>
                      <option>Asia → Europe (Suez)</option>
                      <option>Transpacific</option>
                    </select>
                  </div>

                  {/* RICH OCEAN VISUAL INTELLIGENCE CONTAINER */}
                  <div className="intelligence-visual-container" style={{ backgroundImage: `url('/images/lighthouse_ocean.png')` }}>
                    <div className="visual-gradient-overlay"></div>

                    {/* 6 FLOATING CATEGORIES ROW */}
                    <div className="intelligence-categories-row">
                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/><circle cx="12" cy="12" r="10"/></svg></div>
                        <span>Route Optimization</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                        <span>Risk Assessment</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                        <span>Cost Intelligence</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.1 2 7 0 6-4.5 11-10 11z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div>
                        <span>Emission Insights</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg></div>
                        <span>Port Analytics</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg></div>
                        <span>Weather Awareness</span>
                      </div>
                    </div>

                    {/* CENTER AI INSIGHT BOX & BUTTON */}
                    <div className="ai-insight-quote-box">
                      <p className="quote-text">
                        "Leveraging global data and AI to recommend the most efficient, cost-effective and sustainable maritime routes."
                      </p>
                      <button className="btn-explore-orange" onClick={() => setActiveTab('route-intelligence')}>
                        Explore Route Intelligence →
                      </button>
                    </div>

                    {/* RIGHT COLUMN STAT OVERLAY */}
                    <div className="right-stats-overlay">
                      <div className="stat-item">
                        <span className="stat-icon">🌐</span>
                        <div className="stat-text">
                          <strong>50+</strong>
                          <span>Global Ports</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">🔀</span>
                        <div className="stat-text">
                          <strong>6</strong>
                          <span>Major Trade Corridors</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">🌿</span>
                        <div className="stat-text">
                          <strong>-28%</strong>
                          <span>Estimated CO₂ Emissions</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">🛡️</span>
                        <div className="stat-text">
                          <strong>95%</strong>
                          <span>On-Time Reliability</span>
                        </div>
                      </div>
                    </div>

                    {/* BOTTOM RIGHT DECORATIVE OCEAN TEXT */}
                    <div className="bottom-right-decorative">
                      <span className="script-text">Beyond Boundaries</span>
                      <span className="sub-script-text">For a Cleaner Ocean</span>
                      <svg width="80" height="12" viewBox="0 0 80 12" fill="none">
                        <path d="M0 6 Q20 0 40 6 T80 6" stroke="#20C4D9" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 6. AI AGENTS PANEL */}
                <div className="ocean-card ai-agents-panel">
                  <div className="card-header-block">
                    <h3 className="card-title">AI Agents</h3>
                    <p className="card-subtitle">Specialized agents working together for smarter logistics.</p>
                  </div>

                  <div className="agents-vertical-list">
                    <div className="agent-card-row active">
                      <div className="agent-icon-box cyan">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/><circle cx="12" cy="12" r="10"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Route Agent</strong>
                          <span className="status-tag green">● Active ›</span>
                        </div>
                        <p>Route analysis and optimization</p>
                      </div>
                    </div>

                    <div className="agent-card-row future">
                      <div className="agent-icon-box orange">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Pricing Agent</strong>
                          <span className="status-tag gray">● Future ›</span>
                        </div>
                        <p>Freight rate calculation and quotation</p>
                      </div>
                    </div>

                    <div className="agent-card-row future">
                      <div className="agent-icon-box blue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5D7A" strokeWidth="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Weather Agent</strong>
                          <span className="status-tag gray">● Future ›</span>
                        </div>
                        <p>Weather and sea condition analysis</p>
                      </div>
                    </div>

                    <div className="agent-card-row future">
                      <div className="agent-icon-box cyan">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#20C4D9" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Margin Agent</strong>
                          <span className="status-tag gray">● Future ›</span>
                        </div>
                        <p>Margin optimization</p>
                      </div>
                    </div>

                    <div className="agent-card-row future">
                      <div className="agent-icon-box gray">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Customs Agent</strong>
                          <span className="status-tag gray">● Future ›</span>
                        </div>
                        <p>Customs and compliance</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RECENT ROUTE ANALYSES TABLE & QUICK ACTIONS ROW */}
              <div className="dashboard-bottom-grid">

                {/* RECENT ROUTE ANALYSES TABLE */}
                <div className="ocean-card recent-table-card">
                  <div className="card-header-between">
                    <h3 className="card-title">Recent Route Analyses</h3>
                    <button className="btn-link-action" onClick={() => setActiveTab('shipments')}>
                      View All →
                    </button>
                  </div>

                  {shipmentHistory.length > 0 ? (
                    <div className="table-responsive">
                      <table className="ocean-data-table">
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Origin → Destination</th>
                            <th>Cargo Type</th>
                            <th>Containers</th>
                            <th>Best Route</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shipmentHistory.slice(0, 5).map((item) => (
                            <tr key={item.id}>
                              <td className="td-muted">{item.timestamp}</td>
                              <td className="td-bold">{item.origin} ➔ {item.destination}</td>
                              <td>{item.cargo_type}</td>
                              <td className="td-bold">{item.containers} TEU</td>
                              <td><strong>{item.best_route}</strong></td>
                              <td className="td-score">{item.route_score}/100</td>
                              <td><span className="pill-status green">Completed</span></td>
                              <td>
                                <button className="btn-table-sm" onClick={() => setSelectedShipmentModal(item)}>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state-box">
                      <p>No recent analysis logs. Click <strong>Analyze New Route</strong> to test the Route Agent.</p>
                    </div>
                  )}
                </div>

                {/* QUICK ACTIONS CARD */}
                <div className="ocean-card quick-actions-card">
                  <h3 className="card-title" style={{ marginBottom: '1rem' }}>Quick Actions</h3>
                  <div className="quick-actions-grid">
                    <button className="action-tile" onClick={() => setActiveTab('route-intelligence')}>
                      <span className="tile-icon">🚀</span>
                      <strong>Analyze New Route</strong>
                      <span className="tile-sub">Find optimal routes</span>
                    </button>

                    <button className="action-tile" onClick={() => setActiveTab('shipments')}>
                      <span className="tile-icon">🚢</span>
                      <strong>Manage Shipments</strong>
                      <span className="tile-sub">View and track shipments</span>
                    </button>

                    <button className="action-tile" onClick={() => setActiveTab('reports')}>
                      <span className="tile-icon">📋</span>
                      <strong>Generate Reports</strong>
                      <span className="tile-sub">Create detailed reports</span>
                    </button>

                    <button className="action-tile" onClick={() => setActiveTab('analytics')}>
                      <span className="tile-icon">📈</span>
                      <strong>View Analytics</strong>
                      <span className="tile-sub">Explore insights</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =================================================================
             PAGE 2: ROUTE INTELLIGENCE PAGE (activeTab === 'route-intelligence')
             ================================================================= */}
          {activeTab === 'route-intelligence' && (
            <div className="route-intelligence-page">
              <div className="page-header-banner">
                <h2 className="page-title">Route Intelligence</h2>
                <p className="page-subtitle">AI-powered maritime route analysis and optimization</p>
              </div>

              {/* SHIPMENT REQUEST FORM CARD */}
              <div className="ocean-card form-section-card">
                <h3 className="card-title" style={{ marginBottom: '1rem' }}>Shipment Request</h3>

                <form onSubmit={handleSubmit} className="route-query-form">
                  <div className="form-fields-grid">
                    <div className="form-field">
                      <label>Origin Port / City</label>
                      <select name="origin" value={formData.origin} onChange={handleChange} className="form-control" required>
                        <option value="Chennai">Chennai (India)</option>
                        <option value="Shanghai">Shanghai (China)</option>
                        <option value="Singapore">Singapore (Singapore)</option>
                        <option value="Mumbai">Mumbai (India)</option>
                        <option value="Ningbo">Ningbo (China)</option>
                        <option value="Busan">Busan (South Korea)</option>
                        <option value="Tokyo">Tokyo (Japan)</option>
                        <option value="Dubai">Dubai (UAE)</option>
                        <option value="Hong Kong">Hong Kong (China)</option>
                        <option value="Colombo">Colombo (Sri Lanka)</option>
                        <option value="Yokohama">Yokohama (Japan)</option>
                        <option value="Salalah">Salalah (Oman)</option>
                        <option value="Klang">Klang (Malaysia)</option>
                        <option value="Qingdao">Qingdao (China)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Destination Port / City</label>
                      <select name="destination" value={formData.destination} onChange={handleChange} className="form-control" required>
                        <option value="Rotterdam">Rotterdam (Netherlands)</option>
                        <option value="Los Angeles">Los Angeles (USA)</option>
                        <option value="Hamburg">Hamburg (Germany)</option>
                        <option value="Felixstowe">Felixstowe (UK)</option>
                        <option value="New York">New York (USA)</option>
                        <option value="Singapore">Singapore (Singapore)</option>
                        <option value="Sydney">Sydney (Australia)</option>
                        <option value="Antwerp">Antwerp (Belgium)</option>
                        <option value="Vancouver">Vancouver (Canada)</option>
                        <option value="Genoa">Genoa (Italy)</option>
                        <option value="Melbourne">Melbourne (Australia)</option>
                        <option value="Santos">Santos (Brazil)</option>
                        <option value="Bremerhaven">Bremerhaven (Germany)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Cargo Type</label>
                      <select name="cargo_type" value={formData.cargo_type} onChange={handleChange} className="form-control" required>
                        <option value="Electronics">Electronics</option>
                        <option value="Machinery">Machinery</option>
                        <option value="Textiles">Textiles</option>
                        <option value="Food Products">Food Products</option>
                        <option value="General Cargo">General Cargo</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Number of Containers (TEU)</label>
                      <input type="number" name="containers" min="1" value={formData.containers} onChange={handleChange} className="form-control" required />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary-teal" disabled={loading || isProcessing}>
                    {isProcessing ? 'Analyzing Route...' : '🚀 Analyze Route'}
                  </button>
                </form>
              </div>

              {/* AI ROUTE AGENT STEP-BY-STEP PROCESSING ANIMATION */}
              {isProcessing && (
                <div className="ocean-card ai-processing-card">
                  <div className="processing-header">
                    <span className="badge-ai-pulsing">🤖 AI Route Agent Active</span>
                    <h3>AI Route Agent Processing</h3>
                    <p>Analyzing your shipment and evaluating the best maritime routes...</p>
                  </div>

                  <div className="processing-steps-container">
                    <div className={`step-row ${processingStep >= 1 ? 'active' : ''}`}>
                      <span className="step-num">{processingStep > 1 ? '✓' : '1'}</span>
                      <div className="step-info">
                        <strong>1. Shipment Request Received</strong>
                        <span>Validating shipment parameters & cargo requirements</span>
                      </div>
                      <span className="step-status">{processingStep > 1 ? 'Completed' : 'Processing...'}</span>
                    </div>

                    <div className={`step-row ${processingStep >= 2 ? 'active' : ''}`}>
                      <span className="step-num">{processingStep > 2 ? '✓' : '2'}</span>
                      <div className="step-info">
                        <strong>2. Maritime Dataset Analysis</strong>
                        <span>Scanning ocean corridor distance & transshipment data</span>
                      </div>
                      <span className="step-status">{processingStep > 2 ? 'Completed' : processingStep === 2 ? 'Processing...' : 'Waiting'}</span>
                    </div>

                    <div className={`step-row ${processingStep >= 3 ? 'active' : ''}`}>
                      <span className="step-num">{processingStep > 3 ? '✓' : '3'}</span>
                      <div className="step-info">
                        <strong>3. Route Candidate Evaluation</strong>
                        <span>Comparing transit days, chokepoints & reliability scores</span>
                      </div>
                      <span className="step-status">{processingStep > 3 ? 'Completed' : processingStep === 3 ? 'Processing...' : 'Waiting'}</span>
                    </div>

                    <div className={`step-row ${processingStep >= 4 ? 'active' : ''}`}>
                      <span className="step-num">4</span>
                      <div className="step-info">
                        <strong>4. Best Route Selection</strong>
                        <span>Selecting the optimal recommended maritime route</span>
                      </div>
                      <span className="step-status">{processingStep === 4 ? 'Finalizing...' : 'Waiting'}</span>
                    </div>
                  </div>

                  <div className="processing-progress-bar">
                    <div className="progress-fill" style={{ width: `${(processingStep / 4) * 100}%` }}></div>
                  </div>
                </div>
              )}

              {/* ROUTE ANALYSIS RESULT DISPLAY */}
              {!isProcessing && apiResult && apiResult.matched && apiResult.best_route && (
                <div className="route-results-section" style={{ marginTop: '1.5rem' }}>

                  {/* SUMMARY BAR */}
                  <div className="ocean-card summary-bar-card">
                    <div className="summary-title-label">Route Analysis Summary</div>
                    <div className="summary-items-row">
                      <div><span>Origin:</span> <strong>{apiResult.query.origin}</strong></div>
                      <div><span>Destination:</span> <strong>{apiResult.query.destination}</strong></div>
                      <div><span>Cargo:</span> <strong>{apiResult.query.cargo_type}</strong></div>
                      <div><span>Containers:</span> <strong>{apiResult.query.containers} TEU</strong></div>
                    </div>
                  </div>

                  {/* ⭐ BEST ROUTE RECOMMENDED BANNER */}
                  <div className="best-recommended-card">
                    <div className="best-top-bar">
                      <span className="gold-pill">⭐ BEST ROUTE RECOMMENDED</span>
                      <span className="score-gold-badge">Route Score: {apiResult.best_route.route_score} / 100</span>
                    </div>

                    <h3 className="best-route-title-text">{apiResult.best_route.route_name}</h3>
                    <p className="best-route-path-text">📍 {apiResult.best_route.ocean_corridor}</p>

                    <div className="three-metrics-grid">
                      <div className="metric-mini-box">
                        <span className="mm-label">TRANSIT TIME</span>
                        <span className="mm-val">{apiResult.best_route.transit_days} Days</span>
                      </div>
                      <div className="metric-mini-box">
                        <span className="mm-label">DISTANCE</span>
                        <span className="mm-val">{apiResult.best_route.distance_nautical_miles.toLocaleString()} NM</span>
                      </div>
                      <div className="metric-mini-box">
                        <span className="mm-label">TRANSSHIPMENTS</span>
                        <span className="mm-val">
                          {apiResult.best_route.transshipments === 0 ? '0 (Direct)' : `${apiResult.best_route.transshipments} Stop`}
                        </span>
                      </div>
                    </div>

                    <div className="why-box-container">
                      <h4 className="why-title-head">Why this route?</h4>
                      <p className="why-body-desc">{apiResult.best_route.selection_reason}</p>
                    </div>
                  </div>

                  {/* AVAILABLE ROUTES COMPARISON TABLE */}
                  <div className="ocean-card comparison-table-card" style={{ marginTop: '1.5rem' }}>
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Available Routes Comparison</h3>

                    <div className="table-responsive">
                      <table className="ocean-data-table">
                        <thead>
                          <tr>
                            <th>Route</th>
                            <th>Route Path</th>
                            <th>Transit Time</th>
                            <th>Distance</th>
                            <th>Transshipments</th>
                            <th>Score</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apiResult.available_routes.map((route) => {
                            const isBest = route.route_id === apiResult.best_route.route_id
                            return (
                              <tr key={route.route_id} className={isBest ? 'best-choice-row' : ''}>
                                <td>
                                  <strong>{route.route_name}</strong>
                                  <span className="sub-id">{route.route_id}</span>
                                </td>
                                <td className="td-muted">{route.ocean_corridor}</td>
                                <td className="td-bold">{route.transit_days} Days</td>
                                <td className="td-bold">{route.distance_nautical_miles.toLocaleString()} NM</td>
                                <td>
                                  {route.transshipments === 0 ? '0 (Direct)' : `${route.transshipments} (${route.transshipment_ports})`}
                                </td>
                                <td className="td-score">{route.route_score} / 100</td>
                                <td>
                                  {isBest ? (
                                    <span className="pill-status green">Best Choice</span>
                                  ) : (
                                    <span className="pill-status teal">Alternative</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* =================================================================
             PAGE 3: SHIPMENTS PAGE (activeTab === 'shipments')
             ================================================================= */}
          {activeTab === 'shipments' && (
            <div className="shipments-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Shipment Management</h2>
                <p className="page-subtitle">Track active, pending, and completed freight shipments</p>
              </div>

              <div className="ocean-card shipments-card">
                <div className="card-header-between">
                  <div className="tab-filters-row">
                    <button className={`tab-filter-btn ${shipmentTabFilter === 'all' ? 'active' : ''}`} onClick={() => setShipmentTabFilter('all')}>
                      All Shipments ({shipmentHistory.length})
                    </button>
                    <button className={`tab-filter-btn ${shipmentTabFilter === 'completed' ? 'active' : ''}`} onClick={() => setShipmentTabFilter('completed')}>
                      Completed
                    </button>
                    <button className={`tab-filter-btn ${shipmentTabFilter === 'active' ? 'active' : ''}`} onClick={() => setShipmentTabFilter('active')}>
                      Active / En-Route
                    </button>
                  </div>

                  {shipmentHistory.length > 0 && (
                    <button className="btn-clear-danger" onClick={clearHistory}>
                      🗑️ Clear History
                    </button>
                  )}
                </div>

                {filteredShipments.length > 0 ? (
                  <div className="table-responsive">
                    <table className="ocean-data-table">
                      <thead>
                        <tr>
                          <th>Shipment ID</th>
                          <th>Date & Time</th>
                          <th>Origin</th>
                          <th>Destination</th>
                          <th>Cargo Type</th>
                          <th>Containers</th>
                          <th>Selected Route</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShipments.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.id}</strong></td>
                            <td className="td-muted">{item.timestamp}</td>
                            <td className="td-bold">{item.origin}</td>
                            <td className="td-bold">{item.destination}</td>
                            <td>{item.cargo_type}</td>
                            <td className="td-bold">{item.containers} TEU</td>
                            <td><strong>{item.best_route}</strong></td>
                            <td className="td-score">{item.route_score}/100</td>
                            <td><span className="pill-status green">Completed</span></td>
                            <td>
                              <button className="btn-table-sm" onClick={() => setSelectedShipmentModal(item)}>
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state-box">
                    <span className="empty-icon">🚢</span>
                    <h3>No Shipments Logged</h3>
                    <p>Analyze routes in <strong>Route Intelligence</strong> to save shipments to history.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE 4: REPORTS PAGE (activeTab === 'reports')
             ================================================================= */}
          {activeTab === 'reports' && (
            <div className="reports-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Maritime Reports</h2>
                <p className="page-subtitle">Generate exportable analytical reports for freight pricing & corridors</p>
              </div>

              {/* Toast Notification Banner */}
              {reportToast && (
                <div className="alert-banner alert-info" style={{ marginBottom: '1.25rem' }}>
                  {reportToast}
                </div>
              )}

              {/* No Data Warning Notice */}
              {!hasAnalysisData && (
                <div className="alert-warning-ocean" style={{ marginBottom: '1.5rem' }}>
                  <span>⚠️ <strong>No Route Analysis Available:</strong> Please analyze a route first in <strong>Route Intelligence</strong> to unlock PDF and CSV report exports.</span>
                </div>
              )}

              <div className="reports-cards-grid">
                {/* CARD 1: Route Analysis Report */}
                <div className="ocean-card report-card">
                  <div className="report-card-top">
                    <span className="report-icon">📄</span>
                    {hasAnalysisData ? (
                      <span className="pill-status green">Ready</span>
                    ) : (
                      <span className="pill-status gray">No Data</span>
                    )}
                  </div>
                  <h3>Route Analysis Report</h3>
                  <p>Comprehensive PDF breakdown of ocean trade corridors, transit times, transshipment stops, and best route selection for {apiResult ? `${apiResult.query.origin} ➔ ${apiResult.query.destination}` : 'your latest query'}.</p>
                  <button
                    className="btn-report-download"
                    disabled={!hasAnalysisData || reportLoading.pdf}
                    onClick={handleDownloadPDF}
                    title={!hasAnalysisData ? 'Analyze a route first in Route Intelligence' : 'Download PDF Report'}
                  >
                    {reportLoading.pdf ? 'Generating PDF...' : 'Download Report (PDF)'}
                  </button>
                </div>

                {/* CARD 2: Shipment Performance */}
                <div className="ocean-card report-card">
                  <div className="report-card-top">
                    <span className="report-icon">📊</span>
                    {hasAnalysisData ? (
                      <span className="pill-status green">Ready</span>
                    ) : (
                      <span className="pill-status gray">No Data</span>
                    )}
                  </div>
                  <h3>Shipment Performance</h3>
                  <p>Historical evaluation of cargo delivery speed, reliability ratings, route scores, and performance metrics.</p>
                  <button
                    className="btn-report-download"
                    disabled={!hasAnalysisData || reportLoading.csv}
                    onClick={handleExportCSV}
                    title={!hasAnalysisData ? 'Analyze a route first in Route Intelligence' : 'Export CSV Data'}
                  >
                    {reportLoading.csv ? 'Exporting CSV...' : 'Export CSV'}
                  </button>
                </div>

                {/* CARD 3: Transit Time Report */}
                <div className="ocean-card report-card">
                  <div className="report-card-top">
                    <span className="report-icon">⏱️</span>
                    <span className="pill-status teal">Module Active</span>
                  </div>
                  <h3>Transit Time Report</h3>
                  <p>Transit duration benchmarking across Asian and European port pairings and ocean trade corridors.</p>
                  <button
                    className="btn-report-download"
                    onClick={() => setActiveTab('analytics')}
                  >
                    View Analytics
                  </button>
                </div>

                {/* CARD 4: Freight Optimization Report */}
                <div className="ocean-card report-card">
                  <div className="report-card-top">
                    <span className="report-icon">💰</span>
                    <span className="pill-status gray">Coming Soon</span>
                  </div>
                  <h3>Freight Optimization Report</h3>
                  <p>Pricing Agent module for rate calculations, container surcharges, and margin optimization.</p>
                  <button className="btn-report-download" disabled>
                    Module Pending
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE 5: ANALYTICS PAGE (activeTab === 'analytics')
             ================================================================= */}
          {activeTab === 'analytics' && (
            <div className="analytics-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Maritime Analytics</h2>
                <p className="page-subtitle">Real-time performance trends and route score distributions for your active query</p>
              </div>

              {/* LATEST ROUTE ANALYSIS OVERVIEW CARD */}
              <div className="ocean-card summary-bar-card" style={{ marginBottom: '1.5rem' }}>
                <div className="summary-title-label">Active Route Query Analytics Overview</div>
                <div className="summary-items-row">
                  <div><span>📍 Corridor:</span> <strong>{apiResult ? `${apiResult.query.origin} ➔ ${apiResult.query.destination}` : 'Chennai ➔ Rotterdam'}</strong></div>
                  <div><span>📦 Cargo & Load:</span> <strong>{apiResult ? `${apiResult.query.cargo_type} (${apiResult.query.containers} TEU)` : 'Electronics (10 TEU)'}</strong></div>
                  <div><span>⭐ Recommended Route:</span> <strong>{apiResult?.best_route?.route_name || 'Express Suez Direct'}</strong></div>
                  <div><span>📊 Candidates Evaluated:</span> <strong>{apiResult?.matching_count || 0} Routes</strong></div>
                </div>
              </div>

              {/* 4 DYNAMIC KPI METRIC CARDS */}
              <section className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
                <div className="kpi-card highlight-gold-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                    <span className="kpi-trend-pill gold">Top Score</span>
                  </div>
                  <div className="kpi-label">Best Route Score</div>
                  <div className="kpi-main-val gold-val">{apiResult?.best_route ? `${apiResult.best_route.route_score}/100` : '91/100'}</div>
                  <div className="kpi-sub-text">Composite evaluation metric</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5D7A" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <span className="kpi-trend-pill green">Speed</span>
                  </div>
                  <div className="kpi-label">Transit Duration</div>
                  <div className="kpi-main-val">{apiResult?.best_route ? `${apiResult.best_route.transit_days} Days` : '21 Days'}</div>
                  <div className="kpi-sub-text">Sea transit time</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle cyan"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg></div>
                    <span className="kpi-trend-pill blue">Distance</span>
                  </div>
                  <div className="kpi-label">Nautical Distance</div>
                  <div className="kpi-main-val">{apiResult?.best_route ? `${apiResult.best_route.distance_nautical_miles.toLocaleString()} NM` : '6,500 NM'}</div>
                  <div className="kpi-sub-text">Ocean voyage length</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#18A66A" strokeWidth="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg></div>
                    <span className="kpi-trend-pill green">Stops</span>
                  </div>
                  <div className="kpi-label">Transshipment Stops</div>
                  <div className="kpi-main-val">
                    {apiResult?.best_route
                      ? (apiResult.best_route.transshipments === 0 ? '0 (Direct)' : `${apiResult.best_route.transshipments} Stop`)
                      : '0 (Direct)'}
                  </div>
                  <div className="kpi-sub-text">
                    {apiResult?.best_route?.transshipments === 0 ? 'Direct ocean service' : apiResult?.best_route?.transshipment_ports}
                  </div>
                </div>
              </section>

              {/* DYNAMIC CHARTS & COMPARISON GRID */}
              <div className="analytics-grid">
                {/* DYNAMIC ROUTE SCORE COMPARISON BAR CHART */}
                <div className="ocean-card chart-card">
                  <h3 className="card-title">Route Score Comparison</h3>
                  <p className="card-subtitle" style={{ marginBottom: '1rem' }}>Real-time route score distribution across matching candidate routes</p>

                  {apiResult?.available_routes && apiResult.available_routes.length > 0 ? (
                    <div className="dynamic-bar-chart-container">
                      <div className="simple-bar-chart dynamic-height">
                        {apiResult.available_routes.map((r) => {
                          const isBest = r.route_id === apiResult.best_route.route_id
                          return (
                            <div key={r.route_id} className="bar-group">
                              <span className="bar-val-badge">{r.route_score}</span>
                              <div
                                className={`bar-fill ${isBest ? 'green' : 'teal'}`}
                                style={{ height: `${Math.max(r.route_score, 15)}%` }}
                              ></div>
                              <span className="bar-label">{r.route_name}</span>
                              <span className={`pill-status-xs ${isBest ? 'green' : 'gray'}`}>
                                {isBest ? 'Best Choice' : 'Alternative'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state-box">
                      <p>No candidate routes available. Run a query in Route Intelligence.</p>
                    </div>
                  )}
                </div>

                {/* DYNAMIC TRANSIT TIME & DISTANCE BREAKDOWN */}
                <div className="ocean-card analytics-stat-card">
                  <h3 className="card-title">Transit Time & Distance Breakdown</h3>
                  <p className="card-subtitle" style={{ marginBottom: '1rem' }}>Candidate route performance metrics for {apiResult?.query?.origin || 'Chennai'} ➔ {apiResult?.query?.destination || 'Rotterdam'}</p>

                  {apiResult?.available_routes && apiResult.available_routes.length > 0 ? (
                    <div className="stat-summary-list">
                      {apiResult.available_routes.map((r) => (
                        <div key={r.route_id} className="stat-row">
                          <div className="stat-row-info">
                            <strong>{r.route_name}</strong>
                            <span className="stat-corridor">{r.ocean_corridor}</span>
                          </div>
                          <div className="stat-row-metrics">
                            <span className="metric-tag-sm green">{r.transit_days} Days</span>
                            <span className="metric-tag-sm teal">{r.distance_nautical_miles.toLocaleString()} NM</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-box">
                      <p>No transit data logged.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* =================================================================
             PAGE 6: SETTINGS PAGE (activeTab === 'settings')
             ================================================================= */}
          {activeTab === 'settings' && (
            <div className="settings-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Settings & Configuration</h2>
                <p className="page-subtitle">Application preferences, broker profile, and AI Agent configuration</p>
              </div>

              <div className="ocean-card settings-card">
                <h3 className="card-title">User Profile</h3>
                <div className="profile-info-box" style={{ marginTop: '0.75rem' }}>
                  <div><strong>Email:</strong> {user?.email || 'admin@maritime.com'}</div>
                  <div><strong>Role:</strong> Maritime Freight Broker Administrator</div>
                  <div><strong>Dataset Version:</strong> Maritime Routes CSV v1.0.0 (71 Complete Routes)</div>
                </div>

                <h3 className="card-title" style={{ marginTop: '1.75rem' }}>AI Agent Settings</h3>
                <div className="agent-setting-item" style={{ marginTop: '0.75rem' }}>
                  <span>Route Agent (Pandas Corridor Analysis)</span>
                  <span className="pill-status green">● Enabled</span>
                </div>
                <div className="agent-setting-item">
                  <span>Pricing Agent (Freight Rate Calculation)</span>
                  <span className="pill-status gray">○ Disabled (Future Phase)</span>
                </div>
                <div className="agent-setting-item">
                  <span>Weather Agent (Sea & Storm Forecasts)</span>
                  <span className="pill-status gray">○ Disabled (Future Phase)</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* VIEW DETAILS MODAL POPUP */}
      {selectedShipmentModal && (
        <div className="modal-backdrop-overlay" onClick={() => setSelectedShipmentModal(null)}>
          <div className="modal-content-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-panel-header">
              <div>
                <span className="modal-tag-label">SHIPMENT DETAILS</span>
                <h3 className="modal-heading-title">{selectedShipmentModal.id} — {selectedShipmentModal.origin} to {selectedShipmentModal.destination}</h3>
                <p className="modal-date-subtitle">Logged on {selectedShipmentModal.timestamp}</p>
              </div>
              <button className="modal-close-icon" onClick={() => setSelectedShipmentModal(null)}>✕</button>
            </div>

            <div className="modal-panel-body">
              {/* QUERY SUMMARY BAR */}
              <div className="summary-bar-card" style={{ marginBottom: '1.25rem' }}>
                <div className="summary-items-row">
                  <div><span>📍 Origin:</span> <strong>{selectedShipmentModal.origin}</strong></div>
                  <div><span>🏁 Destination:</span> <strong>{selectedShipmentModal.destination}</strong></div>
                  <div><span>📦 Cargo:</span> <strong>{selectedShipmentModal.cargo_type}</strong></div>
                  <div><span>🚢 Containers:</span> <strong>{selectedShipmentModal.containers} TEU</strong></div>
                </div>
              </div>

              {/* RECOMMENDED ROUTE CARD IN MODAL */}
              {selectedShipmentModal.full_result?.best_route && (
                <div className="best-recommended-card" style={{ marginBottom: '1.25rem' }}>
                  <div className="best-top-bar">
                    <span className="gold-pill">⭐ RECOMMENDED BEST ROUTE</span>
                    <span className="score-gold-badge">Route Score: {selectedShipmentModal.full_result.best_route.route_score} / 100</span>
                  </div>

                  <h3 className="best-route-title-text">{selectedShipmentModal.full_result.best_route.route_name}</h3>
                  <p className="best-route-path-text">📍 {selectedShipmentModal.full_result.best_route.ocean_corridor}</p>

                  <div className="three-metrics-grid">
                    <div className="metric-mini-box">
                      <span className="mm-label">TRANSIT TIME</span>
                      <span className="mm-val">{selectedShipmentModal.full_result.best_route.transit_days} Days</span>
                    </div>
                    <div className="metric-mini-box">
                      <span className="mm-label">DISTANCE</span>
                      <span className="mm-val">{selectedShipmentModal.full_result.best_route.distance_nautical_miles.toLocaleString()} NM</span>
                    </div>
                    <div className="metric-mini-box">
                      <span className="mm-label">TRANSSHIPMENTS</span>
                      <span className="mm-val">
                        {selectedShipmentModal.full_result.best_route.transshipments === 0 ? '0 (Direct)' : `${selectedShipmentModal.full_result.best_route.transshipments} Stop`}
                      </span>
                    </div>
                  </div>

                  <div className="why-box-container">
                    <h4 className="why-title-head">Selection Reason:</h4>
                    <p className="why-body-desc">{selectedShipmentModal.full_result.best_route.selection_reason}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-panel-footer">
              <button className="btn-primary-teal" style={{ width: 'auto', padding: '0.6rem 1.5rem' }} onClick={() => setSelectedShipmentModal(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
