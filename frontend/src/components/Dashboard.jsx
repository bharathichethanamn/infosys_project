import React, { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import RouteMap from './RouteMap'

function Dashboard({ user, onLogout }) {
  const [backendStatus, setBackendStatus] = useState({ connected: false, message: 'Connecting...' })
  const [activeTab, setActiveTab] = useState('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [shipmentTabFilter, setShipmentTabFilter] = useState('all')

  // User-specific history key
  const userEmail = user?.email ? user.email.toLowerCase().trim() : 'admin@maritime.com'
  const historyStorageKey = `maritime_history_${userEmail}`

  const [formData, setFormData] = useState({
    origin: 'Chennai',
    destination: 'Rotterdam',
    cargo_type: 'Electronics',
    containers: 10
  })

  // ALWAYS FRESH AGENT STATE ON LOGIN / PAGE LOAD
  const [apiResult, setApiResult] = useState(null)
  const [selectedMapRoute, setSelectedMapRoute] = useState(null)

  // Pricing Agent State (Fresh state on login)
  const [containerType, setContainerType] = useState('40ft')
  const [pricingResult, setPricingResult] = useState(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState('')

  // Quotation Agent State (Fresh state on login)
  const [customerName, setCustomerName] = useState('Global Logistics Corp')
  const [marginPercent, setMarginPercent] = useState(15.0)
  const [quotationResult, setQuotationResult] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Report Export Loading & Toast States
  const [reportLoading, setReportLoading] = useState({ pdf: false, csv: false, pricingPdf: false })
  const [reportToast, setReportToast] = useState('')

  // AI Agent Processing State
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(1)

  // User-specific Shipment History
  const [shipmentHistory, setShipmentHistory] = useState([])

  // Modal State for "View Details"
  const [selectedShipmentModal, setSelectedShipmentModal] = useState(null)

  const API_URL = 'http://127.0.0.1:8000'

  // Load user-specific history on mount or when user changes (agents start fresh)
  useEffect(() => {
    fetch(API_URL + '/')
      .then(res => res.json())
      .then(data => {
        setBackendStatus({ connected: true, message: data.message })
      })
      .catch(() => {
        setBackendStatus({ connected: false, message: 'Backend Offline' })
      })

    // Load history for current user from localStorage
    try {
      const saved = localStorage.getItem(historyStorageKey)
      if (saved) {
        setShipmentHistory(JSON.parse(saved))
      } else {
        setShipmentHistory([])
      }
    } catch {
      setShipmentHistory([])
    }

    // Ensure agents ALWAYS open completely fresh
    setApiResult(null)
    setPricingResult(null)
    setQuotationResult(null)
  }, [userEmail])

  // Helper to update & persist history for current user
  const saveHistoryForUser = (newHistory) => {
    setShipmentHistory(newHistory)
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(newHistory))
    } catch (e) {
      console.error('Failed to save user history:', e)
    }
  }

  // 1. ROUTE AGENT ANALYSIS HANDLER (Runs ONLY on user click "Analyze Route")
  const triggerRouteAnalysis = async (dataToSubmit, saveToHistory = true, animateSteps = true) => {
    // STARTING A NEW ANALYSIS CLEARS PREVIOUS ROUTE, PRICING, AND QUOTATION RESULTS
    setApiResult(null)
    setSelectedMapRoute(null)
    setPricingResult(null)
    setQuotationResult(null)
    setPricingError('')
    setError('')
    setLoading(true)

    if (animateSteps) {
      setIsProcessing(true)
      setProcessingStep(1)
    }

    try {
      if (animateSteps) {
        await new Promise(r => setTimeout(r, 400))
        setProcessingStep(2)
      }

      const res = await fetch(`${API_URL}/api/routes/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      })

      if (animateSteps) {
        setProcessingStep(3)
        await new Promise(r => setTimeout(r, 400))
        setProcessingStep(4)
        await new Promise(r => setTimeout(r, 350))
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const msg = errorData.detail || errorData.message || 'No available route found for this shipment.'
        throw new Error(msg)
      }

      const data = await res.json()
      setApiResult(data)
      if (data && data.best_route) {
        setSelectedMapRoute('ALL')
      }

      if (data && (data.matched === false || data.status === 'error' || !data.best_route)) {
        setError(data.message || 'No available route found for this shipment.')
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

        saveHistoryForUser([newRecord, ...shipmentHistory])
      }
    } catch (err) {
      console.error('Route Analysis Error:', err)
      setError(err.message || 'No available route found for this shipment.')
    } finally {
      setLoading(false)
      if (animateSteps) {
        setTimeout(() => setIsProcessing(false), 250)
      }
    }
  }

  // 2. PRICING AGENT FREIGHT COST CALCULATION HANDLER (Runs ONLY on user click "Calculate Freight")
  const calculateFreightPrice = async (cType = containerType) => {
    if (!apiResult || !apiResult.best_route) {
      setPricingError('No available route found for this shipment.')
      return
    }

    setPricingLoading(true)
    setPricingError('')

    const payload = {
      route_id: apiResult.best_route.route_id,
      origin: apiResult.query.origin,
      destination: apiResult.query.destination,
      cargo_type: apiResult.query.cargo_type,
      containers: apiResult.query.containers,
      container_type: cType
    }

    try {
      const res = await fetch(`${API_URL}/api/pricing/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.status === 'error') {
        throw new Error(data.detail || data.message || 'Pricing not available for this route.')
      }

      setPricingResult(data)

      // Attach pricing_result to active apiResult and active shipment history
      setApiResult(prev => prev ? { ...prev, pricing_result: data } : prev)
      setShipmentHistory(prevHistory => {
        if (!prevHistory || prevHistory.length === 0) return prevHistory
        const updated = [...prevHistory]
        updated[0] = {
          ...updated[0],
          pricing_result: data,
          full_result: {
            ...updated[0].full_result,
            pricing_result: data
          }
        }
        try {
          localStorage.setItem(historyStorageKey, JSON.stringify(updated))
        } catch (e) {}
        return updated
      })

      setReportToast('✅ Freight cost calculated successfully by Pricing Agent!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      console.error('Pricing Calculation Error:', err)
      setPricingError(err.message || 'Pricing not available for this route.')
    } finally {
      setPricingLoading(false)
    }
  }

  // 3. QUOTATION AGENT GENERATE QUOTE HANDLER
  const generateCustomerQuotation = async () => {
    if (!pricingResult) {
      alert('Pricing not available for this route.')
      return
    }

    const parsedMargin = parseFloat(marginPercent)
    if (isNaN(parsedMargin) || parsedMargin < 0) {
      alert('Margin must be 0% or greater.')
      return
    }

    try {
      const payload = {
        route_id: pricingResult.route_id,
        origin: pricingResult.origin,
        destination: pricingResult.destination,
        cargo_type: pricingResult.cargo_type,
        containers: pricingResult.containers,
        container_type: pricingResult.container_type,
        customer_name: customerName,
        margin_percent: parsedMargin
      }

      const res = await fetch(`${API_URL}/api/quotation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.status === 'error') {
        throw new Error(data.detail || data.message || 'Margin must be 0% or greater.')
      }

      setQuotationResult(data)

      // Attach quotation_result to active shipment history record
      setShipmentHistory(prevHistory => {
        if (!prevHistory || prevHistory.length === 0) return prevHistory
        const updated = [...prevHistory]
        updated[0] = {
          ...updated[0],
          quotation_result: data,
          full_result: {
            ...updated[0].full_result,
            quotation_result: data
          }
        }
        try {
          localStorage.setItem(historyStorageKey, JSON.stringify(updated))
        } catch (e) {}
        return updated
      })

      setReportToast('✅ Formal Quotation generated successfully!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      console.error('Quotation Error:', err)
      alert(err.message || 'Margin must be 0% or greater.')
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
    if (window.confirm('Are you sure you want to clear your shipment history?')) {
      setShipmentHistory([])
      try {
        localStorage.removeItem(historyStorageKey)
      } catch (e) {}
    }
  }

  // PDF Route Analysis Report Generation Handler
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

      doc.setFillColor(6, 43, 73)
      doc.rect(0, 0, 210, 38, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('AGENTIC MARITIME BROKERAGE', 14, 16)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(32, 196, 217)
      doc.text('MARITIME FREIGHT ROUTE ANALYSIS REPORT', 14, 25)

      doc.setTextColor(226, 232, 240)
      doc.setFontSize(8)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 25)

      let y = 48

      doc.setFillColor(242, 249, 251)
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
      doc.text(`Container Load: ${query.containers} TEU (${containerType})`, 105, y + 26)

      y += 42

      doc.setFillColor(254, 243, 199)
      doc.rect(14, y, 182, 54, 'F')
      doc.setDrawColor(245, 166, 35)
      doc.rect(14, y, 182, 54, 'S')

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(146, 64, 14)
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

      if (pricingResult && pricingResult.pricing) {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(24, 166, 106)
        doc.text(`Estimated Total Freight Cost: $${pricingResult.pricing.total_freight_cost.toLocaleString()} ${pricingResult.currency}`, 18, y + 45)
      } else {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8.5)
        doc.setTextColor(71, 85, 105)
        doc.text(`Selection Reason: ${best.selection_reason || 'Optimal balance of transit speed and sea reliability.'}`, 18, y + 45)
      }

      y += 62

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

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('Agentic AI Maritime Freight System • Confidential & Proprietary Report', 14, 285)
      doc.text('Page 1 of 1', 180, 285)

      doc.save(`Maritime_Route_Analysis_${query.origin}_to_${query.destination}.pdf`)
      setReportToast('✅ Route Analysis PDF downloaded successfully!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      console.error('Route PDF Generation Error:', err)
      alert('Unable to generate the report. Please try again.')
    } finally {
      setReportLoading(prev => ({ ...prev, pdf: false }))
    }
  }

  // PDF Freight Pricing Report Generation Handler
  const handleDownloadPricingPDF = () => {
    if (!pricingResult || !pricingResult.pricing) {
      alert('No Freight Pricing Available. Please calculate pricing in the Pricing tab first.')
      return
    }

    setReportLoading(prev => ({ ...prev, pricingPdf: true }))

    try {
      const doc = new jsPDF()
      const p = pricingResult.pricing
      const res = pricingResult
      const containers = res.containers || 1

      doc.setFillColor(6, 43, 73)
      doc.rect(0, 0, 210, 38, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('AGENTIC MARITIME BROKERAGE', 14, 16)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(32, 196, 217)
      doc.text('OFFICIAL FREIGHT COST & PRICING REPORT', 14, 25)

      doc.setTextColor(226, 232, 240)
      doc.setFontSize(8)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 25)

      let y = 48

      doc.setFillColor(242, 249, 251)
      doc.rect(14, y, 182, 38, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.rect(14, y, 182, 38, 'S')

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('1. SHIPMENT & ROUTE PARAMETERS', 18, y + 8)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
      doc.text(`Route ID: ${res.route_id || 'N/A'}`, 18, y + 17)
      doc.text(`Route Name: ${res.route_name || 'N/A'}`, 105, y + 17)
      doc.text(`Corridor: ${res.origin || ''} -> ${res.destination || ''}`, 18, y + 26)
      doc.text(`Cargo Type: ${res.cargo_type || 'N/A'}`, 105, y + 26)
      doc.text(`Containers: ${containers} x ${res.container_type || '40ft'}`, 18, y + 34)
      doc.text(`Transshipments: ${res.transshipments ?? 0}`, 105, y + 34)

      y += 46

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('2. FREIGHT COST BREAKDOWN (PRICING AGENT)', 14, y)

      y += 6

      doc.setFillColor(7, 59, 92)
      doc.rect(14, y, 182, 8, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text('Cost Component', 18, y + 6)
      doc.text('Formula / Rate Calculation', 90, y + 6)
      doc.text(`Amount (${res.currency || 'USD'})`, 160, y + 6)

      y += 8

      const rates = p.rates_per_container || {}
      const baseRate = rates.base_freight_usd ?? rates.base_freight_per_container ?? 0
      const fuelRate = rates.fuel_surcharge_usd ?? rates.fuel_surcharge_per_container ?? 0
      const portRate = rates.port_charge_usd ?? rates.port_handling_per_container ?? 0
      const riskRate = rates.risk_surcharge_usd ?? 0

      const costRows = []

      if (p.base_freight != null || baseRate > 0) {
        costRows.push({
          label: 'Base Ocean Freight',
          formula: `$${baseRate} x ${containers} containers`,
          amount: p.base_freight ?? (baseRate * containers)
        })
      }

      if (p.fuel_surcharge != null || fuelRate > 0) {
        costRows.push({
          label: 'Fuel Surcharge (BAF)',
          formula: `$${fuelRate} x ${containers} containers`,
          amount: p.fuel_surcharge ?? (fuelRate * containers)
        })
      }

      if (p.port_charge != null || p.port_handling != null || portRate > 0) {
        costRows.push({
          label: 'Port Handling (THC)',
          formula: `$${portRate} x ${containers} containers`,
          amount: p.port_charge ?? p.port_handling ?? (portRate * containers)
        })
      }

      if (p.risk_surcharge != null || riskRate > 0) {
        costRows.push({
          label: 'Risk Surcharge',
          formula: `$${riskRate} x ${containers} containers`,
          amount: p.risk_surcharge ?? (riskRate * containers)
        })
      }

      if (p.transshipment_charge != null && p.transshipment_charge > 0) {
        const transRate = rates.transshipment_charge_per_container || 0
        costRows.push({
          label: 'Transshipment Charges',
          formula: `$${transRate} x ${containers} cont x ${res.transshipments || 0} stops`,
          amount: p.transshipment_charge
        })
      }

      if (p.other_charges != null && p.other_charges > 0) {
        const otherRate = rates.other_charges_per_container || 0
        costRows.push({
          label: 'Other Surcharges',
          formula: `$${otherRate} x ${containers} containers`,
          amount: p.other_charges
        })
      }

      if (costRows.length === 0) {
        costRows.push({
          label: 'Operating Freight Cost',
          formula: 'Calculated Freight Rate',
          amount: p.operating_cost ?? p.total_freight_cost ?? 0
        })
      }

      costRows.forEach((row, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252)
          doc.rect(14, y, 182, 8, 'F')
        }
        doc.setDrawColor(226, 232, 240)
        doc.line(14, y + 8, 196, y + 8)

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        doc.text(row.label, 18, y + 6)
        doc.text(row.formula, 90, y + 6)
        doc.setFont('helvetica', 'bold')
        doc.text(`$${Number(row.amount || 0).toLocaleString()} ${res.currency || 'USD'}`, 160, y + 6)

        y += 8
      })

      y += 4
      doc.setFillColor(236, 253, 245)
      doc.rect(14, y, 182, 14, 'F')
      doc.setDrawColor(24, 166, 106)
      doc.rect(14, y, 182, 14, 'S')

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 95, 70)
      doc.text('TOTAL FREIGHT COST (NET COST):', 18, y + 9)
      doc.setFontSize(14)
      const totalCostVal = p.total_freight_cost ?? p.demand_adjusted_cost ?? p.operating_cost ?? 0
      doc.text(`$${Number(totalCostVal).toLocaleString()} ${res.currency || 'USD'}`, 145, y + 9)

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('Agentic AI Pricing Agent • Official Dataset-backed Calculation', 14, 285)
      doc.text('Page 1 of 1', 180, 285)

      doc.save(`Freight_Pricing_Report_${res.origin}_to_${res.destination}.pdf`)
      setReportToast('✅ Freight Pricing PDF downloaded successfully!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      console.error('Pricing PDF Generation Error:', err)
      alert('Unable to generate the report. Please try again.')
    } finally {
      setReportLoading(prev => ({ ...prev, pricingPdf: false }))
    }
  }

  // Download Complete Shipment Report PDF (For History -> View Details Modal)
  const handleDownloadCompleteShipmentReport = (item) => {
    if (!item) return

    const full = item.full_result || {}

    // Extract saved data ONLY from the history item
    // 1. Route Analysis saved data
    const bestRoute = full.best_route || (item.best_route && typeof item.best_route === 'object' ? item.best_route : null)

    // 2. Freight Pricing saved data
    const pricingRes = item.pricing_result || full.pricing_result || null
    const pricingObj = pricingRes?.pricing || null

    // 3. Margin & 4. Quotation saved data
    const quotationRes = item.quotation_result || full.quotation_result || null
    const financialsObj = quotationRes?.financials || null

    const origin = item.origin || full.query?.origin || pricingRes?.origin || 'N/A'
    const destination = item.destination || full.query?.destination || pricingRes?.destination || 'N/A'
    const cargo = item.cargo_type || full.query?.cargo_type || pricingRes?.cargo_type || 'N/A'
    const containers = item.containers || full.query?.containers || pricingRes?.containers || 'N/A'

    try {
      const doc = new jsPDF()
      let y = 0

      const checkPageBreak = (needed = 20) => {
        if (y + needed > 275) {
          doc.addPage()
          y = 20
        }
      }

      // Header Banner
      doc.setFillColor(6, 43, 73)
      doc.rect(0, 0, 210, 38, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('AGENTIC MARITIME BROKERAGE', 14, 16)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(32, 196, 217)
      doc.text('COMPLETE SHIPMENT REPORT', 14, 25)

      doc.setTextColor(226, 232, 240)
      doc.setFontSize(8)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 25)

      y = 46

      // Basic Shipment Metadata Card
      doc.setFillColor(242, 249, 251)
      doc.rect(14, y, 182, 34, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.rect(14, y, 182, 34, 'S')

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('SHIPMENT PARAMETERS', 18, y + 8)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(30, 41, 59)
      doc.text(`Shipment ID: ${item.id || 'N/A'}`, 18, y + 17)
      doc.text(`Logged Date: ${item.timestamp || 'N/A'}`, 105, y + 17)
      doc.text(`Corridor: ${origin} -> ${destination}`, 18, y + 26)
      doc.text(`Cargo & Load: ${cargo} (${containers} TEU)`, 105, y + 26)

      y += 42

      // ==========================================
      // SECTION 1: ROUTE ANALYSIS
      // ==========================================
      checkPageBreak(30)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('1. ROUTE ANALYSIS', 14, y)
      y += 6

      if (bestRoute) {
        doc.setFillColor(254, 243, 199)
        doc.rect(14, y, 182, 48, 'F')
        doc.setDrawColor(245, 166, 35)
        doc.rect(14, y, 182, 48, 'S')

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(146, 64, 14)
        doc.text(`Recommended Route: ${bestRoute.route_name || item.best_route || 'N/A'}`, 18, y + 8)
        if (bestRoute.route_score != null) {
          doc.text(`Route Score: ${bestRoute.route_score} / 100`, 145, y + 8)
        }

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(15, 139, 141)
        doc.text(`Ocean Corridor: ${bestRoute.ocean_corridor || 'N/A'}`, 18, y + 17)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(6, 43, 73)
        doc.text(`Transit Time: ${bestRoute.transit_days || item.transit_days || 'N/A'} Days`, 18, y + 26)
        if (bestRoute.distance_nautical_miles != null) {
          doc.text(`Nautical Distance: ${Number(bestRoute.distance_nautical_miles).toLocaleString()} NM`, 75, y + 26)
        }
        doc.text(`Transshipments: ${bestRoute.transshipments === 0 ? '0 (Direct)' : (bestRoute.transshipments || 0)}`, 145, y + 26)

        if (bestRoute.selection_reason) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(8)
          doc.setTextColor(71, 85, 105)
          const reasonLines = doc.splitTextToSize(`Selection Reason: ${bestRoute.selection_reason}`, 172)
          doc.text(reasonLines, 18, y + 36)
        }

        y += 54
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(100, 116, 139)
        doc.text('Not Available', 18, y + 4)
        y += 12
      }

      // ==========================================
      // SECTION 2: FREIGHT PRICING
      // ==========================================
      checkPageBreak(30)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('2. FREIGHT PRICING', 14, y)
      y += 6

      if (pricingObj) {
        const currency = pricingRes?.currency || 'USD'
        doc.setFillColor(7, 59, 92)
        doc.rect(14, y, 182, 8, 'F')
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text('Cost Component', 18, y + 6)
        doc.text('Calculation Rate', 90, y + 6)
        doc.text(`Amount (${currency})`, 160, y + 6)

        y += 8

        const rates = pricingObj.rates_per_container || {}
        const baseRate = rates.base_freight_usd ?? rates.base_freight_per_container ?? 0
        const fuelRate = rates.fuel_surcharge_usd ?? rates.fuel_surcharge_per_container ?? 0
        const portRate = rates.port_charge_usd ?? rates.port_handling_per_container ?? 0
        const riskRate = rates.risk_surcharge_usd ?? 0

        const costRows = []
        if (pricingObj.base_freight != null || baseRate > 0) {
          costRows.push({ label: 'Base Ocean Freight', formula: `$${baseRate} x ${containers} containers`, amount: pricingObj.base_freight ?? (baseRate * containers) })
        }
        if (pricingObj.fuel_surcharge != null || fuelRate > 0) {
          costRows.push({ label: 'Fuel Surcharge (BAF)', formula: `$${fuelRate} x ${containers} containers`, amount: pricingObj.fuel_surcharge ?? (fuelRate * containers) })
        }
        if (pricingObj.port_charge != null || pricingObj.port_handling != null || portRate > 0) {
          costRows.push({ label: 'Port Handling (THC)', formula: `$${portRate} x ${containers} containers`, amount: pricingObj.port_charge ?? pricingObj.port_handling ?? (portRate * containers) })
        }
        if (pricingObj.risk_surcharge != null || riskRate > 0) {
          costRows.push({ label: 'Risk Surcharge', formula: `$${riskRate} x ${containers} containers`, amount: pricingObj.risk_surcharge ?? (riskRate * containers) })
        }
        if (pricingObj.transshipment_charge != null && pricingObj.transshipment_charge > 0) {
          costRows.push({ label: 'Transshipment Charges', formula: `$${rates.transshipment_charge_per_container || 0} x ${containers} cont`, amount: pricingObj.transshipment_charge })
        }
        if (pricingObj.other_charges != null && pricingObj.other_charges > 0) {
          costRows.push({ label: 'Other Surcharges', formula: `$${rates.other_charges_per_container || 0} x ${containers} containers`, amount: pricingObj.other_charges })
        }

        if (costRows.length === 0) {
          costRows.push({ label: 'Operating Freight Cost', formula: 'Calculated Freight Rate', amount: pricingObj.operating_cost ?? pricingObj.total_freight_cost ?? 0 })
        }

        costRows.forEach((row, idx) => {
          checkPageBreak(10)
          if (idx % 2 === 0) {
            doc.setFillColor(248, 250, 252)
            doc.rect(14, y, 182, 8, 'F')
          }
          doc.setDrawColor(226, 232, 240)
          doc.line(14, y + 8, 196, y + 8)

          doc.setFontSize(9)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(30, 41, 59)
          doc.text(row.label, 18, y + 6)
          doc.text(row.formula, 90, y + 6)
          doc.setFont('helvetica', 'bold')
          doc.text(`$${Number(row.amount || 0).toLocaleString()} ${currency}`, 160, y + 6)
          y += 8
        })

        checkPageBreak(18)
        y += 4
        doc.setFillColor(236, 253, 245)
        doc.rect(14, y, 182, 12, 'F')
        doc.setDrawColor(24, 166, 106)
        doc.rect(14, y, 182, 12, 'S')

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(6, 95, 70)
        doc.text('TOTAL FREIGHT COST (NET COST):', 18, y + 8)
        const totalCostVal = pricingObj.total_freight_cost ?? pricingObj.demand_adjusted_cost ?? pricingObj.operating_cost ?? 0
        doc.text(`$${Number(totalCostVal).toLocaleString()} ${currency}`, 145, y + 8)
        y += 18
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(100, 116, 139)
        doc.text('Not Available', 18, y + 4)
        y += 12
      }

      // ==========================================
      // SECTION 3: MARGIN
      // ==========================================
      checkPageBreak(25)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('3. MARGIN', 14, y)
      y += 6

      if (financialsObj || pricingObj?.target_margin_percent != null) {
        doc.setFillColor(248, 250, 252)
        doc.rect(14, y, 182, 22, 'F')
        doc.setDrawColor(226, 232, 240)
        doc.rect(14, y, 182, 22, 'S')

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)

        const marginPct = financialsObj?.margin_percent ?? pricingObj?.target_margin_percent ?? 'N/A'
        const marginAmt = financialsObj?.margin_amount ?? (financialsObj?.estimated_profit != null ? financialsObj.estimated_profit : 'N/A')
        const profitMarginPct = financialsObj?.profit_margin_percent ?? 'N/A'

        doc.text(`Broker Margin Percent: ${marginPct}%`, 18, y + 8)
        doc.text(`Margin Amount: ${marginAmt !== 'N/A' ? `$${Number(marginAmt).toLocaleString()}` : 'N/A'}`, 105, y + 8)
        doc.text(`Profit Margin Ratio: ${profitMarginPct !== 'N/A' ? `${profitMarginPct}%` : 'N/A'}`, 18, y + 16)
        y += 28
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(100, 116, 139)
        doc.text('Not Available', 18, y + 4)
        y += 12
      }

      // ==========================================
      // SECTION 4: QUOTATION
      // ==========================================
      checkPageBreak(25)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(6, 43, 73)
      doc.text('4. QUOTATION', 14, y)
      y += 6

      if (quotationRes && quotationRes.status === 'success') {
        const financials = quotationRes.financials || {}
        doc.setFillColor(238, 242, 255)
        doc.rect(14, y, 182, 32, 'F')
        doc.setDrawColor(99, 102, 241)
        doc.rect(14, y, 182, 32, 'S')

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(49, 46, 129)
        doc.text(`Quotation ID: ${quotationRes.quotation_id || 'N/A'}`, 18, y + 8)
        doc.text(`Client Name: ${quotationRes.customer_name || 'N/A'}`, 105, y + 8)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        doc.text(`Created Date: ${quotationRes.created_at || 'N/A'}`, 18, y + 16)
        doc.text(`Valid Until: ${quotationRes.valid_until || 'N/A'}`, 105, y + 16)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(6, 43, 73)
        doc.text(`Final Customer Price: $${Number(financials.customer_price || 0).toLocaleString()} ${financials.currency || 'USD'}`, 18, y + 25)

        y += 38
      } else {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(100, 116, 139)
        doc.text('Not Available', 18, y + 4)
        y += 12
      }

      // Page Footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('Agentic AI Maritime Platform • Official Saved Shipment Report', 14, 285)
      doc.text(`Page 1 of ${doc.getNumberOfPages()}`, 180, 285)

      doc.save(`Complete_Shipment_Report_${origin}_to_${destination}.pdf`)
      setReportToast('✅ Complete Shipment Report PDF downloaded successfully!')
      setTimeout(() => setReportToast(''), 4000)
    } catch (err) {
      console.error('Complete Shipment Report PDF Generation Error:', err)
      alert('Unable to generate the report. Please try again.')
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
  const totalRoutesCount = shipmentHistory.length
  const activeShipmentsCount = shipmentHistory.length
  const bestScore = apiResult?.best_route ? `${apiResult.best_route.route_score}/100` : 'N/A'
  const fastestTransit = apiResult?.best_route ? `${apiResult.best_route.transit_days} Days` : 'N/A'
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
              className={`menu-link ${activeTab === 'pricing' ? 'active' : ''}`}
              onClick={() => setActiveTab('pricing')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
              <span className="menu-label">Pricing Agent</span>
            </button>

            <button
              className={`menu-link ${activeTab === 'quotation' ? 'active' : ''}`}
              onClick={() => setActiveTab('quotation')}
            >
              <span className="menu-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
              </span>
              <span className="menu-label">Quotation Agent</span>
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
              <span>Agents: <strong>Ready</strong></span>
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

              {/* 4. KPI CARDS ROW (ALWAYS FRESH ON LOGIN) */}
              <section className="kpi-cards-grid">
                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle cyan">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                    </div>
                    <span className="kpi-trend-pill blue">Actual Analysis Count</span>
                  </div>
                  <div className="kpi-label">Routes Evaluated</div>
                  <div className="kpi-main-val">{totalRoutesCount}</div>
                  <div className="kpi-sub-text">{totalRoutesCount === 1 ? '1 route analysis evaluated' : `${totalRoutesCount} route analyses evaluated`}</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle orange">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    </div>
                    <span className="kpi-trend-pill blue">Saved History</span>
                  </div>
                  <div className="kpi-label">Saved Shipments</div>
                  <div className="kpi-main-val">{activeShipmentsCount}</div>
                  <div className="kpi-sub-row">
                    <span>Persisted for {userEmail}</span>
                  </div>
                </div>

                <div className="kpi-card highlight-gold-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle gold">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                    <span className="kpi-trend-pill gold">{apiResult ? 'Optimal Route' : 'Awaiting Query'}</span>
                  </div>
                  <div className="kpi-label">Best Route Score</div>
                  <div className="kpi-main-val gold-val">{bestScore}</div>
                  <div className="kpi-sub-row">
                    <span>{apiResult?.best_route?.route_name || 'No route analyzed yet'}</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle green">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#18A66A" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    </div>
                    <span className="kpi-trend-pill green">{pricingResult ? 'Calculated' : 'Pricing Agent'}</span>
                  </div>
                  <div className="kpi-label">Latest Freight Cost</div>
                  <div className="kpi-main-val" style={{ color: '#18A66A' }}>
                    {pricingResult?.pricing ? `$${pricingResult.pricing.total_freight_cost.toLocaleString()}` : 'N/A'}
                  </div>
                  <div className="kpi-sub-row">
                    <span>{pricingResult ? `${pricingResult.containers} x ${pricingResult.container_type}` : 'Calculate in Pricing tab'}</span>
                  </div>
                </div>
              </section>

              {/* 5. MAIN DASHBOARD GRID */}
              <div className="dashboard-main-grid">

                {/* GLOBAL MARITIME INTELLIGENCE PANEL */}
                <div className="ocean-card global-intelligence-panel">
                  <div className="card-header-between">
                    <div>
                      <h3 className="card-title">Global Maritime Intelligence</h3>
                      <p className="card-subtitle">Real-time insights. Safer routes. A healthier ocean.</p>
                    </div>
                  </div>

                  {/* RICH OCEAN VISUAL CONTAINER */}
                  <div className="intelligence-visual-container" style={{ backgroundImage: `url('/images/lighthouse_ocean.png')` }}>
                    <div className="visual-gradient-overlay"></div>

                    {/* FLOATING CATEGORIES ROW */}
                    <div className="intelligence-categories-row">
                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/><circle cx="12" cy="12" r="10"/></svg></div>
                        <span>Route Agent</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                        <span>Pricing Agent</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <span>Quotation Agent</span>
                      </div>

                      <div className="category-chip">
                        <div className="chip-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.4 19 2c1 2 2 4.1 2 7 0 6-4.5 11-10 11z"/></svg></div>
                        <span>Emission Insights</span>
                      </div>
                    </div>

                    {/* CENTER AI INSIGHT BOX & BUTTON */}
                    <div className="ai-insight-quote-box">
                      <p className="quote-text">
                        "Enter your shipment details in Route Intelligence to evaluate optimal ocean corridors and freight pricing."
                      </p>
                      <button className="btn-explore-orange" onClick={() => setActiveTab('route-intelligence')}>
                        Start Route Analysis →
                      </button>
                    </div>

                    {/* RIGHT COLUMN STAT OVERLAY */}
                    <div className="right-stats-overlay">
                      <div className="stat-item">
                        <span className="stat-icon">🌐</span>
                        <div className="stat-text">
                          <strong>71</strong>
                          <span>Ocean Routes</span>
                        </div>
                      </div>

                      <div className="stat-item">
                        <span className="stat-icon">💰</span>
                        <div className="stat-text">
                          <strong>pricing.csv</strong>
                          <span>Dataset Ready</span>
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
                    <div className="agent-card-row active" onClick={() => setActiveTab('route-intelligence')} style={{ cursor: 'pointer' }}>
                      <div className="agent-icon-box cyan">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/><circle cx="12" cy="12" r="10"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Route Agent</strong>
                          <span className="status-tag green">● Active ›</span>
                        </div>
                        <p>Route analysis & optimization (route_dataset.csv)</p>
                      </div>
                    </div>

                    <div className="agent-card-row active" onClick={() => setActiveTab('pricing')} style={{ cursor: 'pointer' }}>
                      <div className="agent-icon-box orange">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Pricing Agent</strong>
                          <span className="status-tag green">● Active ›</span>
                        </div>
                        <p>Freight rate calculation (pricing.csv)</p>
                      </div>
                    </div>

                    <div className="agent-card-row active" onClick={() => setActiveTab('quotation')} style={{ cursor: 'pointer' }}>
                      <div className="agent-icon-box blue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5D7A" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Quotation Agent</strong>
                          <span className="status-tag green">● Active ›</span>
                        </div>
                        <p>Customer quotation & margin calculation</p>
                      </div>
                    </div>

                    <div className="agent-card-row future">
                      <div className="agent-icon-box cyan">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#20C4D9" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Margin Agent</strong>
                          <span className="status-tag gray">● Ready (Structured)</span>
                        </div>
                        <p>Profit margin optimization</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RECENT ROUTE ANALYSES TABLE & QUICK ACTIONS ROW */}
              <div className="dashboard-bottom-grid">
                <div className="ocean-card recent-table-card">
                  <div className="card-header-between">
                    <div>
                      <h3 className="card-title">Saved History ({userEmail})</h3>
                      <p className="card-subtitle">Persisted history for your account</p>
                    </div>
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
                    <div className="empty-state-box" style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', padding: '2rem 1.5rem', borderRadius: '16px' }}>
                      <p style={{ color: '#334155', fontSize: '0.95rem', fontWeight: '500', margin: 0 }}>
                        No saved route analysis history for <strong style={{ color: '#0B5D7A' }}>{userEmail}</strong>. Click <strong style={{ color: '#062B49' }}>Analyze Route</strong> in Route Intelligence to begin.
                      </p>
                    </div>
                  )}
                </div>

                <div className="ocean-card quick-actions-card">
                  <h3 className="card-title" style={{ marginBottom: '1rem' }}>Quick Actions</h3>
                  <div className="quick-actions-grid">
                    <button className="action-tile" onClick={() => setActiveTab('route-intelligence')}>
                      <span className="tile-icon">🚀</span>
                      <strong>Analyze Route</strong>
                      <span className="tile-sub">Route Intelligence</span>
                    </button>

                    <button className="action-tile" onClick={() => setActiveTab('pricing')}>
                      <span className="tile-icon">💰</span>
                      <strong>Calculate Freight</strong>
                      <span className="tile-sub">Pricing Agent</span>
                    </button>

                    <button className="action-tile" onClick={() => setActiveTab('quotation')}>
                      <span className="tile-icon">📋</span>
                      <strong>Create Quotation</strong>
                      <span className="tile-sub">Quotation Agent</span>
                    </button>

                    <button className="action-tile" onClick={() => setActiveTab('reports')}>
                      <span className="tile-icon">📑</span>
                      <strong>Download Reports</strong>
                      <span className="tile-sub">PDF & CSV exports</span>
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

              {/* ERROR DISPLAY BANNER */}
              {!isProcessing && error && (
                <div
                  className="alert-banner alert-error"
                  style={{
                    marginTop: '1.5rem',
                    background: '#FEF2F2',
                    color: '#991B1B',
                    border: '1.5px solid #FCA5A5',
                    padding: '1rem 1.25rem',
                    borderRadius: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

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

              {/* INITIAL MAP PROMPT BEFORE ROUTE ANALYSIS */}
              {!isProcessing && (!apiResult || !apiResult.best_route) && !error && (
                <div className="ocean-card alert-warning-ocean" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', marginTop: '1.5rem' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🗺️</span>
                  <h3 style={{ color: '#062B49', marginBottom: '0.5rem' }}>Map Intelligence Ready</h3>
                  <p style={{ color: '#475569', margin: '0 auto', maxWidth: '500px', fontWeight: '500' }}>
                    Run Route Analysis to view the shipping route on the map.
                  </p>
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

                    <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                      <button className="btn-explore-orange" style={{ width: 'auto', padding: '0.65rem 1.5rem' }} onClick={() => setActiveTab('pricing')}>
                        Proceed to Calculate Pricing for {apiResult.best_route.route_name} →
                      </button>
                    </div>
                  </div>

                  {/* MAP INTELLIGENCE COMPONENT */}
                  <RouteMap
                    routes={apiResult?.available_routes || []}
                    bestRouteId={apiResult?.best_route?.route_id}
                    activeRouteId={selectedMapRoute === 'ALL' || !selectedMapRoute ? 'ALL' : selectedMapRoute?.route_id}
                    selectedRouteObj={selectedMapRoute === 'ALL' || !selectedMapRoute ? apiResult?.best_route : selectedMapRoute}
                    originName={apiResult?.query?.origin || ''}
                    destinationName={apiResult?.query?.destination || ''}
                    onSelectRoute={(r) => setSelectedMapRoute(r)}
                    onResetViewAll={() => setSelectedMapRoute('ALL')}
                  />

                  {/* AVAILABLE ROUTES COMPARISON TABLE */}
                  <div className="ocean-card comparison-table-card" style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h3 className="card-title" style={{ margin: 0 }}>Available Routes Comparison</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {selectedMapRoute !== 'ALL' && selectedMapRoute !== null && (
                          <button
                            onClick={() => setSelectedMapRoute('ALL')}
                            style={{
                              background: 'linear-gradient(135deg, #0F8B8D 0%, #062B49 100%)',
                              color: 'white',
                              border: 'none',
                              padding: '0.4rem 0.85rem',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 2px 6px rgba(15,139,141,0.25)'
                            }}
                          >
                            🌐 View All Routes on Map
                          </button>
                        )}
                        <span style={{ fontSize: '0.85rem', color: '#64748B' }}>💡 Click any route to view its specific trajectory</span>
                      </div>
                    </div>

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
                            <th>Status & Map View</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(apiResult?.available_routes || []).map((route) => {
                            const isBest = route?.route_id === apiResult?.best_route?.route_id
                            const isSingleMode = selectedMapRoute !== 'ALL' && selectedMapRoute !== null
                            const isSelectedRow = isSingleMode && selectedMapRoute?.route_id === route?.route_id
                            return (
                              <tr
                                key={route.route_id}
                                className={isSelectedRow ? 'best-choice-row' : (isBest && !isSingleMode ? 'best-choice-row' : '')}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelectedMapRoute(route)}
                              >
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
                                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {isBest ? (
                                      <span className="pill-status green">Best Choice</span>
                                    ) : (
                                      <span className="pill-status teal">Alternative</span>
                                    )}
                                    {isSelectedRow && (
                                      <span className="pill-status orange" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                                        📍 Single View Active
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>


                  {/* DOWNLOAD BUTTONS ROW AT THE BOTTOM OF ROUTE ANALYSIS REPORT */}
                  <div style={{
                    marginTop: '1.5rem',
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      className="btn-primary-teal"
                      style={{ width: 'auto', padding: '0.75rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                      onClick={handleDownloadPDF}
                      disabled={reportLoading.pdf}
                    >
                      {reportLoading.pdf ? 'Generating PDF...' : '📄 Download Route Analysis Report'}
                    </button>

                    <button
                      className="btn-explore-orange"
                      style={{ width: 'auto', padding: '0.75rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                      onClick={async () => {
                        if (!pricingResult) {
                          await calculateFreightPrice(containerType)
                        }
                        handleDownloadPricingPDF()
                      }}
                      disabled={reportLoading.pricingPdf}
                    >
                      {reportLoading.pricingPdf ? 'Generating PDF...' : '💰 Download Freight Pricing Report'}
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* =================================================================
             PAGE 3: PRICING AGENT PAGE (activeTab === 'pricing')
             ================================================================= */}
          {activeTab === 'pricing' && (
            <div className="pricing-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Freight Pricing Agent</h2>
                <p className="page-subtitle">Calculate exact freight cost breakdown using dataset rates (pricing.csv)</p>
              </div>

              {!apiResult || !apiResult.best_route ? (
                <div className="ocean-card alert-warning-ocean" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>⚠️</span>
                  <h3 style={{ color: '#062B49', marginBottom: '0.5rem' }}>No Active Route Analysis Found</h3>
                  <p style={{ color: '#475569', marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem' }}>
                    Pricing Agent requires a successful route analysis to retrieve the selected Route ID, transshipment counts, and shipment details.
                  </p>
                  <button className="btn-primary-teal" style={{ width: 'auto', margin: '0 auto' }} onClick={() => setActiveTab('route-intelligence')}>
                    🚀 Go to Route Intelligence & Analyze Route
                  </button>
                </div>
              ) : (
                <div className="pricing-content-container">

                  {/* SHIPMENT & SELECTED ROUTE SUMMARY CARD */}
                  <div className="ocean-card summary-bar-card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header-between" style={{ marginBottom: '0.85rem' }}>
                      <div className="summary-title-label" style={{ margin: 0 }}>Selected Route & Shipment Parameters</div>
                      <span className="pill-status green">Best Route: {apiResult.best_route.route_id}</span>
                    </div>

                    <div className="summary-items-row">
                      <div><span>Origin:</span> <strong>{apiResult.query.origin}</strong></div>
                      <div><span>Destination:</span> <strong>{apiResult.query.destination}</strong></div>
                      <div><span>Cargo:</span> <strong>{apiResult.query.cargo_type}</strong></div>
                      <div><span>Containers:</span> <strong>{apiResult.query.containers} TEU</strong></div>
                      <div><span>Selected Route:</span> <strong>{apiResult.best_route.route_name}</strong></div>
                      <div><span>Transit Time:</span> <strong>{apiResult.best_route.transit_days} Days</strong></div>
                      <div><span>Distance:</span> <strong>{apiResult.best_route.distance_nautical_miles.toLocaleString()} NM</strong></div>
                      <div><span>Transshipments:</span> <strong>{apiResult.best_route.transshipments}</strong></div>
                    </div>

                    {/* CONTAINER TYPE SELECTOR & CALCULATE BUTTON */}
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <label style={{ fontSize: '0.88rem', fontWeight: '700', color: '#062B49' }}>Container Type:</label>
                        <select
                          value={containerType}
                          onChange={(e) => setContainerType(e.target.value)}
                          className="form-control"
                          style={{ width: '140px', padding: '0.45rem 0.85rem' }}
                        >
                          <option value="40ft">40ft (Standard)</option>
                          <option value="20ft">20ft (Heavy)</option>
                        </select>
                      </div>

                      <button
                        className="btn-primary-teal"
                        style={{ width: 'auto', padding: '0.65rem 1.75rem' }}
                        onClick={() => calculateFreightPrice(containerType)}
                        disabled={pricingLoading}
                      >
                        {pricingLoading ? 'Calculating Freight...' : '💰 Calculate Freight Cost'}
                      </button>
                    </div>
                  </div>

                  {pricingError && (
                    <div className="alert-banner alert-error" style={{ marginBottom: '1.25rem' }}>
                      {pricingError}
                    </div>
                  )}

                  {/* PRICING RESULT BREAKDOWN CARD (Milestone 2 Specification) */}
                  {pricingResult && pricingResult.pricing && (
                    <div className="ocean-card pricing-breakdown-card" style={{ animation: 'loginCardFadeIn 0.3s ease-out' }}>
                      <div className="card-header-between" style={{ marginBottom: '1.25rem' }}>
                        <div>
                          <h3 className="card-title">Milestone 2 Freight Pricing Breakdown</h3>
                          <p className="card-subtitle">Matched Pricing Record <code>{pricingResult.pricing.pricing_id || pricingResult.pricing_id}</code> from <code>pricing.csv</code></p>
                        </div>
                        <span className="score-gold-badge" style={{ fontSize: '0.88rem' }}>
                          Currency: {pricingResult.currency}
                        </span>
                      </div>

                      {/* BREAKDOWN TABLE */}
                      <div className="table-responsive">
                        <table className="ocean-data-table">
                          <thead>
                            <tr>
                              <th>Cost Component</th>
                              <th>Rate / Formula</th>
                              <th>Per Container</th>
                              <th>Containers</th>
                              <th>Subtotal ({pricingResult.currency})</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td><strong>Base Freight</strong></td>
                              <td className="td-muted">Base rate × {pricingResult.containers}</td>
                              <td>${pricingResult.pricing.rates_per_container.base_freight_usd ?? pricingResult.pricing.rates_per_container.base_freight_per_container}</td>
                              <td className="td-bold">{pricingResult.containers}</td>
                              <td className="td-bold">${pricingResult.pricing.base_freight.toLocaleString()}</td>
                            </tr>
                            <tr>
                              <td><strong>Fuel Surcharge</strong></td>
                              <td className="td-muted">Fuel rate × {pricingResult.containers}</td>
                              <td>${pricingResult.pricing.rates_per_container.fuel_surcharge_usd ?? pricingResult.pricing.rates_per_container.fuel_surcharge_per_container}</td>
                              <td className="td-bold">{pricingResult.containers}</td>
                              <td className="td-bold">${pricingResult.pricing.fuel_surcharge.toLocaleString()}</td>
                            </tr>
                            <tr>
                              <td><strong>Port Charge</strong></td>
                              <td className="td-muted">Port rate × {pricingResult.containers}</td>
                              <td>${pricingResult.pricing.rates_per_container.port_charge_usd ?? pricingResult.pricing.rates_per_container.port_handling_per_container}</td>
                              <td className="td-bold">{pricingResult.containers}</td>
                              <td className="td-bold">${pricingResult.pricing.port_charge?.toLocaleString() ?? pricingResult.pricing.port_handling?.toLocaleString()}</td>
                            </tr>
                            <tr>
                              <td><strong>Risk Surcharge</strong></td>
                              <td className="td-muted">Risk rate × {pricingResult.containers}</td>
                              <td>${pricingResult.pricing.rates_per_container.risk_surcharge_usd ?? 0}</td>
                              <td className="td-bold">{pricingResult.containers}</td>
                              <td className="td-bold">${(pricingResult.pricing.risk_surcharge || 0).toLocaleString()}</td>
                            </tr>
                            <tr style={{ background: '#F8FAFC', borderTop: '2px solid #0B5D7A' }}>
                              <td><strong style={{ color: '#062B49' }}>1. OPERATING COST</strong></td>
                              <td className="td-muted">Base + Fuel + Port + Risk</td>
                              <td colSpan="2" className="td-muted" style={{ textAlign: 'right' }}><strong>Operating Subtotal:</strong></td>
                              <td className="td-bold" style={{ color: '#062B49', fontSize: '1.05rem' }}>
                                ${pricingResult.pricing.operating_cost?.toLocaleString()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* MILESTONE 2 DEMAND ADJUSTED COST HIGHLIGHT BOX */}
                      <div className="total-cost-highlight-box" style={{
                        marginTop: '1.5rem',
                        padding: '1.5rem 1.75rem',
                        background: 'linear-gradient(135deg, #ECFDF5 0%, #E0F2FE 100%)',
                        border: '2px solid #0F8B8D',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        boxShadow: '0 4px 16px rgba(15, 139, 141, 0.15)'
                      }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#065F46', display: 'block' }}>
                            2. DEMAND ADJUSTED COST (Milestone 2 Output)
                          </span>
                          <span style={{ fontSize: '0.88rem', color: '#0369A1', fontWeight: '600', display: 'block', marginTop: '0.2rem' }}>
                            Formula: Operating Cost (${pricingResult.pricing.operating_cost?.toLocaleString()}) × Demand Factor ({pricingResult.pricing.demand_factor})
                          </span>
                          <span style={{ fontSize: '0.82rem', color: '#64748B', display: 'block', marginTop: '0.25rem' }}>
                            Target Margin: <strong>{pricingResult.pricing.target_margin_percent}%</strong> (Data only - Not added to price)
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '2.1rem', fontWeight: '800', color: '#064E3B', letterSpacing: '-0.02em' }}>
                            ${pricingResult.pricing.demand_adjusted_cost?.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#047857', marginLeft: '0.4rem' }}>
                            {pricingResult.currency}
                          </span>
                        </div>
                      </div>

                      {/* MARGIN AGENT COMPATIBILITY PREVIEW */}
                      <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0F8B8D' }}>💡 MARGIN AGENT STRUCTURE PREVIEW</span>
                          <p style={{ fontSize: '0.82rem', color: '#475569', margin: '0.2rem 0 0' }}>
                            Estimated Customer Price (at 15% margin): <strong>${Math.round(pricingResult.pricing.total_freight_cost * 1.15).toLocaleString()} USD</strong> | Est. Profit: <strong>${Math.round(pricingResult.pricing.total_freight_cost * 0.15).toLocaleString()} USD</strong>
                          </p>
                        </div>

                        <button
                          className="btn-explore-orange"
                          style={{ width: 'auto', padding: '0.65rem 1.5rem', margin: 0 }}
                          onClick={() => {
                            generateCustomerQuotation()
                            setActiveTab('quotation')
                          }}
                        >
                          Generate Customer Quotation →
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* =================================================================
             PAGE 4: QUOTATION AGENT PAGE (activeTab === 'quotation')
             ================================================================= */}
          {activeTab === 'quotation' && (
            <div className="quotation-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Quotation Agent</h2>
                <p className="page-subtitle">Generate official customer freight quotations with broker markup</p>
              </div>

              {!pricingResult ? (
                <div className="ocean-card alert-warning-ocean" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
                  <h3 style={{ color: '#062B49', marginBottom: '0.5rem' }}>Freight Pricing Not Calculated Yet</h3>
                  <p style={{ color: '#475569', marginBottom: '1.25rem', maxWidth: '500px', margin: '0 auto 1.25rem' }}>
                    Quotation Agent consumes the Pricing Agent result to generate formal quotes.
                  </p>
                  <button className="btn-primary-teal" style={{ width: 'auto', margin: '0 auto' }} onClick={() => setActiveTab('pricing')}>
                    💰 Go to Pricing Agent & Calculate Freight
                  </button>
                </div>
              ) : (
                <div className="quotation-content-container">

                  {/* CONTROLS CARD */}
                  <div className="ocean-card form-section-card" style={{ marginBottom: '1.5rem' }}>
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Quotation Parameters</h3>

                    <div className="form-fields-grid">
                      <div className="form-field">
                        <label>Customer / Client Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter client company name"
                        />
                      </div>

                      <div className="form-field">
                        <label>Broker Margin (%)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="form-control"
                          value={marginPercent}
                          onChange={(e) => setMarginPercent(e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      className="btn-primary-teal"
                      style={{ marginTop: '1rem' }}
                      onClick={generateCustomerQuotation}
                    >
                      📄 Generate / Update Quotation
                    </button>
                  </div>

                  {/* FORMAL QUOTATION DOCUMENT CARD */}
                  <div className="ocean-card quotation-document-card" style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #0B5D7A',
                    borderRadius: '20px',
                    padding: '2.25rem',
                    boxShadow: '0 12px 36px rgba(6, 43, 73, 0.1)'
                  }}>
                    {/* DOCUMENT HEADER */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #062B49', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#062B49', margin: 0 }}>FREIGHT QUOTATION</h2>
                        <p style={{ fontSize: '0.85rem', color: '#0F8B8D', fontWeight: '700', margin: '0.2rem 0 0' }}>AGENTIC MARITIME BROKERAGE PLATFORM</p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#F5A623', background: '#FEF3C7', padding: '0.35rem 0.85rem', borderRadius: '10px', display: 'inline-block', marginBottom: '0.35rem' }}>
                          {quotationResult?.quotation_id || 'QTE-20260910-8842'}
                        </span>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Date: {new Date().toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Valid Until: 14 Days from issue</div>
                      </div>
                    </div>

                    {/* CLIENT & SHIPMENT INFORMATION */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', padding: '1.15rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>CLIENT DETAILS</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>{customerName || 'Valued Client'}</div>
                        <div style={{ fontSize: '0.82rem', color: '#475569' }}>Account Type: Commercial Freight Importer</div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>ROUTE & SHIPMENT</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>
                          {pricingResult.origin} ➔ {pricingResult.destination}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                          Route: <strong>{pricingResult.route_name}</strong> ({pricingResult.containers} x {containerType} TEU)
                        </div>
                      </div>
                    </div>

                    {/* PRICING & CUSTOMER CHARGES TABLE */}
                    <table className="ocean-data-table" style={{ marginBottom: '1.5rem' }}>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Load</th>
                          <th>Base Cost</th>
                          <th>Margin ({quotationResult?.financials?.margin_percent ?? marginPercent}%)</th>
                          <th>Customer Price ({pricingResult.currency})</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Ocean Freight & Surcharges (All-Inclusive)</strong></td>
                          <td>{pricingResult.containers} x {containerType}</td>
                          <td>${pricingResult.pricing.total_freight_cost.toLocaleString()}</td>
                          <td>
                            + ${quotationResult?.financials?.margin_amount != null
                              ? Number(quotationResult.financials.margin_amount).toLocaleString()
                              : Math.round(pricingResult.pricing.total_freight_cost * (parseFloat(marginPercent) / 100)).toLocaleString()}
                          </td>
                          <td className="td-bold" style={{ fontSize: '1.05rem', color: '#062B49' }}>
                            ${quotationResult?.financials?.customer_price != null
                              ? Number(quotationResult.financials.customer_price).toLocaleString()
                              : Math.round(pricingResult.pricing.total_freight_cost * (1 + parseFloat(marginPercent) / 100)).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* TOTAL CUSTOMER OFFER HIGHLIGHT */}
                    <div style={{
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #062B49 0%, #073B5C 100%)',
                      color: '#FFFFFF',
                      borderRadius: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#20C4D9' }}>
                          FINAL CUSTOMER QUOTATION TOTAL
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#E2E8F0', display: 'block', marginTop: '0.2rem' }}>
                          Includes all ocean freight, fuel surcharges, port handling & transshipments
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '2.2rem', fontWeight: '800', color: '#FFFFFF' }}>
                          ${quotationResult?.financials?.customer_price != null
                            ? Number(quotationResult.financials.customer_price).toLocaleString()
                            : Math.round(pricingResult.pricing.total_freight_cost * (1 + parseFloat(marginPercent) / 100)).toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: '#20C4D9', fontWeight: '700', marginLeft: '0.4rem' }}>
                          {pricingResult.currency}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: '#64748B', fontStyle: 'italic', textAlign: 'center' }}>
                      Terms: Quotation valid for 14 days. Rates subject to port congestion, carrier space availability, and fuel price adjustments.
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* =================================================================
             PAGE 5: SHIPMENTS PAGE (activeTab === 'shipments')
             ================================================================= */}
          {activeTab === 'shipments' && (
            <div className="shipments-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Shipment Management ({userEmail})</h2>
                <p className="page-subtitle">Track active, pending, and completed freight shipments for {userEmail}</p>
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
                  <div className="empty-state-box" style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', padding: '2.5rem 1.5rem', borderRadius: '16px', textAlign: 'center' }}>
                    <span className="empty-icon" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🚢</span>
                    <h3 style={{ color: '#062B49', fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.35rem' }}>No Saved Shipments for {userEmail}</h3>
                    <p style={{ color: '#334155', fontSize: '0.95rem', fontWeight: '500', margin: 0 }}>
                      Analyze routes in <strong style={{ color: '#0B5D7A' }}>Route Intelligence</strong> to save shipments to your account history.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE 6: REPORTS PAGE (activeTab === 'reports')
             ================================================================= */}
          {activeTab === 'reports' && (
            <div className="reports-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Maritime Reports</h2>
                <p className="page-subtitle">Generate exportable analytical reports for freight pricing & corridors</p>
              </div>

              {reportToast && (
                <div className="alert-banner alert-info" style={{ marginBottom: '1.25rem' }}>
                  {reportToast}
                </div>
              )}

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
                  <p>Comprehensive PDF breakdown of ocean trade corridors, transit times, transshipment stops, and best route selection for {apiResult ? `${apiResult.query.origin} ➔ ${apiResult.query.destination}` : 'your active query'}.</p>
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
                  <p>Historical evaluation of cargo delivery speed, reliability ratings, route scores, and performance metrics for {userEmail}.</p>
                  <button
                    className="btn-report-download"
                    disabled={!hasAnalysisData || reportLoading.csv}
                    onClick={handleExportCSV}
                    title={!hasAnalysisData ? 'Analyze a route first in Route Intelligence' : 'Export CSV Data'}
                  >
                    {reportLoading.csv ? 'Exporting CSV...' : 'Export CSV'}
                  </button>
                </div>

                {/* CARD 3: Freight Pricing Report */}
                <div className="ocean-card report-card">
                  <div className="report-card-top">
                    <span className="report-icon">💰</span>
                    {pricingResult ? (
                      <span className="pill-status green">Ready</span>
                    ) : (
                      <span className="pill-status gray">No Pricing Data</span>
                    )}
                  </div>
                  <h3>Freight Pricing Report</h3>
                  <p>Pricing Agent breakdown including base freight, fuel surcharge, port handling, and total freight cost calculations.</p>
                  <button
                    className="btn-report-download"
                    disabled={!pricingResult || reportLoading.pricingPdf}
                    onClick={handleDownloadPricingPDF}
                  >
                    {reportLoading.pricingPdf ? 'Generating PDF...' : 'Download Pricing PDF'}
                  </button>
                </div>

                {/* CARD 4: Transit Time Analytics */}
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
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE 7: ANALYTICS PAGE (activeTab === 'analytics')
             ================================================================= */}
          {activeTab === 'analytics' && (
            <div className="analytics-page-view">
              <div className="page-header-banner">
                <h2 className="page-title">Maritime Analytics</h2>
                <p className="page-subtitle">Real-time performance trends, freight pricing, and route score distributions</p>
              </div>

              {/* LATEST ROUTE ANALYSIS OVERVIEW CARD */}
              <div className="ocean-card summary-bar-card" style={{ marginBottom: '1.5rem' }}>
                <div className="summary-title-label">Active Route Query Analytics Overview</div>
                <div className="summary-items-row">
                  <div><span>📍 Corridor:</span> <strong>{apiResult ? `${apiResult.query.origin} ➔ ${apiResult.query.destination}` : 'No active query'}</strong></div>
                  <div><span>📦 Cargo & Load:</span> <strong>{apiResult ? `${apiResult.query.cargo_type} (${apiResult.query.containers} TEU)` : 'Awaiting analysis'}</strong></div>
                  <div><span>⭐ Recommended Route:</span> <strong>{apiResult?.best_route?.route_name || 'Awaiting analysis'}</strong></div>
                  <div><span>💰 Freight Cost:</span> <strong>{pricingResult ? `$${pricingResult.pricing.total_freight_cost.toLocaleString()} ${pricingResult.currency}` : 'Calculated in Pricing tab'}</strong></div>
                </div>
              </div>

              {/* DYNAMIC KPI METRIC CARDS */}
              <section className="kpi-cards-grid" style={{ marginBottom: '1.75rem' }}>
                <div className="kpi-card highlight-gold-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle gold"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                    <span className="kpi-trend-pill gold">Top Score</span>
                  </div>
                  <div className="kpi-label">Best Route Score</div>
                  <div className="kpi-main-val gold-val">{apiResult?.best_route ? `${apiResult.best_route.route_score}/100` : 'N/A'}</div>
                  <div className="kpi-sub-text">Composite evaluation metric</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle blue"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B5D7A" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <span className="kpi-trend-pill green">Speed</span>
                  </div>
                  <div className="kpi-label">Transit Duration</div>
                  <div className="kpi-main-val">{apiResult?.best_route ? `${apiResult.best_route.transit_days} Days` : 'N/A'}</div>
                  <div className="kpi-sub-text">Sea transit time</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle cyan"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg></div>
                    <span className="kpi-trend-pill blue">Distance</span>
                  </div>
                  <div className="kpi-label">Nautical Distance</div>
                  <div className="kpi-main-val">{apiResult?.best_route ? `${apiResult.best_route.distance_nautical_miles.toLocaleString()} NM` : 'N/A'}</div>
                  <div className="kpi-sub-text">Ocean voyage length</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-top-row">
                    <div className="kpi-icon-circle green"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#18A66A" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                    <span className="kpi-trend-pill green">Pricing Agent</span>
                  </div>
                  <div className="kpi-label">Freight Cost</div>
                  <div className="kpi-main-val" style={{ color: '#18A66A' }}>
                    {pricingResult?.pricing ? `$${pricingResult.pricing.total_freight_cost.toLocaleString()}` : 'N/A'}
                  </div>
                  <div className="kpi-sub-text">Calculated via pricing.csv</div>
                </div>
              </section>

              {/* DYNAMIC CHARTS & COMPARISON GRID */}
              <div className="analytics-grid">
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
                    <div className="empty-state-box" style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', padding: '1.5rem', borderRadius: '14px' }}>
                      <p style={{ color: '#334155', fontSize: '0.92rem', fontWeight: '500', margin: 0 }}>No candidate routes analyzed in this session. Go to <strong style={{ color: '#0B5D7A' }}>Route Intelligence</strong> and click "Analyze Route".</p>
                    </div>
                  )}
                </div>

                <div className="ocean-card analytics-stat-card">
                  <h3 className="card-title">Transit Time & Distance Breakdown</h3>
                  <p className="card-subtitle" style={{ marginBottom: '1rem' }}>Candidate route performance metrics for current session</p>

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
                    <div className="empty-state-box" style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', padding: '1.5rem', borderRadius: '14px' }}>
                      <p style={{ color: '#334155', fontSize: '0.92rem', fontWeight: '500', margin: 0 }}>No transit data logged in this session.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* =================================================================
             PAGE 8: SETTINGS PAGE (activeTab === 'settings')
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
                  <div><strong>Dataset Version:</strong> Route Dataset (71 Routes) & Pricing Dataset (70 Pricing Rates)</div>
                </div>

                <h3 className="card-title" style={{ marginTop: '1.75rem' }}>AI Agent Settings</h3>
                <div className="agent-setting-item" style={{ marginTop: '0.75rem' }}>
                  <span>Route Agent (Pandas Corridor Analysis)</span>
                  <span className="pill-status green">● Enabled</span>
                </div>
                <div className="agent-setting-item">
                  <span>Pricing Agent (pricing.csv Freight Rate Calculation)</span>
                  <span className="pill-status green">● Enabled</span>
                </div>
                <div className="agent-setting-item">
                  <span>Quotation Agent (Customer Quote Generation)</span>
                  <span className="pill-status green">● Enabled</span>
                </div>
                <div className="agent-setting-item">
                  <span>Margin Agent (Profit Optimization)</span>
                  <span className="pill-status teal">● Ready (Structured)</span>
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
              <div className="summary-bar-card" style={{ marginBottom: '1.25rem' }}>
                <div className="summary-items-row">
                  <div><span>📍 Origin:</span> <strong>{selectedShipmentModal.origin}</strong></div>
                  <div><span>🏁 Destination:</span> <strong>{selectedShipmentModal.destination}</strong></div>
                  <div><span>📦 Cargo:</span> <strong>{selectedShipmentModal.cargo_type}</strong></div>
                  <div><span>🚢 Containers:</span> <strong>{selectedShipmentModal.containers} TEU</strong></div>
                </div>
              </div>

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
                    <h4 className="why-title-head">Why this route?</h4>
                    <p className="why-body-desc">{selectedShipmentModal.full_result.best_route.selection_reason}</p>
                  </div>
                </div>
              )}

              {selectedShipmentModal.full_result?.best_route && (
                <RouteMap
                  routes={selectedShipmentModal.full_result?.available_routes || [selectedShipmentModal.full_result?.best_route]}
                  bestRouteId={selectedShipmentModal.full_result?.best_route?.route_id}
                  activeRouteId={selectedShipmentModal.full_result?.best_route?.route_id}
                  originName={selectedShipmentModal.origin}
                  destinationName={selectedShipmentModal.destination}
                  isCompact={true}
                />
              )}
            </div>

            <div className="modal-panel-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                className="btn-primary-teal"
                style={{ width: 'auto', padding: '0.65rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => handleDownloadCompleteShipmentReport(selectedShipmentModal)}
              >
                📄 Download Complete Shipment Report (PDF)
              </button>

              <button
                className="btn-secondary-outline"
                onClick={() => setSelectedShipmentModal(null)}
                style={{ background: 'transparent', border: '1px solid #94A3B8', color: '#475569', borderRadius: '10px', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: '700' }}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
