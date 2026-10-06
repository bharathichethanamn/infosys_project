import React, { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import RouteMap from './RouteMap'

function Dashboard({ user, onLogout }) {
  const [backendStatus, setBackendStatus] = useState({ connected: false, message: 'Connecting...' })
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

  // Weather Agent State
  const [weatherResult, setWeatherResult] = useState(null)
  const [weatherComparison, setWeatherComparison] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [activeWeatherTab, setActiveWeatherTab] = useState('checkpoints')

  const triggerWeatherAnalysis = async (origin, destination, oceanCorridor = null, candidateRoutes = []) => {
    setWeatherLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/weather/analyze-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: origin,
          destination: destination,
          ocean_corridor: oceanCorridor
        })
      })

      if (res.ok) {
        const wData = await res.json()
        setWeatherResult(wData)
      }

      if (candidateRoutes && candidateRoutes.length > 0) {
        const compRes = await fetch(`${API_URL}/api/weather/compare-routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routes: candidateRoutes })
        })

        if (compRes.ok) {
          const compData = await compRes.json()
          setWeatherComparison(compData)
        }
      }
    } catch (err) {
      console.error('Weather Agent Error:', err)
    } finally {
      setWeatherLoading(false)
    }
  }

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

  // Role Identification
  const isCustomer = user?.role === 'Customer' || user?.role === 'Registered Customer'
  const isBroker = !isCustomer

  // Active tab defaults to 'dashboard' for all roles
  const [activeTab, setActiveTab] = useState('dashboard')

  // Customer Requests Workflow State
  const [customerRequests, setCustomerRequests] = useState([])
  const [activeProcessingRequestId, setActiveProcessingRequestId] = useState(null)
  const [customerViewModalItem, setCustomerViewModalItem] = useState(null)

  // Customer Shipment Request Form State
  const [requestFormData, setRequestFormData] = useState({
    origin: 'Chennai',
    destination: 'Rotterdam',
    cargo_type: 'Electronics',
    container_type: '40ft',
    containers: 10,
    details: 'Temperature-controlled cargo required.',
    notes: 'Expedited customs handling.'
  })
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState('')
  const [submitErrorMsg, setSubmitErrorMsg] = useState('')

  // Modal State for "View Details"
  const [selectedShipmentModal, setSelectedShipmentModal] = useState(null)

  // Profile Management State
  const [userProfile, setUserProfile] = useState(() => {
    return {
      fullName: user?.fullName || user?.name || (isCustomer ? 'Global Logistics Corp' : 'Maritime Freight Broker Admin'),
      companyName: user?.companyName || user?.fullName || (isCustomer ? 'Global Logistics Corp' : 'Maritime Freight Brokerage LLC'),
      id: user?.id || (isCustomer ? 'CUST-88321' : 'BRK-1002'),
      email: user?.email || (isCustomer ? 'customer@maritime.com' : 'admin@maritime.com'),
      phone: user?.phone || (isCustomer ? '+1 (555) 847-2930' : '+1 (555) 019-2831'),
      address: user?.address || (isCustomer ? '100 Maritime Plaza, Suite 400, Rotterdam, Netherlands' : 'Suite 800, Harbor Tower, Rotterdam, Netherlands'),
      role: user?.role || (isCustomer ? 'Customer' : 'Broker')
    }
  })

  // Sync profile if user prop changes upon login
  useEffect(() => {
    if (user) {
      setUserProfile({
        fullName: user.fullName || user.name || (isCustomer ? 'Global Logistics Corp' : 'Maritime Freight Broker Admin'),
        companyName: user.companyName || user.fullName || (isCustomer ? 'Global Logistics Corp' : 'Maritime Freight Brokerage LLC'),
        id: user.id || (isCustomer ? 'CUST-88321' : 'BRK-1002'),
        email: user.email || (isCustomer ? 'customer@maritime.com' : 'admin@maritime.com'),
        phone: user.phone || (isCustomer ? '+1 (555) 847-2930' : '+1 (555) 019-2831'),
        address: user.address || (isCustomer ? '100 Maritime Plaza, Suite 400, Rotterdam, Netherlands' : 'Suite 800, Harbor Tower, Rotterdam, Netherlands'),
        role: user.role || (isCustomer ? 'Customer' : 'Broker')
      })
    }
  }, [user, isCustomer])

  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editFormData, setEditFormData] = useState({
    fullName: userProfile.fullName,
    companyName: userProfile.companyName,
    phone: userProfile.phone,
    address: userProfile.address
  })

  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [profileToast, setProfileToast] = useState({ type: '', message: '' })

  const handleSaveProfile = (e) => {
    e.preventDefault()
    if (!editFormData.fullName.trim()) {
      setProfileToast({ type: 'error', message: 'Full Name cannot be empty.' })
      return
    }
    const updated = {
      ...userProfile,
      fullName: editFormData.fullName,
      companyName: editFormData.companyName || editFormData.fullName,
      phone: editFormData.phone,
      address: editFormData.address
    }
    setUserProfile(updated)
    setIsEditingProfile(false)
    setProfileToast({ type: 'success', message: 'Profile information updated successfully!' })
    setTimeout(() => setProfileToast({ type: '', message: '' }), 4000)
  }

  const handleChangePasswordSubmit = (e) => {
    e.preventDefault()
    if (!passwordData.currentPassword) {
      setProfileToast({ type: 'error', message: 'Please enter your current password.' })
      return
    }
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setProfileToast({ type: 'error', message: 'New password must be at least 6 characters.' })
      return
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setProfileToast({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    setIsChangingPassword(false)
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setProfileToast({ type: 'success', message: 'Password updated successfully!' })
    setTimeout(() => setProfileToast({ type: '', message: '' }), 4000)
  }

  const API_URL = 'http://127.0.0.1:8000'

  // Fetch all customer requests from backend API or localStorage fallback
  const fetchCustomerRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/api/requests`)
      if (res.ok) {
        const data = await res.json()
        setCustomerRequests(data)
        try {
          localStorage.setItem('maritime_all_requests', JSON.stringify(data))
        } catch (e) {}
        return
      }
    } catch (e) {}

    try {
      const saved = localStorage.getItem('maritime_all_requests')
      if (saved) {
        setCustomerRequests(JSON.parse(saved))
      }
    } catch (e) {}
  }

  // Update status of a shipment request on server & local state
  const updateRequestStatus = async (requestId, updatePayload) => {
    try {
      const res = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      })
      if (res.ok) {
        const data = await res.json()
        setCustomerRequests(prev => prev.map(r => r.id === requestId ? data.request : r))
        try {
          const currentLocal = JSON.parse(localStorage.getItem('maritime_all_requests') || '[]')
          const updatedLocal = currentLocal.map(r => r.id === requestId ? data.request : r)
          localStorage.setItem('maritime_all_requests', JSON.stringify(updatedLocal))
        } catch (e) {}
        return data.request
      }
    } catch (e) {}

    setCustomerRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updatePayload } : r))
  }

  // Shipment Stages Constants for Status Tracking Workflow
  const SHIPMENT_STAGES = [
    'Shipment Confirmed',
    'Picked Up',
    'In Transit',
    'Arrived at Port',
    'Out for Delivery',
    'Delivered'
  ]

  const getStageIndex = (statusStr) => {
    if (!statusStr) return 0
    const normalized = statusStr.trim()
    if (normalized === 'Shipment Confirmed' || normalized === 'Accepted') return 0
    if (normalized === 'Picked Up') return 1
    if (normalized === 'In Transit') return 2
    if (normalized === 'Arrived at Port') return 3
    if (normalized === 'Out for Delivery') return 4
    if (normalized === 'Delivered') return 5
    return 0
  }

  const [selectedTrackRequestId, setSelectedTrackRequestId] = useState(null)

  const handleBrokerUpdateShipmentStatus = async (requestId, newStatus) => {
    const nowStr = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    await updateRequestStatus(requestId, {
      status: newStatus,
      last_updated: nowStr
    })
    setReportToast(`✅ Shipment ${requestId} status updated to: ${newStatus}`)
    setTimeout(() => setReportToast(''), 4000)
  }

  const handleCustomerAcceptQuotation = async (reqItem) => {
    const nowStr = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    await updateRequestStatus(reqItem.id, {
      status: 'Shipment Confirmed',
      last_updated: nowStr
    })
    setSelectedTrackRequestId(reqItem.id)
    setCustomerViewModalItem(null)
    setReportToast(`🎉 Quotation Accepted! Shipment ${reqItem.id} is now Confirmed and Active.`)
    setTimeout(() => setReportToast(''), 4000)
    setActiveTab('track-shipment')
  }

  // Automatically trigger Weather Agent analysis whenever apiResult exists and weatherResult is null
  useEffect(() => {
    if (apiResult && apiResult.best_route && !weatherResult && !weatherLoading) {
      triggerWeatherAnalysis(
        apiResult.query?.origin || 'Chennai',
        apiResult.query?.destination || 'Rotterdam',
        apiResult.best_route.ocean_corridor,
        apiResult.available_routes || []
      )
    }
  }, [apiResult, weatherResult, weatherLoading])

  // Load user-specific history and customer requests on mount or when user changes
  useEffect(() => {
    fetch(API_URL + '/')
      .then(res => res.json())
      .then(data => {
        setBackendStatus({ connected: true, message: data.message })
      })
      .catch(() => {
        setBackendStatus({ connected: false, message: 'Backend Offline' })
      })

    fetchCustomerRequests()

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
    setWeatherResult(null)
    setWeatherComparison(null)
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
        triggerWeatherAnalysis(data.query.origin, data.query.destination, data.best_route.ocean_corridor, data.available_routes)
      }

      if (data && (data.matched === false || data.status === 'error' || !data.best_route)) {
        setError(data.message || 'No available route found for this shipment.')
      } else if (data && data.matched && data.best_route) {
        if (activeProcessingRequestId) {
          updateRequestStatus(activeProcessingRequestId, {
            status: 'Route Analysed',
            route_result: data
          })
        }

        if (saveToHistory) {
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

      if (activeProcessingRequestId) {
        updateRequestStatus(activeProcessingRequestId, {
          status: 'Pricing Calculated',
          pricing_result: data
        })
      }

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
        throw new Error(data.detail || data.message || 'Unable to generate the quotation. Please try again.')
      }

      setQuotationResult(data)

      if (activeProcessingRequestId) {
        updateRequestStatus(activeProcessingRequestId, {
          status: 'Quotation Generated',
          quotation_result: data,
          margin_percent: parsedMargin
        })
      }

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
      alert(err.message || 'Unable to generate the quotation. Please try again.')
    }
  }

  // Action: Broker sends quotation to customer
  const sendQuotationToCustomer = async () => {
    if (!activeProcessingRequestId) {
      alert('No active request selected.')
      return
    }
    await updateRequestStatus(activeProcessingRequestId, { status: 'Quotation Sent' })
    setReportToast('✅ Formal Quotation sent to customer successfully!')
    setTimeout(() => setReportToast(''), 4000)
  }

  // Action: Customer submits shipment request
  const handleCustomerSubmitRequest = async (e) => {
    e.preventDefault()
    setSubmitErrorMsg('')
    setSubmitSuccessMsg('')

    if (!requestFormData.containers || parseInt(requestFormData.containers) <= 0) {
      setSubmitErrorMsg('Unable to submit the shipment request. Please try again.')
      return
    }

    try {
      const payload = {
        customer_id: user?.id || (userEmail ? `CUST-${userEmail}` : 'CUST-DEMO-001'),
        customer_name: user?.fullName || 'Valued Maritime Client',
        customer_email: userEmail,
        origin: requestFormData.origin,
        destination: requestFormData.destination,
        cargo_type: requestFormData.cargo_type,
        container_type: requestFormData.container_type || '40ft',
        containers: parseInt(requestFormData.containers),
        details: requestFormData.details || '',
        notes: requestFormData.notes || ''
      }

      const res = await fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('Unable to submit the shipment request. Please try again.')
      }

      const data = await res.json()
      setSubmitSuccessMsg('Shipment request submitted successfully. Waiting for broker approval.')
      fetchCustomerRequests()
      setTimeout(() => {
        setActiveTab('customer-requests')
        setSubmitSuccessMsg('')
      }, 2000)
    } catch (err) {
      setSubmitErrorMsg('Unable to submit the shipment request. Please try again.')
    }
  }

  // Action: Broker Accepts a Customer Request
  const handleBrokerAcceptRequest = async (reqItem) => {
    await updateRequestStatus(reqItem.id, { status: 'Accepted' })
    setReportToast(`✅ Request ${reqItem.id} Accepted! Click 'Start Route Analysis' to process.`)
    setTimeout(() => setReportToast(''), 4000)
  }

  // Action: Broker Rejects a Customer Request
  const handleBrokerRejectRequest = async (reqItem) => {
    await updateRequestStatus(reqItem.id, { status: 'Rejected', rejection_reason: 'Rejected by broker' })
    alert('Shipment request has been rejected.')
  }

  // Action: Broker Starts Route Analysis for an Accepted Request
  const handleBrokerStartRouteAnalysis = (reqItem) => {
    setActiveProcessingRequestId(reqItem.id)
    setFormData({
      origin: reqItem.origin,
      destination: reqItem.destination,
      cargo_type: reqItem.cargo_type,
      containers: reqItem.containers
    })
    setContainerType(reqItem.container_type || '40ft')
    setCustomerName(reqItem.customer_name)
    setActiveTab('route-intelligence')
    triggerRouteAnalysis({
      origin: reqItem.origin,
      destination: reqItem.destination,
      cargo_type: reqItem.cargo_type,
      containers: reqItem.containers
    }, true, true)
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
            {isCustomer ? (
              <>
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
                  className={`menu-link ${activeTab === 'create-request' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create-request')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  </span>
                  <span className="menu-label">New Shipment Request</span>
                </button>

                <button
                  className={`menu-link ${activeTab === 'shipments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('shipments')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  </span>
                  <span className="menu-label">My Shipments</span>
                </button>

                <button
                  className={`menu-link ${activeTab === 'customer-requests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('customer-requests')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                  </span>
                  <span className="menu-label">My Quotations</span>
                </button>

                <button
                  className={`menu-link ${activeTab === 'track-shipment' ? 'active' : ''}`}
                  onClick={() => setActiveTab('track-shipment')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </span>
                  <span className="menu-label">Track Shipment</span>
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
                  className={`menu-link ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </span>
                  <span className="menu-label">Profile</span>
                </button>
              </>
            ) : (
              <>
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
                  className={`menu-link ${activeTab === 'broker-requests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('broker-requests')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </span>
                  <span className="menu-label">Customer Requests</span>
                  {customerRequests.filter(r => r.status === 'Pending').length > 0 && (
                    <span className="badge-count-pill" style={{ backgroundColor: '#F5A623' }}>
                      {customerRequests.filter(r => r.status === 'Pending').length}
                    </span>
                  )}
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
                  className={`menu-link ${activeTab === 'weather-intelligence' ? 'active' : ''}`}
                  onClick={() => setActiveTab('weather-intelligence')}
                >
                  <span className="menu-icon">
                    <span style={{ fontSize: '1.1rem' }}>🌊</span>
                  </span>
                  <span className="menu-label">Weather Intelligence</span>
                  <span className="badge-count-pill" style={{ backgroundColor: '#0F8B8D' }}>AI</span>
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
                  <span className="menu-label">Shipment History</span>
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
                  className={`menu-link ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <span className="menu-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </span>
                  <span className="menu-label">Profile</span>
                </button>
              </>
            )}
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
              <p className="header-app-subtitle">{isCustomer ? 'Customer Portal' : 'Pricing & Route Optimization'}</p>
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
              <span>Platform: <strong>Active</strong></span>
            </div>

            <div
              className="user-profile-chip"
              onClick={() => setActiveTab('profile')}
              style={{ cursor: 'pointer' }}
              title="Click to view Profile"
            >
              <span className="user-avatar">{isCustomer ? '🚢' : '👤'}</span>
              <div className="user-info">
                <span className="user-email">{userEmail}</span>
                <span className="user-role">{user?.role || (isCustomer ? 'Customer' : 'Broker Admin')}</span>
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

          {/* AUTHORIZATION GUARD */}
          {isCustomer && !['dashboard', 'customer-requests', 'create-request', 'shipments', 'track-shipment', 'reports', 'profile'].includes(activeTab) && (
            <div style={{ padding: '2rem' }}>
              <div className="alert-banner alert-error" style={{ fontSize: '1.05rem', padding: '1.25rem' }}>
                You are not authorized to access this page.
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE: CUSTOMER REQUESTS & QUOTATIONS (CUSTOMER VIEW)
             ================================================================= */}
          {activeTab === 'customer-requests' && isCustomer && (
            <div className="dashboard-page-view">
              <div className="ocean-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header-between">
                  <div>
                    <h2 className="card-title">My Shipment Requests & Quotations</h2>
                    <p className="card-subtitle">Track your submitted requests and view finalized quotations from the broker.</p>
                  </div>
                  <button className="btn-explore-orange" onClick={() => setActiveTab('create-request')}>
                    + Create New Request
                  </button>
                </div>

                {customerRequests.some(r => ((user?.id && r.customer_id === user.id) || r.customer_email?.toLowerCase() === userEmail) && r.status === 'Quotation Sent') && (
                  <div className="alert-banner alert-info" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #18A66A' }}>
                    <div>
                      <strong>🔔 New Quotation Available!</strong> Your freight quotation has been processed and issued by the broker.
                    </div>
                  </div>
                )}
              </div>

              <div className="ocean-card">
                <div className="history-table-wrapper">
                  <table className="ocean-history-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Date</th>
                        <th>Corridor</th>
                        <th>Cargo & Load</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerRequests.filter(r => (user?.id && r.customer_id === user.id) || r.customer_email?.toLowerCase() === userEmail).length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                            No shipment requests found. Click "+ Create New Request" to submit your first cargo request!
                          </td>
                        </tr>
                      ) : (
                        customerRequests
                          .filter(r => (user?.id && r.customer_id === user.id) || r.customer_email?.toLowerCase() === userEmail)
                          .map((reqItem) => (
                            <tr key={reqItem.id}>
                              <td style={{ fontWeight: 'bold', color: '#062B49' }}>{reqItem.id}</td>
                              <td>{reqItem.request_date || 'Recent'}</td>
                              <td>{reqItem.origin} → {reqItem.destination}</td>
                              <td>{reqItem.cargo_type} ({reqItem.containers} x {reqItem.container_type || '40ft'})</td>
                              <td>
                                <span className={`status-pill ${
                                  reqItem.status === 'Pending' ? 'status-pending' :
                                  reqItem.status === 'Accepted' ? 'status-active' :
                                  reqItem.status === 'Rejected' ? 'status-rejected' :
                                  reqItem.status === 'Quotation Sent' ? 'status-completed' : 'status-in-progress'
                                }`}>
                                  {reqItem.status === 'Pending' ? 'Pending Approval' :
                                   reqItem.status === 'Quotation Sent' ? 'Quotation Available' : reqItem.status}
                                </span>
                              </td>
                              <td>
                                {SHIPMENT_STAGES.includes(reqItem.status) ? (
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                      className="btn-action-view"
                                      style={{ backgroundColor: '#0F8B8D', color: '#fff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
                                      onClick={() => {
                                        setSelectedTrackRequestId(reqItem.id)
                                        setActiveTab('track-shipment')
                                      }}
                                    >
                                      Track Shipment →
                                    </button>
                                    <button
                                      className="btn-action-view"
                                      style={{ backgroundColor: '#062B49', color: '#fff', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                                      onClick={() => setCustomerViewModalItem(reqItem)}
                                    >
                                      View Quote
                                    </button>
                                  </div>
                                ) : reqItem.status === 'Quotation Sent' || reqItem.status === 'Quotation Ready' || reqItem.quotation_result ? (
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button
                                      className="btn-action-view"
                                      style={{ backgroundColor: '#18A66A', color: '#fff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
                                      onClick={() => handleCustomerAcceptQuotation(reqItem)}
                                    >
                                      ✓ Accept & Confirm
                                    </button>
                                    <button
                                      className="btn-action-view"
                                      style={{ backgroundColor: '#0B5D7A', color: '#fff', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
                                      onClick={() => setCustomerViewModalItem(reqItem)}
                                    >
                                      View Details
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: '#64748B', fontStyle: 'italic' }}>
                                    {reqItem.status === 'Rejected' ? 'Request Rejected' : 'Waiting for Broker'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE: CREATE SHIPMENT REQUEST (CUSTOMER VIEW)
             ================================================================= */}
          {activeTab === 'create-request' && isCustomer && (
            <div className="dashboard-page-view" style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '2.5rem' }}>
              <div className="ocean-card" style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '2.5rem',
                boxShadow: '0 10px 30px rgba(6, 43, 73, 0.08)',
                border: '1px solid #E2E8F0'
              }}>
                <div style={{ paddingBottom: '1.5rem', marginBottom: '1.75rem', borderBottom: '1px solid #E2E8F0' }}>
                  <h2 className="card-title" style={{ fontSize: '1.6rem', color: '#062B49', margin: '0 0 0.35rem 0', fontWeight: '800' }}>
                    Create Shipment Request
                  </h2>
                  <p className="card-subtitle" style={{ color: '#475569', fontSize: '0.95rem', margin: 0 }}>
                    Select your shipping corridor and cargo specifications to request a formal freight quotation from our brokers.
                  </p>
                </div>

                {submitSuccessMsg && (
                  <div className="alert-banner alert-info" style={{ marginBottom: '1.5rem', backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #18A66A', padding: '0.9rem 1.25rem', borderRadius: '10px', fontWeight: '600' }}>
                    ✅ {submitSuccessMsg}
                  </div>
                )}

                {submitErrorMsg && (
                  <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem', backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '0.9rem 1.25rem', borderRadius: '10px', fontWeight: '600' }}>
                    ⚠️ {submitErrorMsg}
                  </div>
                )}

                <form onSubmit={handleCustomerSubmitRequest} className="route-query-form">
                  
                  {/* SECTION 1: ROUTE & CORRIDOR SELECTION */}
                  <div style={{ marginBottom: '1.75rem' }}>
                    <h3 style={{ fontSize: '1.05rem', color: '#062B49', marginBottom: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#0F8B8D' }}>📍</span> 1. Ocean Route & Location
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Origin Port / City *
                        </label>
                        <select
                          className="form-control"
                          value={requestFormData.origin}
                          onChange={e => setRequestFormData({ ...requestFormData, origin: e.target.value })}
                          style={{ width: '100%', padding: '0.78rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF' }}
                          required
                        >
                          <option value="">Select Origin Port...</option>
                          <option value="Chennai">Chennai, India (INMAA)</option>
                          <option value="Shanghai">Shanghai, China (CNSHA)</option>
                          <option value="Singapore">Singapore (SGSIN)</option>
                          <option value="Mumbai">Mumbai / Nhava Sheva, India (INNSA)</option>
                          <option value="Ningbo">Ningbo-Zhoushan, China (CNNGB)</option>
                          <option value="Tokyo">Tokyo, Japan (TYO)</option>
                          <option value="Dubai">Dubai / Jebel Ali, UAE (AEJEA)</option>
                          <option value="Busan">Busan, South Korea (KRPUS)</option>
                          <option value="Hong Kong">Hong Kong (HKHKG)</option>
                          <option value="Colombo">Colombo, Sri Lanka (LKCMB)</option>
                          <option value="Yokohama">Yokohama, Japan (JPYOK)</option>
                          <option value="Salalah">Salalah, Oman (OMSLH)</option>
                          <option value="Klang">Port Klang, Malaysia (MYPKG)</option>
                          <option value="Qingdao">Qingdao, China (CNTAO)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Destination Port / City *
                        </label>
                        <select
                          className="form-control"
                          value={requestFormData.destination}
                          onChange={e => setRequestFormData({ ...requestFormData, destination: e.target.value })}
                          style={{ width: '100%', padding: '0.78rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF' }}
                          required
                        >
                          <option value="">Select Destination Port...</option>
                          <option value="Rotterdam">Rotterdam, Netherlands (NLRTM)</option>
                          <option value="Los Angeles">Los Angeles, USA (USLAX)</option>
                          <option value="Hamburg">Hamburg, Germany (DEHAM)</option>
                          <option value="Felixstowe">Felixstowe, UK (GBFXT)</option>
                          <option value="New York">New York / New Jersey, USA (USNYC)</option>
                          <option value="Sydney">Sydney, Australia (AUSYD)</option>
                          <option value="Antwerp">Antwerp, Belgium (BEANR)</option>
                          <option value="Vancouver">Vancouver, Canada (CAYVR)</option>
                          <option value="Genoa">Genoa, Italy (ITGOA)</option>
                          <option value="Melbourne">Melbourne, Australia (AUMEL)</option>
                          <option value="Santos">Santos, Brazil (BRSSZ)</option>
                          <option value="Bremerhaven">Bremerhaven, Germany (DEBRV)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: CARGO & CONTAINER SPECIFICATIONS */}
                  <div style={{ marginBottom: '1.75rem' }}>
                    <h3 style={{ fontSize: '1.05rem', color: '#062B49', marginBottom: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#0F8B8D' }}>📦</span> 2. Cargo & Container Specifications
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Cargo Type *
                        </label>
                        <select
                          className="form-control"
                          value={requestFormData.cargo_type}
                          onChange={e => setRequestFormData({ ...requestFormData, cargo_type: e.target.value })}
                          style={{ width: '100%', padding: '0.78rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF' }}
                          required
                        >
                          <option value="">Select Cargo Category...</option>
                          <option value="Electronics">Electronics & IT Hardware</option>
                          <option value="Machinery">Industrial Machinery & Equipment</option>
                          <option value="Textiles">Textiles, Apparel & Garments</option>
                          <option value="General Cargo">General Freight / Dry Goods</option>
                          <option value="Food Products">Food Products & Agriculture</option>
                          <option value="Chemicals">Chemicals & Specialized Materials</option>
                          <option value="Automotive Parts">Automotive Parts & Components</option>
                          <option value="Perishables">Perishables & Temperature-Controlled</option>
                          <option value="Consumer Goods">Consumer Retail Goods</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Container Type *
                        </label>
                        <select
                          className="form-control"
                          value={requestFormData.container_type}
                          onChange={e => setRequestFormData({ ...requestFormData, container_type: e.target.value })}
                          style={{ width: '100%', padding: '0.78rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF' }}
                          required
                        >
                          <option value="40ft">40ft High Cube Container (HC)</option>
                          <option value="20ft">20ft Standard Dry Container (STD)</option>
                          <option value="40ft Standard">40ft Standard Dry Container (STD)</option>
                          <option value="40ft Reefer">40ft Refrigerated Container (Reefer)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Number of Containers (TEU) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          className="form-control"
                          value={requestFormData.containers}
                          onChange={e => setRequestFormData({ ...requestFormData, containers: Math.max(1, parseInt(e.target.value) || 1) })}
                          style={{ width: '100%', padding: '0.78rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF' }}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: SHIPMENT DETAILS & NOTES */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.05rem', color: '#062B49', marginBottom: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#0F8B8D' }}>📝</span> 3. Shipment Details & Instructions
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Required Shipment Details *
                        </label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={requestFormData.details}
                          onChange={e => setRequestFormData({ ...requestFormData, details: e.target.value })}
                          placeholder="Specify temperature settings, hazmat details, target arrival dates, or special handling instructions..."
                          style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF', fontFamily: 'inherit', resize: 'vertical' }}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#062B49', marginBottom: '0.5rem' }}>
                          Optional Notes for Broker
                        </label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={requestFormData.notes}
                          onChange={e => setRequestFormData({ ...requestFormData, notes: e.target.value })}
                          placeholder="Add any extra instructions, preferred shipping line, or expedited handling notes..."
                          style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: '1.5px solid #CBD5E1', fontSize: '0.95rem', color: '#062B49', backgroundColor: '#FFFFFF', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS BAR */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '1.25rem',
                    paddingTop: '1.75rem',
                    borderTop: '1px solid #E2E8F0'
                  }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setActiveTab('customer-requests')}
                      style={{
                        padding: '0.78rem 1.5rem',
                        borderRadius: '10px',
                        border: '1.5px solid #94A3B8',
                        background: 'transparent',
                        color: '#475569',
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-explore-orange"
                      style={{
                        padding: '0.85rem 2rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #0F8B8D 0%, #062B49 100%)',
                        color: '#FFFFFF',
                        fontWeight: '800',
                        fontSize: '0.98rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(15, 139, 141, 0.35)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      Submit Shipment Request →
                    </button>
                  </div>

                </form>
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE: BROKER CUSTOMER REQUESTS MANAGEMENT (BROKER VIEW)
             ================================================================= */}
          {activeTab === 'broker-requests' && isBroker && (
            <div className="dashboard-page-view">
              <div className="ocean-card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-header-between">
                  <div>
                    <h2 className="card-title">Customer Shipment Requests</h2>
                    <p className="card-subtitle">Review incoming customer requests, accept or reject requests, and launch Route Agent processing.</p>
                  </div>
                </div>
              </div>

              <div className="ocean-card">
                <div className="history-table-wrapper">
                  <table className="ocean-history-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Corridor</th>
                        <th>Cargo & Load</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerRequests.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                            No customer shipment requests received yet.
                          </td>
                        </tr>
                      ) : (
                        customerRequests.map((reqItem) => (
                          <tr key={reqItem.id}>
                            <td style={{ fontWeight: 'bold', color: '#062B49' }}>{reqItem.id}</td>
                            <td>
                              <div><strong>{reqItem.customer_name}</strong></div>
                              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{reqItem.customer_email}</div>
                            </td>
                            <td>{reqItem.request_date || 'Recent'}</td>
                            <td>{reqItem.origin} → {reqItem.destination}</td>
                            <td>{reqItem.cargo_type} ({reqItem.containers} x {reqItem.container_type || '40ft'})</td>
                            <td>
                              <span className={`status-pill ${
                                reqItem.status === 'Pending' ? 'status-pending' :
                                reqItem.status === 'Accepted' ? 'status-active' :
                                reqItem.status === 'Rejected' ? 'status-rejected' :
                                reqItem.status === 'Quotation Sent' ? 'status-completed' : 'status-in-progress'
                              }`}>
                                {reqItem.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                {reqItem.status === 'Pending' && (
                                  <>
                                    <button
                                      className="btn-action-accept"
                                      style={{ backgroundColor: '#18A66A', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}
                                      onClick={() => handleBrokerAcceptRequest(reqItem)}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      className="btn-action-reject"
                                      style={{ backgroundColor: '#EF4444', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '5px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}
                                      onClick={() => handleBrokerRejectRequest(reqItem)}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {(reqItem.status === 'Accepted' || reqItem.status === 'Route Analysed' || reqItem.status === 'Pricing Calculated' || reqItem.status === 'Quotation Generated' || reqItem.status === 'Quotation Sent' || SHIPMENT_STAGES.includes(reqItem.status)) && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    <button
                                      className="btn-action-process"
                                      style={{ backgroundColor: '#0F8B8D', color: '#fff', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '5px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}
                                      onClick={() => handleBrokerStartRouteAnalysis(reqItem)}
                                    >
                                      {reqItem.status === 'Accepted' ? 'Start Route Analysis →' : 'View / Reprocess'}
                                    </button>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>Status:</span>
                                      <select
                                        value={SHIPMENT_STAGES.includes(reqItem.status) ? reqItem.status : 'Shipment Confirmed'}
                                        onChange={(e) => handleBrokerUpdateShipmentStatus(reqItem.id, e.target.value)}
                                        style={{
                                          padding: '0.25rem 0.45rem',
                                          borderRadius: '5px',
                                          border: '1.5px solid #0F8B8D',
                                          fontSize: '0.78rem',
                                          fontWeight: '700',
                                          color: '#062B49',
                                          backgroundColor: '#F0F9FF',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {SHIPMENT_STAGES.map((stg, i) => (
                                          <option key={stg} value={stg}>{i + 1}. {stg}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                )}

                                {reqItem.status === 'Quotation Generated' && (
                                  <button
                                    className="btn-action-send"
                                    style={{ backgroundColor: '#F5A623', color: '#062B49', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.82rem' }}
                                    onClick={() => {
                                      setActiveProcessingRequestId(reqItem.id)
                                      sendQuotationToCustomer()
                                    }}
                                  >
                                    Send Quotation
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
             PAGE 1A: CUSTOMER DASHBOARD VIEW (activeTab === 'dashboard' && isCustomer)
             ================================================================= */}
          {activeTab === 'dashboard' && isCustomer && (() => {
            const currentCustomerId = user?.id || (userEmail ? `CUST-${userEmail}` : null)
            const userCustomerRequests = customerRequests.filter(r => {
              if (r.customer_id && currentCustomerId) {
                return r.customer_id === currentCustomerId
              }
              return r.customer_email?.toLowerCase().trim() === userEmail
            })

            const activeCount = userCustomerRequests.filter(r => ['Accepted', 'Route Analysed', 'Pricing Calculated', 'In Transit'].includes(r.status)).length
            const pendingCount = userCustomerRequests.filter(r => r.status === 'Pending').length
            const quotationsCount = userCustomerRequests.filter(r => r.status === 'Quotation Sent' || r.status === 'Quotation Ready' || r.quotation_result).length
            const completedCount = userCustomerRequests.filter(r => r.status === 'Completed').length

            const latestQuotationRequest = userCustomerRequests.find(r => r.status === 'Quotation Sent' || r.status === 'Quotation Ready' || r.quotation_result) || null
            const latestActiveShipment = userCustomerRequests[0] || null

            const hasCustomerHistory = userCustomerRequests.length > 0

            return (
              <div className="dashboard-page-view">

                {/* 1. WELCOME HERO BANNER */}
                <div className="ocean-hero-banner" style={{ backgroundImage: `url('/images/hero_banner.png')` }}>
                  <div className="hero-banner-overlay"></div>
                  <div className="hero-left-content">
                    <h2>Welcome back,</h2>
                    <h1 style={{ fontSize: '2.2rem', color: '#FFFFFF', fontWeight: '800', margin: '0.25rem 0' }}>
                      {user?.fullName || user?.name || (userEmail === 'customer@maritime.com' ? 'Global Logistics Corp' : userEmail.split('@')[0])}
                    </h1>
                    <p>{hasCustomerHistory ? 'Manage your shipments, routes and freight quotations.' : "Welcome to Maritime AI — You don't have any shipments yet."}</p>
                  </div>
                  <div className="hero-right-content">
                    <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '0.85rem 1.25rem', borderRadius: '12px', color: '#062B49', display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                      <span style={{ fontSize: '1.75rem' }}>🚢</span>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0F8B8D', textTransform: 'uppercase' }}>Global Trade</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#062B49' }}>A Cleaner Tomorrow</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* =================================================================
                   CONDITION 1: NEW CUSTOMER DASHBOARD (IF NO HISTORY EXISTS)
                   ================================================================= */}
                {!hasCustomerHistory ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    
                    {/* DEDICATED NEW CUSTOMER CLEAN EMPTY STATE CARD */}
                    <div className="ocean-card" style={{ padding: '3.5rem 2.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(6, 43, 73, 0.06)' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#F0F9FF', border: '2px solid #BAE6FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', marginBottom: '1.25rem' }}>
                        🚢
                      </div>
                      <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#062B49', marginBottom: '0.4rem' }}>
                        Welcome to Maritime AI
                      </h2>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0B5D7A', marginBottom: '1rem' }}>
                        You don't have any shipments yet.
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.95rem', maxWidth: '540px', lineHeight: '1.6', marginBottom: '2rem' }}>
                        Start managing your maritime freight today. Submit your cargo details to receive AI-powered ocean route recommendations and transparent broker freight quotations.
                      </p>
                      <button
                        className="btn-explore-orange"
                        style={{ padding: '0.95rem 2.25rem', fontSize: '1.05rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontWeight: '800', borderRadius: '30px' }}
                        onClick={() => setActiveTab('create-request')}
                      >
                        <span style={{ fontSize: '1.3rem', lineHeight: '1' }}>+</span> Create Shipment Request
                      </button>
                    </div>

                    {/* SIMPLE QUICK ACTIONS CARD */}
                    <div className="ocean-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                      <div>
                        <h3 className="card-title" style={{ fontSize: '1.25rem', color: '#062B49', marginBottom: '0.35rem' }}>Simple Quick Actions</h3>
                        <p className="card-subtitle" style={{ marginBottom: '1.5rem' }}>Get started with your customer account</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div
                            style={{ background: '#F0F9FF', padding: '1.1rem 1rem', borderRadius: '14px', border: '1.5px solid #BAE6FD', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s ease' }}
                            onClick={() => setActiveTab('create-request')}
                          >
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0284C7', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 'bold' }}>+</div>
                            <div>
                              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#062B49' }}>Create Shipment Request</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Submit cargo details for broker evaluation</div>
                            </div>
                          </div>

                          <div
                            style={{ background: '#F8FAFC', padding: '1.1rem 1rem', borderRadius: '14px', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s ease' }}
                            onClick={() => setActiveTab('customer-requests')}
                          >
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0B5D7A', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📄</div>
                            <div>
                              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#062B49' }}>View Quotations</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Check pending and issued quotations</div>
                            </div>
                          </div>

                          <div
                            style={{ background: '#F8FAFC', padding: '1.1rem 1rem', borderRadius: '14px', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.2s ease' }}
                            onClick={() => setActiveTab('customer-requests')}
                          >
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#0F8B8D', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📍</div>
                            <div>
                              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#062B49' }}>Track Shipment</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>Monitor active cargo status in real-time</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  /* =================================================================
                     CONDITION 2: EXISTING CUSTOMER DASHBOARD (IF HISTORY EXISTS)
                     ================================================================= */
                  <>
                    {/* 2. KPI CARDS ROW (4 CARDS) */}
                    <section className="kpi-cards-grid">
                      {/* CARD 1: Active Shipments */}
                      <div className="kpi-card">
                        <div className="kpi-top-row">
                          <div className="kpi-icon-circle blue">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0B5D7A" strokeWidth="2.2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.48 2.38 7"/></svg>
                          </div>
                        </div>
                        <div className="kpi-label">Active Shipments</div>
                        <div className="kpi-main-val">{activeCount}</div>
                        <div className="kpi-sub-text">Currently in transit</div>
                      </div>

                      {/* CARD 2: Pending Requests */}
                      <div className="kpi-card">
                        <div className="kpi-top-row">
                          <div className="kpi-icon-circle yellow" style={{ background: '#FEF3C7' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
                          </div>
                        </div>
                        <div className="kpi-label">Pending Requests</div>
                        <div className="kpi-main-val">{pendingCount}</div>
                        <div className="kpi-sub-text">Awaiting broker processing</div>
                      </div>

                      {/* CARD 3: Available Quotations */}
                      <div className="kpi-card">
                        <div className="kpi-top-row">
                          <div className="kpi-icon-circle green" style={{ background: '#DCFCE7' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                          </div>
                        </div>
                        <div className="kpi-label">Available Quotations</div>
                        <div className="kpi-main-val">{quotationsCount}</div>
                        <div className="kpi-sub-text">New quotations received</div>
                      </div>

                      {/* CARD 4: Completed Shipments */}
                      <div className="kpi-card">
                        <div className="kpi-top-row">
                          <div className="kpi-icon-circle purple" style={{ background: '#F3E8FF' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7E22CE" strokeWidth="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          </div>
                        </div>
                        <div className="kpi-label">Completed Shipments</div>
                        <div className="kpi-main-val">{completedCount}</div>
                        <div className="kpi-sub-text">Successfully delivered</div>
                      </div>
                    </section>

                    {/* 3. MAIN GRID TOP ROW (MY RECENT SHIPMENTS & LATEST QUOTATION) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      
                      {/* LEFT SECTION: MY RECENT SHIPMENTS */}
                      <div className="ocean-card">
                        <div className="card-header-between" style={{ marginBottom: '1rem' }}>
                          <h3 className="card-title" style={{ fontSize: '1.2rem', color: '#062B49' }}>My Recent Shipments</h3>
                          <a href="#viewall" className="link-text" onClick={(e) => { e.preventDefault(); setActiveTab('customer-requests'); }} style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0B5D7A' }}>
                            View All
                          </a>
                        </div>

                        <div className="history-table-wrapper">
                          <table className="ocean-history-table">
                            <thead>
                              <tr>
                                <th>Request ID</th>
                                <th>Route</th>
                                <th>Cargo</th>
                                <th>Containers</th>
                                <th>Status</th>
                                <th>Requested Date</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userCustomerRequests.slice(0, 5).map((item) => (
                                <tr key={item.id}>
                                  <td style={{ fontWeight: 'bold', color: '#062B49' }}>{item.id}</td>
                                  <td style={{ fontWeight: '600' }}>{item.origin} → {item.destination}</td>
                                  <td>{item.cargo_type}</td>
                                  <td>{item.containers} × {item.container_type || '40ft'}</td>
                                  <td>
                                    <span className={`status-pill ${
                                      item.status === 'Quotation Ready' || item.status === 'Quotation Sent' ? 'status-ready' :
                                      item.status === 'In Review' || item.status === 'Pending' ? 'status-review' :
                                      item.status === 'Accepted' ? 'status-accepted' :
                                      item.status === 'Completed' ? 'status-completed' : 'status-in-progress'
                                    }`} style={{
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: '20px',
                                      fontSize: '0.78rem',
                                      fontWeight: '700',
                                      display: 'inline-block',
                                      backgroundColor:
                                        item.status === 'Quotation Ready' || item.status === 'Quotation Sent' ? '#DCFCE7' :
                                        item.status === 'In Review' || item.status === 'Pending' ? '#FEF3C7' :
                                        item.status === 'Accepted' ? '#E0F2FE' :
                                        item.status === 'Completed' ? '#F3E8FF' : '#F1F5F9',
                                      color:
                                        item.status === 'Quotation Ready' || item.status === 'Quotation Sent' ? '#15803D' :
                                        item.status === 'In Review' || item.status === 'Pending' ? '#D97706' :
                                        item.status === 'Accepted' ? '#0369A1' :
                                        item.status === 'Completed' ? '#7E22CE' : '#475569'
                                    }}>
                                      {item.status === 'Quotation Sent' ? 'Quotation Available' : item.status}
                                    </span>
                                  </td>
                                  <td>{item.request_date || 'Recent'}</td>
                                  <td>
                                    <button
                                      className="btn-action-view"
                                      style={{
                                        backgroundColor: '#FFFFFF',
                                        color: '#0B5D7A',
                                        border: '1px solid #0B5D7A',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        fontSize: '0.82rem'
                                      }}
                                      onClick={() => setCustomerViewModalItem(item)}
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* RIGHT SECTION: LATEST QUOTATION */}
                      <div className="ocean-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        {latestQuotationRequest ? (
                          <div>
                            <div className="card-header-between" style={{ marginBottom: '0.85rem' }}>
                              <h3 className="card-title" style={{ fontSize: '1.2rem', color: '#062B49' }}>Latest Quotation</h3>
                              <a href="#viewall" className="link-text" onClick={(e) => { e.preventDefault(); setActiveTab('customer-requests'); }} style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0B5D7A' }}>
                                View All
                              </a>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem', border: '1px solid #E2E8F0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>📄</span>
                                <strong style={{ color: '#062B49', fontSize: '1rem' }}>{latestQuotationRequest.origin} → {latestQuotationRequest.destination}</strong>
                              </div>
                              <span style={{ background: '#DCFCE7', color: '#15803D', padding: '0.25rem 0.65rem', borderRadius: '15px', fontSize: '0.78rem', fontWeight: '700' }}>
                                Quotation Ready
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                                <div style={{ marginBottom: '0.4rem' }}>Selected Route : <strong>{latestQuotationRequest.quotation_result?.route_name || latestQuotationRequest.route_result?.best_route?.route_name || 'Express Suez Direct'}</strong></div>
                                <div style={{ marginBottom: '0.4rem' }}>Transit Time : <strong>{latestQuotationRequest.quotation_result?.transit_days || latestQuotationRequest.route_result?.best_route?.transit_days || 21} Days</strong></div>
                                <div style={{ marginBottom: '0.4rem' }}>Distance : <strong>{latestQuotationRequest.quotation_result?.distance_nautical_miles || 6500} NM</strong></div>
                                <div style={{ marginBottom: '0.4rem' }}>Cargo : <strong>{latestQuotationRequest.cargo_type}</strong></div>
                                <div>Containers : <strong>{latestQuotationRequest.containers} × {latestQuotationRequest.container_type || '40ft'}</strong></div>
                              </div>

                              {/* Embedded Small Map Preview */}
                              <div style={{ height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                                <RouteMap
                                  routes={[{
                                    route_id: 'R-MAP-01',
                                    route_name: latestQuotationRequest.quotation_result?.route_name || 'Express Suez Direct',
                                    transit_days: latestQuotationRequest.quotation_result?.transit_days || 21,
                                    distance_nautical_miles: 6500,
                                    transshipments: 0,
                                    route_score: 94
                                  }]}
                                  bestRouteId="R-MAP-01"
                                  activeRouteId="R-MAP-01"
                                  originName={latestQuotationRequest.origin}
                                  destinationName={latestQuotationRequest.destination}
                                  isCompact={true}
                                />
                              </div>
                            </div>

                            {/* Pricing Row (Customer Prices Only) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#F0F9FF', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid #BAE6FD' }}>
                              <div>
                                <span style={{ fontSize: '0.78rem', color: '#0369A1', display: 'block', fontWeight: '600' }}>Freight Base Cost</span>
                                <strong style={{ fontSize: '1.2rem', color: '#062B49' }}>
                                  $ {latestQuotationRequest.quotation_result?.total_freight_cost?.toLocaleString() || '20,700'}
                                </strong>
                              </div>
                              <div>
                                <span style={{ fontSize: '0.78rem', color: '#0369A1', display: 'block', fontWeight: '600' }}>Final Customer Price</span>
                                <strong style={{ fontSize: '1.2rem', color: '#062B49' }}>
                                  $ {latestQuotationRequest.quotation_result?.customer_price?.toLocaleString() || '22,149'}
                                </strong>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                              <button
                                className="btn-primary"
                                style={{ backgroundColor: '#0B5D7A', color: '#FFFFFF', padding: '0.65rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                onClick={() => setCustomerViewModalItem(latestQuotationRequest)}
                              >
                                <span>👁️</span> View Quotation
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ backgroundColor: '#FFFFFF', color: '#0B5D7A', border: '1px solid #0B5D7A', padding: '0.65rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                onClick={() => handleDownloadCompleteShipmentReport(latestQuotationRequest)}
                              >
                                <span style={{ color: '#EF4444' }}>📄</span> Download PDF
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="card-header-between" style={{ marginBottom: '0.85rem' }}>
                              <h3 className="card-title" style={{ fontSize: '1.2rem', color: '#062B49' }}>Latest Quotation</h3>
                            </div>
                            <div style={{ padding: '2rem 1rem', textAlignment: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', textAlign: 'center' }}>
                              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⏳</span>
                              <strong style={{ color: '#062B49', display: 'block', fontSize: '1rem', marginBottom: '0.35rem' }}>Quotation In Progress</strong>
                              <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>Your request is currently being evaluated by the broker.</p>
                              <button
                                className="btn-primary"
                                style={{ marginTop: '1rem', backgroundColor: '#0B5D7A', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}
                                onClick={() => setActiveTab('customer-requests')}
                              >
                                View Request Status
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. MAIN GRID BOTTOM ROW (SHIPMENT TRACKING & QUICK ACTIONS) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '1.5rem' }}>
                      
                      {/* BOTTOM LEFT: SHIPMENT TRACKING */}
                      <div className="ocean-card">
                        <div className="card-header-between" style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h3 className="card-title" style={{ fontSize: '1.2rem', color: '#062B49', margin: 0 }}>Shipment Tracking</h3>
                            {latestActiveShipment && (
                              <span style={{ background: '#F1F5F9', color: '#062B49', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '800' }}>
                                {latestActiveShipment.id} &nbsp; {latestActiveShipment.origin} → {latestActiveShipment.destination}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* STEPPER TIMELINE */}
                        <div style={{ padding: '1.5rem 0.5rem 0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                            {/* Background Line */}
                            <div style={{ position: 'absolute', top: '16px', left: '8%', right: '8%', height: '4px', background: '#E2E8F0', zIndex: 1 }}></div>
                            {/* Active Progress Line */}
                            <div style={{
                              position: 'absolute',
                              top: '16px',
                              left: '8%',
                              width: latestActiveShipment?.status === 'Quotation Sent' || latestActiveShipment?.status === 'Quotation Ready' ? '65%' :
                                     latestActiveShipment?.status === 'Accepted' || latestActiveShipment?.status === 'Route Analysed' ? '42%' : '18%',
                              height: '4px',
                              background: '#18A66A',
                              zIndex: 2
                            }}></div>

                            {/* STAGE 1: Request Submitted */}
                            <div style={{ zIndex: 3, textAlign: 'center', flex: 1 }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#18A66A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontWeight: 'bold' }}>✓</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#062B49' }}>Request Submitted</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{latestActiveShipment?.request_date || 'Completed'}</div>
                            </div>

                            {/* STAGE 2: Broker Accepted */}
                            <div style={{ zIndex: 3, textAlign: 'center', flex: 1 }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: ['Accepted', 'Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '#18A66A' : '#E2E8F0',
                                color: ['Accepted', 'Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '#FFFFFF' : '#94A3B8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontWeight: 'bold'
                              }}>{['Accepted', 'Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '✓' : '•'}</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#062B49' }}>Broker Accepted</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{['Accepted', 'Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent'].includes(latestActiveShipment?.status) ? 'Confirmed' : 'Pending'}</div>
                            </div>

                            {/* STAGE 3: Route Selected */}
                            <div style={{ zIndex: 3, textAlign: 'center', flex: 1 }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: ['Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '#FFFFFF' : '#E2E8F0',
                                border: ['Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '3px solid #18A66A' : 'none',
                                color: ['Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '#18A66A' : '#94A3B8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontWeight: 'bold'
                              }}>{['Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '🎯' : '•'}</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '800', color: ['Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent'].includes(latestActiveShipment?.status) ? '#18A66A' : '#64748B' }}>Route Selected</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{['Route Analysed', 'Pricing Calculated', 'Quotation Ready', 'Quotation Sent'].includes(latestActiveShipment?.status) ? 'Evaluated' : 'Pending'}</div>
                            </div>

                            {/* STAGE 4: Quotation Ready */}
                            <div style={{ zIndex: 3, textAlign: 'center', flex: 1 }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: ['Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '#18A66A' : '#E2E8F0',
                                color: ['Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '#FFFFFF' : '#94A3B8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontWeight: 'bold'
                              }}>{['Quotation Ready', 'Quotation Sent', 'Completed'].includes(latestActiveShipment?.status) ? '✓' : '•'}</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#64748B' }}>Quotation Ready</div>
                              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{['Quotation Ready', 'Quotation Sent'].includes(latestActiveShipment?.status) ? 'Available' : 'Pending'}</div>
                            </div>

                            {/* STAGE 5: Shipment in Transit */}
                            <div style={{ zIndex: 3, textAlign: 'center', flex: 1 }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E2E8F0', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem', fontWeight: 'bold' }}>•</div>
                              <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#64748B' }}>Shipment in Transit</div>
                              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>-</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BOTTOM RIGHT: QUICK ACTIONS */}
                      <div className="ocean-card">
                        <h3 className="card-title" style={{ fontSize: '1.2rem', color: '#062B49', marginBottom: '1rem' }}>Quick Actions</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                          {/* Card 1: Create Request */}
                          <div
                            style={{ background: '#F0F9FF', padding: '0.85rem 0.65rem', borderRadius: '10px', border: '1px solid #BAE6FD', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease' }}
                            onClick={() => setActiveTab('create-request')}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#0284C7', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', marginBottom: '0.5rem' }}>+</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#062B49', marginBottom: '0.2rem' }}>Create Shipment Request</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: '1.2' }}>Request a new route and quotation</div>
                          </div>

                          {/* Card 2: View Quotations */}
                          <div
                            style={{ background: '#F0F9FF', padding: '0.85rem 0.65rem', borderRadius: '10px', border: '1px solid #BAE6FD', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease' }}
                            onClick={() => setActiveTab('customer-requests')}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#0B5D7A', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', marginBottom: '0.5rem' }}>📄</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#062B49', marginBottom: '0.2rem' }}>View Quotations</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: '1.2' }}>Check your received quotations</div>
                          </div>

                          {/* Card 3: Track Shipment */}
                          <div
                            style={{ background: '#F0F9FF', padding: '0.85rem 0.65rem', borderRadius: '10px', border: '1px solid #BAE6FD', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease' }}
                            onClick={() => setActiveTab('customer-requests')}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#0F8B8D', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', marginBottom: '0.5rem' }}>📍</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#062B49', marginBottom: '0.2rem' }}>Track Shipment</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: '1.2' }}>Track your ongoing shipments</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>
            )
          })()}

          {/* =================================================================
             PAGE 1B: BROKER DASHBOARD VIEW (activeTab === 'dashboard' && isBroker)
             ================================================================= */}
          {activeTab === 'dashboard' && isBroker && (
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

                    <div className="agent-card-row active" onClick={() => setActiveTab('route-intelligence')} style={{ cursor: 'pointer' }}>
                      <div className="agent-icon-box cyan" style={{ background: '#E0F2FE' }}>
                        <span style={{ fontSize: '1.1rem' }}>🌊</span>
                      </div>
                      <div className="agent-details">
                        <div className="agent-title-row">
                          <strong>Weather Agent</strong>
                          <span className="status-tag green">● Active ›</span>
                        </div>
                        <p>Marine weather risk & ocean safety intelligence</p>
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
                      <button className="btn-explore-orange" style={{ width: 'auto', padding: '0.65rem 1.5rem', cursor: 'pointer' }} onClick={() => setActiveTab('weather-intelligence')}>
                        Proceed to Weather Agent for {apiResult.best_route.route_name} →
                      </button>
                    </div>
                  </div>

                  {/* MAP INTELLIGENCE COMPONENT */}
                  <RouteMap
                    routes={apiResult?.available_routes || []}
                    weatherData={weatherResult}
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
                                onClick={() => {
                                  setSelectedMapRoute(route)
                                  if (apiResult && apiResult.query) {
                                    triggerWeatherAnalysis(
                                      apiResult.query.origin,
                                      apiResult.query.destination,
                                      route.ocean_corridor,
                                      apiResult.available_routes
                                    )
                                  }
                                }}
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


                  {/* DOWNLOAD BUTTONS REMOVED AS REQUESTED */}

                </div>
              )}

            </div>
          )}

          {/* =================================================================
             PAGE 2B: WEATHER INTELLIGENCE PAGE (activeTab === 'weather-intelligence')
             ================================================================= */}
          {activeTab === 'weather-intelligence' && (
            <div className="dashboard-page-view">
              
              {/* PAGE HEADER BANNER */}
              <div className="page-header-banner" style={{ background: '#FFFFFF', padding: '1.25rem 1.75rem', borderRadius: '14px', border: '1px solid #E2E8F0', marginBottom: '1.25rem', boxShadow: '0 2px 10px rgba(6,43,73,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.6rem' }}>🌊</span>
                      <h2 className="page-title" style={{ margin: 0, color: '#062B49', fontSize: '1.5rem', fontWeight: '800' }}>Weather Intelligence</h2>
                      <span className="badge-count-pill" style={{ backgroundColor: '#0F8B8D', color: '#FFFFFF', fontWeight: '800' }}>AI Weather Agent</span>
                    </div>
                    <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.92rem' }}>
                      AI-powered weather and marine risk analysis for maritime routes
                    </p>
                  </div>
                  
                  {apiResult?.best_route && (
                    <button
                      className="btn-primary-teal"
                      style={{ width: 'auto', backgroundColor: '#F5A623', color: '#062B49', fontWeight: '800', border: 'none', padding: '0.6rem 1.25rem', cursor: 'pointer', borderRadius: '8px' }}
                      onClick={() => setActiveTab('pricing')}
                    >
                      Proceed to Pricing Agent →
                    </button>
                  )}
                </div>
              </div>

              {!apiResult || !apiResult.best_route ? (
                <div className="ocean-card alert-warning-ocean" style={{ textAlign: 'center', padding: '3rem 1.5rem', borderRadius: '16px', background: '#FFFFFF', border: '1.5px solid #BAE6FD' }}>
                  <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 1rem' }}>
                    🌊
                  </div>
                  <h3 style={{ color: '#062B49', fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem' }}>No Active Route Weather Data</h3>
                  <p style={{ color: '#475569', fontSize: '0.98rem', marginBottom: '1.5rem', maxWidth: '560px', margin: '0 auto 1.5rem' }}>
                    Weather Agent requires a calculated route to retrieve multi-checkpoint atmospheric & marine wave data. Run a route analysis in Route Intelligence first!
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn-primary-teal"
                      style={{ width: 'auto', padding: '0.75rem 1.5rem', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => setActiveTab('route-intelligence')}
                    >
                      🚀 Go to Route Intelligence & Analyze Route
                    </button>
                    <button
                      className="btn-explore-orange"
                      style={{ width: 'auto', padding: '0.75rem 1.5rem', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => {
                        setActiveTab('route-intelligence')
                        triggerRouteAnalysis({
                          origin: 'Chennai',
                          destination: 'Rotterdam',
                          cargo_type: 'Machinery',
                          containers: 10
                        }, true, true)
                      }}
                    >
                      ⚡ Run Sample Weather Analysis (Chennai ➔ Rotterdam)
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  
                  {/* WEATHER AGENT ACTIVE ROUTE COMPUTATION & LOADING STATE */}
                  {weatherLoading ? (
                    <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '3rem 2rem', border: '1px solid #BAE6FD', textAlign: 'center', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(6,43,73,0.04)' }}>
                      <div className="spinner-border" style={{ width: '48px', height: '48px', border: '4px solid #E0F2FE', borderTopColor: '#0070F3', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                      <h3 style={{ color: '#062B49', fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.4rem' }}>AI Weather Agent Analyzing Candidate Routes...</h3>
                      <p style={{ color: '#64748B', fontSize: '0.9rem', margin: 0 }}>
                        Retrieving real-time marine wave swell, wind velocity, and atmospheric visibility across sea checkpoints for {apiResult.available_routes?.length || 0} candidate routes.
                      </p>
                    </div>
                  ) : (() => {
                    const activeSelectedRouteId = (selectedMapRoute && selectedMapRoute !== 'ALL') ? selectedMapRoute.route_id : apiResult.best_route?.route_id
                    const activeRouteObj = (apiResult.available_routes || []).find(r => r.route_id === activeSelectedRouteId) || apiResult.best_route
                    const activeRouteWeather = (weatherComparison?.comparison || []).find(c => c.route_id === activeSelectedRouteId) || weatherResult
                    const weatherRiskScore = activeRouteWeather?.weather_risk_score ?? activeRouteWeather?.risk_score ?? 35

                    return (
                      <div>
                        {/* TOP SUMMARY SECTION - 5 CARDS ROW MATCHING REFERENCE IMAGE */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                          
                          {/* CARD 1: ACTIVE SHIPMENT CORRIDOR */}
                          <div style={{ background: '#FFFFFF', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ACTIVE SHIPMENT CORRIDOR</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#062B49', marginTop: '0.2rem' }}>
                              {apiResult.query?.origin || 'Chennai'} ➔ {apiResult.query?.destination || 'Rotterdam'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Corridor: {activeRouteObj?.ocean_corridor || apiResult.best_route?.ocean_corridor || 'Ocean Shipping Corridor'}
                            </div>
                          </div>

                          {/* CARD 2: OVERALL WEATHER RISK */}
                          <div style={{ background: '#FFFFFF', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>OVERALL WEATHER RISK</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.2rem' }}>
                              <div style={{ fontSize: '1.35rem', fontWeight: '900', color: weatherRiskScore > 60 ? '#EF4444' : weatherRiskScore > 40 ? '#F5A623' : '#18A66A' }}>
                                {weatherRiskScore} / 100
                              </div>
                              <span style={{
                                padding: '0.2rem 0.65rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                backgroundColor: weatherRiskScore > 60 ? '#FEF2F2' : weatherRiskScore > 40 ? '#FEF3C7' : '#DCFCE7',
                                color: weatherRiskScore > 60 ? '#991B1B' : weatherRiskScore > 40 ? '#B45309' : '#15803D',
                                border: `1px solid ${weatherRiskScore > 60 ? '#FCA5A5' : weatherRiskScore > 40 ? '#FDE68A' : '#86EFAC'}`
                              }}>
                                {weatherRiskScore > 60 ? '🔴 HIGH' : weatherRiskScore > 40 ? '🟡 MODERATE' : '🟢 LOW'}
                              </span>
                            </div>
                          </div>

                          {/* CARD 3: WEATHER TREND */}
                          <div style={{ background: '#FFFFFF', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F0F9FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                              🔀
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>WEATHER TREND</div>
                              <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#062B49' }}>{activeRouteWeather?.weather_trend || 'Stable Conditions'}</div>
                              <div style={{ fontSize: '0.74rem', color: '#64748B' }}>Corridor forecast monitored</div>
                            </div>
                          </div>

                          {/* CARD 4: TRANSIT DELAY IMPACT */}
                          <div style={{ background: '#FFFFFF', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                              🕒
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>TRANSIT DELAY IMPACT</div>
                              <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#062B49' }}>
                                {activeRouteWeather?.transit_impact ? activeRouteWeather.transit_impact.split(' ')[0] + ' Impact' : 'Low Impact'}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                {weatherRiskScore > 60 ? '24 – 48 hours expected' : weatherRiskScore > 40 ? '6 – 12 hours expected' : 'Minimal / On schedule'}
                              </div>
                            </div>
                          </div>

                          {/* CARD 5: CHECKPOINTS ANALYZED */}
                          <div style={{ background: '#FFFFFF', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E0F2FE', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                              📍
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>CHECKPOINTS ANALYZED</div>
                              <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#062B49' }}>
                                {activeRouteWeather?.checkpoints?.length || 5} Sea Checkpoints
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* ORIGIN & DESTINATION PORT WEATHER CARDS ROW */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                          
                          {/* ORIGIN PORT CARD */}
                          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📍 ORIGIN PORT WEATHER</span>
                            </div>
                            <h3 style={{ margin: '0 0 0.85rem 0', color: '#062B49', fontSize: '1.15rem', fontWeight: '800' }}>
                              {apiResult.query?.origin || 'Origin Port'} (Origin Port)
                            </h3>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '2.5rem' }}>🌤️</span>
                                <span style={{ fontSize: '2.1rem', fontWeight: '900', color: '#062B49' }}>
                                  {activeRouteWeather?.checkpoints?.[0]?.metrics?.temperature_c || 28.4}°C
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.25rem', fontSize: '0.84rem', color: '#475569' }}>
                                <div>💨 Wind: <strong style={{ color: '#062B49' }}>{activeRouteWeather?.checkpoints?.[0]?.metrics?.wind_speed_knots || 14.2} kts</strong></div>
                                <div>🌊 Waves: <strong style={{ color: '#062B49' }}>{activeRouteWeather?.checkpoints?.[0]?.metrics?.wave_height_m || 1.5} m</strong></div>
                                <div>👁️ Visibility: <strong style={{ color: '#062B49' }}>{activeRouteWeather?.checkpoints?.[0]?.metrics?.visibility_km || 10.0} km</strong></div>
                              </div>

                              <div style={{ textAlign: 'right', background: '#F8FAFC', padding: '0.5rem 0.85rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Sea State</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#062B49' }}>⚓ Calm / Smooth</div>
                              </div>
                            </div>
                          </div>

                          {/* DESTINATION PORT CARD */}
                          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0F766E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📍 DESTINATION PORT WEATHER</span>
                            </div>
                            <h3 style={{ margin: '0 0 0.85rem 0', color: '#062B49', fontSize: '1.15rem', fontWeight: '800' }}>
                              {apiResult.query?.destination || 'Destination Port'} (Destination Port)
                            </h3>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '2.5rem' }}>☁️</span>
                                <span style={{ fontSize: '2.1rem', fontWeight: '900', color: '#062B49' }}>
                                  {activeRouteWeather?.checkpoints?.[activeRouteWeather?.checkpoints?.length - 1]?.metrics?.temperature_c || 16.5}°C
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.25rem', fontSize: '0.84rem', color: '#475569' }}>
                                <div>💨 Wind: <strong style={{ color: '#062B49' }}>{activeRouteWeather?.checkpoints?.[activeRouteWeather?.checkpoints?.length - 1]?.metrics?.wind_speed_knots || 12.0} kts</strong></div>
                                <div>🌊 Waves: <strong style={{ color: '#062B49' }}>{activeRouteWeather?.checkpoints?.[activeRouteWeather?.checkpoints?.length - 1]?.metrics?.wave_height_m || 1.1} m</strong></div>
                                <div>👁️ Visibility: <strong style={{ color: '#062B49' }}>{activeRouteWeather?.checkpoints?.[activeRouteWeather?.checkpoints?.length - 1]?.metrics?.visibility_km || 15.0} km</strong></div>
                              </div>

                              <div style={{ textAlign: 'right', background: '#F8FAFC', padding: '0.5rem 0.85rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Sea State</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#062B49' }}>⚓ Smooth / Slight</div>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* MAIN SECTION TABS & CANDIDATE ROUTE WEATHER COMPARISON TABLE */}
                        <div className="ocean-card" style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.5rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(6,43,73,0.04)' }}>
                          
                          {/* TABS HEADER */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                              className="tab-filter-btn active"
                              style={{ padding: '0.5rem 1.15rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '800', background: '#0070F3', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}
                            >
                              Candidate Route Weather Comparison
                            </button>
                            <button
                              className="tab-filter-btn"
                              onClick={() => setActiveWeatherTab('checkpoints')}
                              style={{ padding: '0.5rem 1.15rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', background: 'transparent', color: '#475569', border: '1px solid #CBD5E1', cursor: 'pointer' }}
                            >
                              📍 Route Checkpoints ({activeRouteWeather?.checkpoints?.length || 5})
                            </button>
                            <button
                              className="tab-filter-btn"
                              onClick={() => setActiveWeatherTab('forecast')}
                              style={{ padding: '0.5rem 1.15rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', background: 'transparent', color: '#475569', border: '1px solid #CBD5E1', cursor: 'pointer' }}
                            >
                              📅 5-Day Weather Forecast
                            </button>
                            <button
                              className="tab-filter-btn"
                              onClick={() => setActiveWeatherTab('map')}
                              style={{ padding: '0.5rem 1.15rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '700', background: 'transparent', color: '#475569', border: '1px solid #CBD5E1', cursor: 'pointer' }}
                            >
                              🌐 Weather Map
                            </button>
                          </div>

                          {/* CANDIDATE ROUTE WEATHER COMPARISON TABLE */}
                          <div className="table-responsive">
                            <table className="ocean-data-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                              <thead>
                                <tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left' }}>
                                  <th style={{ padding: '0.75rem' }}>#</th>
                                  <th style={{ padding: '0.75rem' }}>Route Name</th>
                                  <th style={{ padding: '0.75rem' }}>Transit Days</th>
                                  <th style={{ padding: '0.75rem' }}>Distance (NM)</th>
                                  <th style={{ padding: '0.75rem' }}>Route Score</th>
                                  <th style={{ padding: '0.75rem' }}>Weather Risk</th>
                                  <th style={{ padding: '0.75rem' }}>Risk Level</th>
                                  <th style={{ padding: '0.75rem' }}>Avg Wind (kts)</th>
                                  <th style={{ padding: '0.75rem' }}>Max Wave (m)</th>
                                  <th style={{ padding: '0.75rem' }}>Visibility (km)</th>
                                  <th style={{ padding: '0.75rem' }}>Alerts</th>
                                  <th style={{ padding: '0.75rem' }}>Delay Impact</th>
                                  <th style={{ padding: '0.75rem' }}>Recommendation</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const routesToDisplay = (weatherComparison?.comparison && weatherComparison.comparison.length > 0)
                                    ? weatherComparison.comparison
                                    : (apiResult?.available_routes || []).map((r, idx) => ({
                                        route_id: r.route_id,
                                        route_name: r.route_name,
                                        ocean_corridor: r.ocean_corridor,
                                        transit_days: r.transit_days,
                                        distance_nautical_miles: r.distance_nautical_miles,
                                        route_score: r.route_score,
                                        weather_risk_score: 30 + (idx * 15),
                                        risk_level: idx === 0 ? 'LOW' : idx === 1 ? 'MODERATE' : 'HIGH',
                                        avg_wind: 15 + (idx * 5),
                                        max_wave: 1.5 + (idx * 0.8),
                                        visibility: 10.0,
                                        alert_count: idx,
                                        transit_impact: idx === 0 ? 'Low Impact' : 'Medium Impact'
                                      }))

                                  const minRiskScore = Math.min(...routesToDisplay.map(r => r.weather_risk_score))

                                  return routesToDisplay.map((item, idx) => {
                                    const isSafest = item.weather_risk_score === minRiskScore || item.route_id === weatherComparison?.best_weather_route?.route_id
                                    const isSelected = activeSelectedRouteId === item.route_id

                                    const riskColor = item.weather_risk_score > 60 ? '#EF4444' : item.weather_risk_score > 40 ? '#F5A623' : '#16A34A'
                                    const riskBg = item.weather_risk_score > 60 ? '#FEF2F2' : item.weather_risk_score > 40 ? '#FEF3C7' : '#DCFCE7'
                                    const riskBorder = item.weather_risk_score > 60 ? '#FCA5A5' : item.weather_risk_score > 40 ? '#FDE68A' : '#86EFAC'
                                    const riskTextColor = item.weather_risk_score > 60 ? '#991B1B' : item.weather_risk_score > 40 ? '#B45309' : '#15803D'

                                    return (
                                      <tr key={item.route_id} style={{ backgroundColor: isSelected ? '#F0F9FF' : isSafest ? '#F0FDF4' : 'transparent', borderBottom: '1px solid #F1F5F9' }}>
                                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 'bold' }}>{idx + 1}</td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>
                                          <strong style={{ color: '#062B49', fontSize: '0.92rem' }}>{item.route_name}</strong>
                                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{item.route_id}</div>
                                        </td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>{item.transit_days} Days</td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>{item.distance_nautical_miles?.toLocaleString() || '6,500'}</td>
                                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: 'bold' }}>{item.route_score} / 100</td>
                                        <td style={{ padding: '0.85rem 0.75rem', fontWeight: '900', color: riskColor }}>{item.weather_risk_score} / 100</td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>
                                          <span style={{ backgroundColor: riskBg, color: riskTextColor, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800', border: `1px solid ${riskBorder}` }}>
                                            {item.risk_level}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>{item.avg_wind}</td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>{item.max_wave}</td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>{item.visibility}</td>
                                        <td style={{ padding: '0.85rem 0.75rem', color: item.alert_count > 0 ? '#EF4444' : '#16A34A', fontWeight: 'bold' }}>{item.alert_count}</td>
                                        <td style={{ padding: '0.85rem 0.75rem' }}>
                                          <span style={{ backgroundColor: riskBg, color: riskTextColor, padding: '0.2rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700' }}>
                                            {item.transit_impact?.split(' ')?.[0] || 'Low'}
                                          </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 0.75rem', color: isSafest ? '#15803D' : '#475569', fontWeight: isSafest ? '800' : 'normal', fontStyle: isSafest ? 'normal' : 'italic' }}>
                                          {isSafest ? '⭐ Safest Weather Route' : item.weather_risk_score > 60 ? 'Use with caution' : 'Consider'}
                                        </td>
                                        <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}>
                                          <button
                                            style={{
                                              backgroundColor: isSelected ? '#0070F3' : isSafest ? '#16A34A' : '#FFFFFF',
                                              border: isSelected || isSafest ? 'none' : '1px solid #0070F3',
                                              color: isSelected || isSafest ? '#FFFFFF' : '#0070F3',
                                              padding: '0.3rem 0.75rem',
                                              borderRadius: '6px',
                                              fontSize: '0.78rem',
                                              fontWeight: '700',
                                              cursor: 'pointer'
                                            }}
                                            onClick={() => {
                                              const routeObj = (apiResult.available_routes || []).find(r => r.route_id === item.route_id) || item
                                              setSelectedMapRoute(routeObj)
                                            }}
                                          >
                                            {isSelected ? '✓ Selected' : 'View Details'}
                                          </button>
                                        </td>
                                      </tr>
                                    )
                                  })
                                })()}
                              </tbody>
                            </table>
                          </div>

                        </div>

                        {/* BOTTOM GRID MATCHING REFERENCE IMAGE MEDIA_1790939844814.JPG (3 SIDE-BY-SIDE CARDS WITH EXPANDED SCROLL CONTAINERS) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                          
                          {/* CARD 1: ROUTE WEATHER MAP */}
                          <div className="ocean-card" style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(6,43,73,0.03)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>🌐</span>
                              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#062B49', fontWeight: '800' }}>Route Weather Map</h3>
                            </div>

                            <div style={{ borderRadius: '12px', overflowY: 'auto', maxHeight: '640px', position: 'relative', border: '1px solid #CBD5E1', padding: '0.5rem', background: '#F8FAFC' }}>
                              <RouteMap
                                isCompact={true}
                                routes={apiResult?.available_routes || []}
                                weatherData={activeRouteWeather}
                                bestRouteId={apiResult?.best_route?.route_id}
                                activeRouteId={activeSelectedRouteId}
                                selectedRouteObj={activeRouteObj}
                                originName={apiResult?.query?.origin || ''}
                                destinationName={apiResult?.query?.destination || ''}
                                onSelectRoute={(r) => setSelectedMapRoute(r)}
                                onResetViewAll={() => setSelectedMapRoute('ALL')}
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#475569', marginTop: '0.75rem', justifyContent: 'center' }}>
                              <span>🟢 Low Risk</span>
                              <span>🟡 Moderate Risk</span>
                              <span>🟠 High Risk</span>
                              <span>🔴 Severe Risk</span>
                            </div>
                          </div>

                          {/* CARD 2: SELECTED ROUTE WEATHER DETAILS */}
                          <div className="ocean-card" style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(6,43,73,0.03)', display: 'flex', flexDirection: 'column' }}>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.65rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>🕒</span>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#062B49', fontWeight: '800' }}>Selected Route Weather Details</h3>
                              </div>

                              <span style={{
                                padding: '0.2rem 0.65rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                backgroundColor: weatherRiskScore > 60 ? '#FEF2F2' : weatherRiskScore > 40 ? '#FEF3C7' : '#DCFCE7',
                                color: weatherRiskScore > 60 ? '#991B1B' : weatherRiskScore > 40 ? '#B45309' : '#15803D',
                                border: `1px solid ${weatherRiskScore > 60 ? '#FCA5A5' : weatherRiskScore > 40 ? '#FDE68A' : '#86EFAC'}`
                              }}>
                                {weatherRiskScore > 60 ? '🔴 HIGH RISK' : weatherRiskScore > 40 ? '🟡 MODERATE RISK' : '🟢 LOW RISK'}
                              </span>
                            </div>

                            {/* DYNAMIC ROUTE SELECTOR DROPDOWN */}
                            <div style={{ marginBottom: '0.85rem' }}>
                              <select
                                className="form-control"
                                value={activeSelectedRouteId}
                                onChange={(e) => {
                                  const found = (apiResult.available_routes || []).find(r => r.route_id === e.target.value)
                                  if (found) {
                                    setSelectedMapRoute(found)
                                  }
                                }}
                                style={{ fontSize: '0.88rem', fontWeight: '700', padding: '0.45rem 0.75rem', color: '#062B49', width: '100%', borderRadius: '8px' }}
                              >
                                {(apiResult.available_routes || []).map(r => (
                                  <option key={r.route_id} value={r.route_id}>
                                    {r.route_name} ({r.route_id})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* SCROLLABLE VERTICAL CHECKPOINT TIMELINE CONTAINER */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.84rem', maxHeight: '440px', overflowY: 'auto', paddingRight: '0.35rem' }}>
                              {activeRouteWeather?.checkpoints?.map((cp) => {
                                const isHigh = cp.risk_score > 60
                                const isMod = cp.risk_score > 40
                                const cpBg = isHigh ? '#FEF2F2' : isMod ? '#FEF3C7' : '#F8FAFC'
                                const cpBorder = isHigh ? '#FCA5A5' : isMod ? '#FDE68A' : '#E2E8F0'
                                const circleBg = isHigh ? '#EF4444' : isMod ? '#F5A623' : '#16A34A'
                                const badgeBg = isHigh ? '#991B1B' : isMod ? '#FEF3C7' : '#DCFCE7'
                                const badgeColor = isHigh ? '#FFFFFF' : isMod ? '#B45309' : '#15803D'

                                return (
                                  <div key={cp.sequence || cp.name} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: cpBg, padding: '0.65rem 0.85rem', borderRadius: '8px', border: `1px solid ${cpBorder}` }}>
                                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: circleBg, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                                      {cp.sequence}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontWeight: '800', color: isHigh ? '#991B1B' : '#062B49' }}>
                                        {cp.name}
                                      </div>
                                      <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: '0.15rem' }}>
                                        Temp: {cp.metrics?.temperature_c || cp.temperature_c || 28}°C • Wind: {cp.metrics?.wind_speed_knots || cp.wind_speed_knots || 15} kts • Waves: {cp.metrics?.wave_height_m || cp.wave_height_m || 1.5} m • Visibility: {cp.metrics?.visibility_km || cp.visibility_km || 10} km
                                      </div>
                                      {cp.alerts && cp.alerts.length > 0 && (
                                        <div style={{ color: '#B91C1C', fontSize: '0.72rem', fontWeight: 'bold', marginTop: '0.15rem' }}>
                                          ⚠️ {cp.alerts[0].type}
                                        </div>
                                      )}
                                    </div>
                                    <span style={{ backgroundColor: badgeBg, color: badgeColor, padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800' }}>
                                      {cp.risk_level}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* CARD 3: 5-DAY WEATHER FORECAST & DYNAMIC RECOMMENDATION CARD */}
                          <div className="ocean-card" style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(6,43,73,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>📅</span>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#062B49', fontWeight: '800' }}>5-Day Weather Forecast</h3>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '0.85rem' }}>
                                {activeRouteObj?.route_name} Corridor
                              </div>

                              {/* 5-DAY FORECAST TABLE */}
                              <div className="table-responsive" style={{ marginBottom: '1.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                                <table className="ocean-data-table" style={{ width: '100%', fontSize: '0.78rem' }}>
                                  <thead>
                                    <tr style={{ background: '#F8FAFC', color: '#475569' }}>
                                      <th style={{ padding: '0.4rem' }}>Day</th>
                                      <th style={{ padding: '0.4rem' }}>Date</th>
                                      <th style={{ padding: '0.4rem' }}>Temp (°C)</th>
                                      <th style={{ padding: '0.4rem' }}>Wind (kts)</th>
                                      <th style={{ padding: '0.4rem' }}>Wave (m)</th>
                                      <th style={{ padding: '0.4rem' }}>Precipitation</th>
                                      <th style={{ padding: '0.4rem' }}>Condition</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {activeRouteWeather?.checkpoints?.[0]?.metrics?.forecast_timeline ? (
                                      activeRouteWeather.checkpoints[0].metrics.forecast_timeline.map((fc, i) => (
                                        <tr key={i}>
                                          <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>Day {i + 1}</td>
                                          <td style={{ padding: '0.4rem' }}>{new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</td>
                                          <td style={{ padding: '0.4rem' }}>{activeRouteWeather.checkpoints[0].metrics?.temperature_c || 28}</td>
                                          <td style={{ padding: '0.4rem' }}>{fc.wind_speed_knots}</td>
                                          <td style={{ padding: '0.4rem' }}>{fc.wave_height_m}</td>
                                          <td style={{ padding: '0.4rem' }}>{Math.round(fc.risk_score * 0.8)}%</td>
                                          <td style={{ padding: '0.4rem' }}>{fc.risk_score > 60 ? '⛈️' : fc.risk_score > 40 ? '🌧️' : '🌤️'}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      [1, 2, 3, 4, 5].map((d, idx) => (
                                        <tr key={d}>
                                          <td style={{ padding: '0.4rem', fontWeight: 'bold' }}>Day {d}</td>
                                          <td style={{ padding: '0.4rem' }}>{new Date(Date.now() + idx * 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</td>
                                          <td style={{ padding: '0.4rem' }}>28</td>
                                          <td style={{ padding: '0.4rem' }}>{15 + idx * 2}</td>
                                          <td style={{ padding: '0.4rem' }}>{(1.5 + idx * 0.2).toFixed(1)}</td>
                                          <td style={{ padding: '0.4rem' }}>{10 + idx * 5}%</td>
                                          <td style={{ padding: '0.4rem' }}>🌤️</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* WEATHER AGENT RECOMMENDATION BOX */}
                            {(() => {
                              const safestRoute = weatherComparison?.best_weather_route || (apiResult?.available_routes || []).find(r => r.route_id === weatherComparison?.best_weather_route?.route_id) || apiResult?.best_route
                              return (
                                <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', padding: '1rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#166534' }}>💡 Weather Agent Recommendation</span>
                                    <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', padding: '0.15rem 0.55rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800' }}>
                                      🟢 SAFEST WEATHER ROUTE
                                    </span>
                                  </div>
                                  
                                  <div style={{ fontSize: '1rem', fontWeight: '900', color: '#062B49', margin: '0.2rem 0' }}>
                                    {safestRoute?.route_name} ({safestRoute?.route_id})
                                  </div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#15803D', marginBottom: '0.4rem' }}>
                                    Weather Risk: {safestRoute?.weather_risk_score ?? 24} / 100 — {safestRoute?.risk_level || 'VERY LOW'}
                                  </div>

                                  <p style={{ fontSize: '0.78rem', color: '#334155', margin: '0 0 0.85rem 0', lineHeight: '1.35' }}>
                                    Although this route has a lower Route Efficiency Score, it provides significantly safer weather conditions and is expected to cause minimal transit disruption.
                                  </p>

                                  <button
                                    style={{ width: '100%', backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(22,163,74,0.2)' }}
                                    onClick={() => {
                                      if (safestRoute) {
                                        setSelectedMapRoute(safestRoute)
                                        setApiResult(prev => ({ ...prev, best_route: safestRoute }))
                                      }
                                      setActiveTab('pricing')
                                    }}
                                  >
                                    Select This Route →
                                  </button>
                                </div>
                              )
                            })()}

                          </div>

                        </div>

                      </div>
                    )
                  })()}

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

                  {/* =================================================================
                     WEATHER INTELLIGENCE & SAFETY PANEL (WEATHER AGENT)
                     ================================================================= */}
                  {weatherLoading && (
                    <div className="ocean-card" style={{ marginTop: '1.75rem', textAlign: 'center', padding: '2.5rem', background: '#FFFFFF', borderRadius: '16px', border: '1.5px solid #BAE6FD', boxShadow: '0 4px 20px rgba(6,43,73,0.06)' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 1rem' }}>
                        🌊
                      </div>
                      <h3 style={{ fontSize: '1.25rem', color: '#062B49', fontWeight: '800', marginBottom: '0.4rem' }}>
                        AI Weather Agent Analyzing Ocean Risk...
                      </h3>
                      <p style={{ color: '#475569', fontSize: '0.95rem', margin: 0 }}>
                        Retrieving live atmospheric & marine wave data for route checkpoints along {apiResult.query.origin} ➔ {apiResult.query.destination}...
                      </p>
                    </div>
                  )}

                  {weatherResult && (
                    <div className="ocean-card weather-intelligence-card" style={{ marginTop: '1.75rem', background: '#FFFFFF', borderRadius: '16px', padding: '2rem', boxShadow: '0 6px 24px rgba(6, 43, 73, 0.06)', border: '1.5px solid #BAE6FD' }}>
                      
                      {/* HEADER BAR */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>🌊</span>
                            <h3 className="card-title" style={{ margin: 0, fontSize: '1.35rem', color: '#062B49' }}>Weather Intelligence & Safety Analysis</h3>
                            <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '0.25rem 0.65rem', borderRadius: '15px', fontSize: '0.78rem', fontWeight: '800' }}>
                              ● Weather Agent Live
                            </span>
                          </div>
                          <p className="card-subtitle" style={{ margin: '0.25rem 0 0 0', color: '#475569' }}>
                            Multi-checkpoint marine weather risk score, wave conditions, severe weather warnings & broker safety intelligence.
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Overall Weather Risk</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: '900', color: weatherResult.weather_risk_score > 60 ? '#EF4444' : weatherResult.weather_risk_score > 40 ? '#F5A623' : '#18A66A' }}>
                              {weatherResult.weather_risk_score}/100 ({weatherResult.risk_level})
                            </div>
                          </div>
                          <span style={{
                            padding: '0.45rem 1rem',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            backgroundColor: weatherResult.weather_risk_score > 60 ? '#FEF2F2' : weatherResult.weather_risk_score > 40 ? '#FEF3C7' : '#DCFCE7',
                            color: weatherResult.weather_risk_score > 60 ? '#991B1B' : weatherResult.weather_risk_score > 40 ? '#B45309' : '#15803D',
                            border: `1.5px solid ${weatherResult.weather_risk_score > 60 ? '#FCA5A5' : weatherResult.weather_risk_score > 40 ? '#FDE68A' : '#86EFAC'}`
                          }}>
                            {weatherResult.weather_risk_score > 60 ? '🔴' : weatherResult.weather_risk_score > 40 ? '🟡' : '🟢'} {weatherResult.risk_level}
                          </span>
                        </div>
                      </div>

                      {/* SEVERE WEATHER ALERTS WARNING BANNER */}
                      {weatherResult.alerts && weatherResult.alerts.length > 0 && (
                        <div style={{ marginBottom: '1.5rem', backgroundColor: '#FEF2F2', border: '1.5px solid #FCA5A5', padding: '1.15rem 1.35rem', borderRadius: '12px', color: '#991B1B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                            <strong style={{ fontSize: '1.05rem', color: '#991B1B' }}>SEVERE WEATHER ALERT DETECTED ALONG CORRIDOR</strong>
                          </div>
                          {weatherResult.alerts.map((al, idx) => (
                            <div key={idx} style={{ marginTop: '0.4rem', fontSize: '0.9rem', paddingLeft: '2rem' }}>
                              • <strong>{al.type}</strong> near <em>{al.location}</em>: {al.message}
                              <div style={{ fontSize: '0.82rem', color: '#B91C1C', marginTop: '0.15rem', fontStyle: 'italic' }}>
                                Recommended Action: {al.recommended_action}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* SUMMARY METRICS GRID */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Weather Trend</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>{weatherResult.weather_trend}</div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Transit Delay Impact</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#0F8B8D', marginTop: '0.2rem' }}>{weatherResult.transit_impact}</div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Analyzed Checkpoints</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>{weatherResult.checkpoints?.length || 0} Sea Checkpoints</div>
                        </div>
                      </div>

                      {/* SUB-TABS SELECTOR */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
                        <button
                          className={`tab-filter-btn ${activeWeatherTab === 'checkpoints' ? 'active' : ''}`}
                          onClick={() => setActiveWeatherTab('checkpoints')}
                          style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📍 Route Checkpoints ({weatherResult.checkpoints?.length || 0})
                        </button>
                        <button
                          className={`tab-filter-btn ${activeWeatherTab === 'comparison' ? 'active' : ''}`}
                          onClick={() => setActiveWeatherTab('comparison')}
                          style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          📊 Candidate Route Weather Comparison
                        </button>
                        <button
                          className={`tab-filter-btn ${activeWeatherTab === 'forecast' ? 'active' : ''}`}
                          onClick={() => setActiveWeatherTab('forecast')}
                          style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          ⏱️ 5-Day Weather Forecast
                        </button>
                      </div>

                      {/* TAB 1: CHECKPOINTS BREAKDOWN */}
                      {activeWeatherTab === 'checkpoints' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                          {weatherResult.checkpoints?.map((cp) => (
                            <div key={cp.sequence} style={{ background: '#F8FAFC', borderRadius: '12px', padding: '1.25rem', border: '1px solid #CBD5E1' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
                                <div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0F8B8D' }}>SEQ {cp.sequence} • {cp.type.toUpperCase()}</span>
                                  <h4 style={{ margin: '0.1rem 0 0 0', fontSize: '1rem', color: '#062B49' }}>{cp.name}</h4>
                                </div>
                                <span style={{
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '12px',
                                  fontSize: '0.78rem',
                                  fontWeight: '800',
                                  backgroundColor: cp.risk_score > 60 ? '#FEF2F2' : cp.risk_score > 40 ? '#FEF3C7' : '#DCFCE7',
                                  color: cp.risk_score > 60 ? '#991B1B' : cp.risk_score > 40 ? '#B45309' : '#15803D'
                                }}>
                                  Score: {cp.risk_score}/100
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.85rem', color: '#334155' }}>
                                <div>🌡️ Temp: <strong>{cp.metrics.temperature_c}°C</strong></div>
                                <div>💨 Wind: <strong>{cp.metrics.wind_speed_knots} kts</strong></div>
                                <div>🌬️ Gusts: <strong>{cp.metrics.wind_gusts_knots} kts</strong></div>
                                <div>🌊 Wave Ht: <strong>{cp.metrics.wave_height_m} m</strong></div>
                                <div>👁️ Visibility: <strong>{cp.metrics.visibility_km} km</strong></div>
                                <div>🌧️ Rain: <strong>{cp.metrics.precipitation_mm} mm/h</strong></div>
                              </div>

                              <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #CBD5E1', fontSize: '0.8rem', color: '#475569' }}>
                                <strong>Sea State:</strong> {cp.metrics.sea_state}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* TAB 2: MULTI-ROUTE WEATHER COMPARISON */}
                      {activeWeatherTab === 'comparison' && (
                        <div>
                          {weatherComparison?.recommendation && (
                            <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', padding: '1rem 1.25rem', borderRadius: '10px', color: '#0369A1', marginBottom: '1.25rem', fontWeight: '600', fontSize: '0.92rem' }}>
                              🛡️ <strong>Weather Safety Recommendation:</strong> {weatherComparison.recommendation}
                            </div>
                          )}

                          <div className="table-responsive">
                            <table className="ocean-data-table">
                              <thead>
                                <tr>
                                  <th>Route Name</th>
                                  <th>Ocean Corridor</th>
                                  <th>Transit Days</th>
                                  <th>Weather Score</th>
                                  <th>Risk Level</th>
                                  <th>Alerts</th>
                                  <th>Transit Impact</th>
                                </tr>
                              </thead>
                              <tbody>
                                {weatherComparison?.comparison?.map((rEv) => (
                                  <tr key={rEv.route_id}>
                                    <td style={{ fontWeight: 'bold', color: '#062B49' }}>{rEv.route_name}</td>
                                    <td style={{ fontSize: '0.85rem', color: '#475569' }}>{rEv.ocean_corridor}</td>
                                    <td>{rEv.transit_days} Days</td>
                                    <td><strong style={{ color: '#0F8B8D' }}>{rEv.weather_risk_score}/100</strong></td>
                                    <td>
                                      <span style={{
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '12px',
                                        fontSize: '0.78rem',
                                        fontWeight: '800',
                                        backgroundColor: rEv.weather_risk_score > 60 ? '#FEF2F2' : rEv.weather_risk_score > 40 ? '#FEF3C7' : '#DCFCE7',
                                        color: rEv.weather_risk_score > 60 ? '#991B1B' : rEv.weather_risk_score > 40 ? '#B45309' : '#15803D'
                                      }}>
                                        {rEv.risk_level}
                                      </span>
                                    </td>
                                    <td>{rEv.alert_count > 0 ? <span style={{ color: '#EF4444', fontWeight: 'bold' }}>⚠️ {rEv.alert_count} Alert</span> : <span style={{ color: '#18A66A' }}>✓ Clear</span>}</td>
                                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{rEv.transit_impact.split(' (')[0]}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: 5-DAY WEATHER FORECAST */}
                      {activeWeatherTab === 'forecast' && (
                        <div>
                          <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Forecast trend window for primary sea transit sector (Next 5 Days):
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                            {weatherResult.checkpoints?.[0]?.metrics?.forecast_timeline?.map((fc, idx) => (
                              <div key={idx} style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #CBD5E1', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0F8B8D' }}>{fc.period}</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#062B49', margin: '0.3rem 0' }}>{fc.risk_score}/100</div>
                                <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B' }}>{fc.risk_level}</div>
                                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.5rem' }}>
                                  Wind: <strong>{fc.wind_speed_knots} kts</strong><br/>
                                  Waves: <strong>{fc.wave_height_m} m</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

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
             PAGE: TRACK SHIPMENT (CUSTOMER & BROKER TRACKING TIMELINE)
             ================================================================= */}
          {activeTab === 'track-shipment' && (() => {
            const userConfirmedShipments = customerRequests.filter(r => {
              const matchesUser = isBroker || (user?.id && r.customer_id === user.id) || (r.customer_email?.toLowerCase().trim() === userEmail)
              const isConfirmedOrActive = SHIPMENT_STAGES.includes(r.status) || ['Accepted', 'Quotation Sent', 'Quotation Ready', 'In Transit'].includes(r.status)
              return matchesUser && isConfirmedOrActive
            })

            const activeTrackingItem = userConfirmedShipments.find(r => r.id === selectedTrackRequestId) || userConfirmedShipments[0] || null
            const currentStageIdx = activeTrackingItem ? getStageIndex(activeTrackingItem.status) : 0

            return (
              <div className="dashboard-page-view" style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div className="page-header-banner" style={{ marginBottom: '1.5rem' }}>
                  <h2 className="page-title">Shipment Status Tracking</h2>
                  <p className="page-subtitle">Real-time status tracking timeline and trajectory map for confirmed ocean freight shipments</p>
                </div>

                {reportToast && (
                  <div className="alert-banner alert-info" style={{ marginBottom: '1.25rem', backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #18A66A', padding: '0.85rem 1.25rem', borderRadius: '10px', fontWeight: '600' }}>
                    {reportToast}
                  </div>
                )}

                {userConfirmedShipments.length > 1 && (
                  <div className="ocean-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <label style={{ fontWeight: '700', color: '#062B49', fontSize: '0.95rem' }}>
                      Select Active Shipment:
                    </label>
                    <select
                      value={activeTrackingItem?.id || ''}
                      onChange={(e) => setSelectedTrackRequestId(e.target.value)}
                      style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1.5px solid #0F8B8D', fontSize: '0.95rem', fontWeight: '700', color: '#062B49', backgroundColor: '#FFFFFF', cursor: 'pointer', minWidth: '280px' }}
                    >
                      {userConfirmedShipments.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.id} — {s.origin} ➔ {s.destination} ({s.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!activeTrackingItem ? (
                  <div className="ocean-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(6,43,73,0.06)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#F0F9FF', border: '2px solid #BAE6FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 1.25rem' }}>
                      📍
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#062B49', marginBottom: '0.5rem' }}>
                      No Active Shipments Under Tracking
                    </h2>
                    <p style={{ color: '#475569', fontSize: '0.98rem', maxWidth: '540px', margin: '0 auto 1.75rem', lineHeight: '1.6' }}>
                      You don't have any confirmed active shipments yet. When you accept a broker quotation under "My Requests", your shipment status timeline will appear here automatically.
                    </p>
                    <button
                      className="btn-explore-orange"
                      onClick={() => setActiveTab('customer-requests')}
                      style={{ padding: '0.75rem 1.75rem', borderRadius: '10px', fontWeight: '700', border: 'none', background: '#0F8B8D', color: '#FFF', cursor: 'pointer' }}
                    >
                      View My Requests & Quotations →
                    </button>
                  </div>
                ) : (
                  <>
                    {/* SHIPMENT METADATA CARD */}
                    <div className="ocean-card" style={{ marginBottom: '1.75rem', background: '#FFFFFF', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 6px 24px rgba(6, 43, 73, 0.06)', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0F8B8D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONFIRMED FREIGHT SHIPMENT</div>
                          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#062B49', margin: '0.2rem 0' }}>
                            Shipment #{activeTrackingItem.id}
                          </h2>
                          <div style={{ fontSize: '0.9rem', color: '#64748B' }}>
                            Customer: <strong>{activeTrackingItem.customer_name || userEmail}</strong> • Last Updated: <strong>{activeTrackingItem.last_updated || activeTrackingItem.request_date || 'Just now'}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{
                            padding: '0.5rem 1.15rem',
                            borderRadius: '30px',
                            fontSize: '0.92rem',
                            fontWeight: '800',
                            backgroundColor: activeTrackingItem.status === 'Delivered' ? '#DCFCE7' : '#E0F2FE',
                            color: activeTrackingItem.status === 'Delivered' ? '#15803D' : '#0369A1',
                            border: `1.5px solid ${activeTrackingItem.status === 'Delivered' ? '#86EFAC' : '#7DD3FC'}`
                          }}>
                            ● {activeTrackingItem.status}
                          </span>

                          {isBroker && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F8FAFC', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                              <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#062B49' }}>Broker Status:</label>
                              <select
                                value={SHIPMENT_STAGES.includes(activeTrackingItem.status) ? activeTrackingItem.status : 'Shipment Confirmed'}
                                onChange={(e) => handleBrokerUpdateShipmentStatus(activeTrackingItem.id, e.target.value)}
                                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1.5px solid #0F8B8D', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                              >
                                {SHIPMENT_STAGES.map((stg, i) => (
                                  <option key={stg} value={stg}>{i + 1}. {stg}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Origin Port</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>📍 {activeTrackingItem.origin}</div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Destination Port</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>🏁 {activeTrackingItem.destination}</div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Cargo & Equipment</div>
                          <div style={{ fontSize: '1rem', fontWeight: '800', color: '#062B49', marginTop: '0.2rem' }}>📦 {activeTrackingItem.cargo_type} ({activeTrackingItem.containers} × {activeTrackingItem.container_type || '40ft'})</div>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Current Progress</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0F8B8D', marginTop: '0.2rem' }}>Stage {currentStageIdx + 1} of {SHIPMENT_STAGES.length}</div>
                        </div>
                      </div>
                    </div>

                    {/* 6-STAGE VISUAL TIMELINE STEPPER CARD */}
                    <div className="ocean-card" style={{ marginBottom: '1.75rem', background: '#FFFFFF', borderRadius: '16px', padding: '2rem', boxShadow: '0 6px 24px rgba(6, 43, 73, 0.06)', border: '1px solid #E2E8F0' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#062B49', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📍</span> Shipment Status Timeline Progress
                      </h3>

                      {/* HORIZONTAL STEPPER GRAPHIC */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', position: 'relative', margin: '1rem 0 2rem' }}>
                        {SHIPMENT_STAGES.map((stageName, idx) => {
                          const isPast = idx < currentStageIdx
                          const isCurrent = idx === currentStageIdx
                          const isFuture = idx > currentStageIdx

                          return (
                            <div key={stageName} style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                              
                              {/* STAGE ICON CIRCLE */}
                              <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                fontWeight: '900',
                                color: isPast || isCurrent ? '#FFFFFF' : '#94A3B8',
                                backgroundColor: isPast ? '#18A66A' : isCurrent ? '#0F8B8D' : '#F1F5F9',
                                border: isCurrent ? '4px solid #062B49' : isPast ? '2px solid #18A66A' : '2px solid #CBD5E1',
                                boxShadow: isCurrent ? '0 0 16px rgba(15, 139, 141, 0.6)' : 'none',
                                marginBottom: '0.75rem',
                                transition: 'all 0.3s ease'
                              }}>
                                {isPast ? '✓' : isCurrent ? '●' : '○'}
                              </div>

                              {/* STAGE TITLE */}
                              <div style={{
                                fontSize: '0.85rem',
                                fontWeight: isCurrent ? '800' : isPast ? '700' : '600',
                                color: isCurrent ? '#0F8B8D' : isPast ? '#062B49' : '#64748B',
                                marginBottom: '0.25rem',
                                lineHeight: '1.2'
                              }}>
                                {stageName}
                              </div>

                              {/* STAGE STATUS TAG */}
                              <div style={{
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: isPast ? '#18A66A' : isCurrent ? '#0F8B8D' : '#94A3B8'
                              }}>
                                {isPast ? 'Completed' : isCurrent ? 'Active Now' : 'Upcoming'}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* DETAILED TIMELINE LIST */}
                      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#062B49', marginBottom: '1rem' }}>
                          Timeline Log Details
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {SHIPMENT_STAGES.map((stageName, idx) => {
                            const isPast = idx < currentStageIdx
                            const isCurrent = idx === currentStageIdx

                            return (
                              <div
                                key={stageName}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justify: 'space-between',
                                  padding: '0.85rem 1.25rem',
                                  borderRadius: '10px',
                                  backgroundColor: isCurrent ? '#F0F9FF' : isPast ? '#F8FAFC' : '#FFFFFF',
                                  border: isCurrent ? '1.5px solid #0F8B8D' : '1px solid #E2E8F0',
                                  opacity: idx > currentStageIdx ? 0.6 : 1
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                  <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    backgroundColor: isPast ? '#18A66A' : isCurrent ? '#0F8B8D' : '#E2E8F0',
                                    color: isPast || isCurrent ? '#FFF' : '#94A3B8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justify: 'center',
                                    fontSize: '0.85rem',
                                    fontWeight: '800'
                                  }}>
                                    {isPast ? '✓' : isCurrent ? '●' : idx + 1}
                                  </div>
                                  <div>
                                    <strong style={{ fontSize: '0.95rem', color: '#062B49' }}>
                                      Step {idx + 1}: {stageName}
                                    </strong>
                                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                                      {isPast ? 'Status step completed' : isCurrent ? `Current active stage — Updated ${activeTrackingItem.last_updated || 'recently'}` : 'Pending update by broker'}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <span style={{
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '15px',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    backgroundColor: isPast ? '#DCFCE7' : isCurrent ? '#0F8B8D' : '#F1F5F9',
                                    color: isPast ? '#15803D' : isCurrent ? '#FFFFFF' : '#64748B'
                                  }}>
                                    {isPast ? '✓ Completed' : isCurrent ? '● In Progress' : '○ Scheduled'}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* ROUTE MAP VISUALIZATION CARD */}
                    <div className="ocean-card" style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 6px 24px rgba(6, 43, 73, 0.06)', border: '1px solid #E2E8F0' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#062B49', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🧭</span> Interactive Maritime Route Map
                      </h3>
                      <div style={{ height: '380px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                        <RouteMap
                          routes={activeTrackingItem.route_result?.available_routes || [{
                            route_id: 'R-TRACK-01',
                            route_name: activeTrackingItem.quotation_result?.route_name || `${activeTrackingItem.origin} to ${activeTrackingItem.destination} Ocean Express`,
                            transit_days: activeTrackingItem.quotation_result?.transit_days || 20,
                            distance_nautical_miles: 6500,
                            transshipments: 0,
                            route_score: 95
                          }]}
                          bestRouteId={activeTrackingItem.route_result?.best_route?.route_id || 'R-TRACK-01'}
                          activeRouteId={activeTrackingItem.route_result?.best_route?.route_id || 'R-TRACK-01'}
                          originName={activeTrackingItem.origin}
                          destinationName={activeTrackingItem.destination}
                          isCompact={true}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })()}

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

          {/* =================================================================
             PAGE 9: PROFILE PAGE (activeTab === 'profile')
             ================================================================= */}
          {activeTab === 'profile' && (
            <div className="profile-page-view" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '2rem' }}>
              <div className="page-header-banner" style={{ marginBottom: '1.5rem' }}>
                <h2 className="page-title">{isCustomer ? 'Customer Profile' : 'Broker Profile'}</h2>
                <p className="page-subtitle">Manage your account details, contact information, and security settings</p>
              </div>

              {profileToast.message && (
                <div style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: '10px',
                  marginBottom: '1.25rem',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  backgroundColor: profileToast.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                  color: profileToast.type === 'error' ? '#991B1B' : '#166534',
                  border: `1px solid ${profileToast.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span>{profileToast.type === 'error' ? '⚠️' : '✅'}</span>
                  <span>{profileToast.message}</span>
                </div>
              )}

              {/* Main Profile Card */}
              <div className="ocean-card" style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 10px 30px rgba(6, 43, 73, 0.08)',
                border: '1px solid #E2E8F0'
              }}>
                {/* Header Banner inside Card */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  paddingBottom: '1.75rem',
                  marginBottom: '1.75rem',
                  borderBottom: '1px solid #E2E8F0',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: '#062B49',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.2rem',
                    boxShadow: '0 4px 14px rgba(6, 43, 73, 0.2)'
                  }}>
                    {isCustomer ? '🚢' : '💼'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.5rem', color: '#062B49', margin: '0 0 0.35rem 0', fontWeight: '700' }}>
                      {userProfile.fullName}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{
                        backgroundColor: isCustomer ? '#E0F2FE' : '#F0FDF4',
                        color: isCustomer ? '#0369A1' : '#15803D',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                      }}>
                        {isCustomer ? 'Customer' : 'Broker Administrator'}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: '600' }}>
                        {isCustomer ? 'Customer ID:' : 'Broker ID:'} <strong style={{ color: '#062B49' }}>{userProfile.id}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Profile Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  {/* Field 1: Name */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span>Full Name</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#062B49' }}>
                      {userProfile.fullName}
                    </div>
                  </div>

                  {/* Field 2: Company Name */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 3h6v4H9z"/></svg>
                      <span>Company Name</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#062B49' }}>
                      {userProfile.companyName}
                    </div>
                  </div>

                  {/* Field 3: ID */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/></svg>
                      <span>{isCustomer ? 'Customer ID' : 'Broker ID'}</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#062B49' }}>
                      {userProfile.id}
                    </div>
                  </div>

                  {/* Field 4: Email */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      <span>Email Address</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#062B49' }}>
                      {userProfile.email}
                    </div>
                  </div>

                  {/* Field 5: Phone Number */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      <span>Phone Number</span>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#062B49' }}>
                      {userProfile.phone}
                    </div>
                  </div>

                  {/* Field 6: Address (Span full width) */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    gridColumn: '1 / -1'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F8B8D" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>Office / Headquarters Address</span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '600', color: '#062B49' }}>
                      {userProfile.address}
                    </div>
                  </div>
                </div>

                {/* Profile Actions */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid #E2E8F0'
                }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setEditFormData({
                        fullName: userProfile.fullName,
                        companyName: userProfile.companyName,
                        phone: userProfile.phone,
                        address: userProfile.address
                      })
                      setIsEditingProfile(true)
                    }}
                    style={{
                      backgroundColor: '#0F8B8D',
                      color: '#FFFFFF',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '10px',
                      border: 'none',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.95rem',
                      boxShadow: '0 4px 12px rgba(15, 139, 141, 0.25)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit Profile
                  </button>

                  <button
                    className="btn-secondary-outline"
                    onClick={() => {
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                      setIsChangingPassword(true)
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#062B49',
                      border: '1.5px solid #062B49',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '10px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.95rem'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change Password
                  </button>

                  <button
                    onClick={onLogout}
                    style={{
                      marginLeft: 'auto',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '10px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.95rem'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Logout
                  </button>
                </div>
              </div>

              {/* EDIT PROFILE MODAL */}
              {isEditingProfile && (
                <div className="modal-backdrop-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, position: 'fixed', inset: 0, backgroundColor: 'rgba(6, 43, 73, 0.6)', backdropFilter: 'blur(4px)' }}>
                  <div className="modal-card-container" style={{ width: '90%', maxWidth: '540px', background: '#ffffff', borderRadius: '16px', padding: '2rem', boxShadow: '0 20px 50px rgba(6, 43, 73, 0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                      <h3 style={{ color: '#062B49', margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>Edit Profile Information</h3>
                      <button onClick={() => setIsEditingProfile(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748B' }}>×</button>
                    </div>

                    <form onSubmit={handleSaveProfile}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editFormData.fullName}
                          onChange={e => setEditFormData({ ...editFormData, fullName: e.target.value })}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                          required
                        />
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={editFormData.companyName}
                          onChange={e => setEditFormData({ ...editFormData, companyName: e.target.value })}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                          required
                        />
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={editFormData.phone}
                          onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                        />
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          Address
                        </label>
                        <textarea
                          value={editFormData.address}
                          onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                          rows="3"
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem', fontFamily: 'inherit' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #94A3B8', background: 'transparent', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#0F8B8D', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* CHANGE PASSWORD MODAL */}
              {isChangingPassword && (
                <div className="modal-backdrop-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, position: 'fixed', inset: 0, backgroundColor: 'rgba(6, 43, 73, 0.6)', backdropFilter: 'blur(4px)' }}>
                  <div className="modal-card-container" style={{ width: '90%', maxWidth: '500px', background: '#ffffff', borderRadius: '16px', padding: '2rem', boxShadow: '0 20px 50px rgba(6, 43, 73, 0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                      <h3 style={{ color: '#062B49', margin: 0, fontSize: '1.3rem', fontWeight: '700' }}>Change Security Password</h3>
                      <button onClick={() => setIsChangingPassword(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748B' }}>×</button>
                    </div>

                    <form onSubmit={handleChangePasswordSubmit}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          Current Password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={passwordData.currentPassword}
                          onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                          required
                        />
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          New Password
                        </label>
                        <input
                          type="password"
                          placeholder="Min 6 characters"
                          value={passwordData.newPassword}
                          onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                          required
                        />
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#062B49', marginBottom: '0.4rem' }}>
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          placeholder="Re-enter new password"
                          value={passwordData.confirmPassword}
                          onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setIsChangingPassword(false)}
                          style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #94A3B8', background: 'transparent', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#062B49', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Update Password
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
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

      {/* CUSTOMER VIEW DETAILS MODAL */}
      {customerViewModalItem && (
        <div className="modal-backdrop-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, position: 'fixed', inset: 0, backgroundColor: 'rgba(6, 43, 73, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-card-container" style={{ width: '90%', maxWidth: '900px', maxHeight: '88vh', overflowY: 'auto', background: '#ffffff', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(6, 43, 73, 0.25)' }}>
            <div className="modal-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <h2 style={{ color: '#062B49', margin: 0, fontSize: '1.4rem' }}>Official Freight Quotation</h2>
                <span style={{ fontSize: '0.85rem', color: '#64748B' }}>Request ID: <strong>{customerViewModalItem.id}</strong> • Issued for {customerViewModalItem.customer_name}</span>
              </div>
              <button className="btn-close-modal" onClick={() => setCustomerViewModalItem(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748B' }}>×</button>
            </div>

            <div style={{ padding: '1.25rem 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem', backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Corridor</span>
                  <strong style={{ color: '#062B49', fontSize: '1.05rem' }}>{customerViewModalItem.origin} → {customerViewModalItem.destination}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Cargo & Load</span>
                  <strong style={{ color: '#062B49', fontSize: '1.05rem' }}>{customerViewModalItem.cargo_type} ({customerViewModalItem.containers} x {customerViewModalItem.container_type || '40ft'})</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Final Customer Price</span>
                  <strong style={{ color: '#18A66A', fontSize: '1.3rem' }}>
                    {customerViewModalItem.quotation_result?.financials?.customer_price
                      ? `$${Number(customerViewModalItem.quotation_result.financials.customer_price).toLocaleString()} ${customerViewModalItem.quotation_result.financials.currency || 'USD'}`
                      : customerViewModalItem.quotation_result?.pricing_summary?.total_freight_cost
                      ? `$${Number(customerViewModalItem.quotation_result.pricing_summary.total_freight_cost).toLocaleString()} USD`
                      : 'Quote Finalized'}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>Estimated Transit</span>
                  <strong style={{ color: '#062B49', fontSize: '1.05rem' }}>
                    {customerViewModalItem.route_result?.best_route?.transit_days
                      ? `${customerViewModalItem.route_result.best_route.transit_days} Days`
                      : 'Optimal Corridor'}
                  </strong>
                </div>
              </div>

              {/* Interactive Route Map */}
              {customerViewModalItem.route_result && customerViewModalItem.route_result.best_route && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ color: '#062B49', marginBottom: '0.5rem', fontSize: '1rem' }}>Assigned Shipping Trajectory</h4>
                  <div style={{ height: '320px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                    <RouteMap
                      routes={customerViewModalItem.route_result?.available_routes || [customerViewModalItem.route_result?.best_route]}
                      bestRouteId={customerViewModalItem.route_result?.best_route?.route_id}
                      activeRouteId={customerViewModalItem.route_result?.best_route?.route_id}
                      originName={customerViewModalItem.origin}
                      destinationName={customerViewModalItem.destination}
                      isCompact={true}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                {isCustomer && !['Delivered'].includes(customerViewModalItem.status) && (
                  <button
                    className="btn-primary"
                    style={{ backgroundColor: '#18A66A', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => handleCustomerAcceptQuotation(customerViewModalItem)}
                  >
                    ✓ Accept Quotation & Confirm Shipment
                  </button>
                )}
                <button
                  className="btn-secondary-outline"
                  onClick={() => setCustomerViewModalItem(null)}
                  style={{ background: 'transparent', border: '1px solid #94A3B8', color: '#475569', borderRadius: '8px', padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  Close
                </button>
                <button
                  className="btn-primary"
                  style={{ backgroundColor: '#0F8B8D', color: '#fff', padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                  onClick={() => handleDownloadCompleteShipmentReport({
                    id: customerViewModalItem.id,
                    origin: customerViewModalItem.origin,
                    destination: customerViewModalItem.destination,
                    cargo_type: customerViewModalItem.cargo_type,
                    containers: customerViewModalItem.containers,
                    full_result: {
                      best_route: customerViewModalItem.route_result?.best_route,
                      pricing_result: customerViewModalItem.pricing_result,
                      quotation_result: customerViewModalItem.quotation_result
                    }
                  })}
                >
                  📄 Download Quotation PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
