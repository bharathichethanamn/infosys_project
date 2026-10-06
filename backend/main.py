import logging
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.models import (
    RouteRequest,
    PricingRequest,
    QuotationRequest,
    CustomerShipmentRequestModel,
    UpdateRequestStatusModel,
    WeatherRequest,
    WeatherRouteCompareRequest
)
from app.agents.route_agent import RouteAgent
from app.agents.pricing_agent import PricingAgent
from app.agents.margin_agent import MarginAgent
from app.agents.quotation_agent import QuotationAgent
from app.agents.weather_agent import WeatherAgent

# Configure internal logging for technical error tracking
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("maritime_brokerage")

# Initialize FastAPI Application with metadata
app = FastAPI(
    title="Agentic Maritime Brokerage Platform",
    description="AI-powered maritime freight pricing and route optimization platform",
    version="1.3.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from Vite React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate AI Agents
route_agent = RouteAgent()
pricing_agent = PricingAgent()
margin_agent = MarginAgent()
quotation_agent = QuotationAgent(margin_agent=margin_agent)
weather_agent = WeatherAgent()

# Shared In-Memory Storage for Customer Shipment Requests
# Shared In-Memory Storage for Customer Shipment Requests
customer_requests_db = [
    {
        "id": "REQ-0012",
        "customer_id": "CUST-DEMO-001",
        "customer_name": "Global Logistics Corp",
        "customer_email": "customer@maritime.com",
        "origin": "Chennai",
        "destination": "Rotterdam",
        "cargo_type": "Machinery",
        "container_type": "40ft",
        "containers": 10,
        "details": "Temperature-controlled high priority machinery cargo.",
        "notes": "Express delivery requested via Suez Direct.",
        "request_date": "Sep 20, 2026",
        "status": "Quotation Ready",
        "rejection_reason": None,
        "route_result": {
            "query": {"origin": "Chennai", "destination": "Rotterdam", "cargo_type": "Machinery", "containers": 10},
            "best_route": {
                "route_id": "R-CHE-ROT-01",
                "route_name": "Express Suez Direct",
                "ocean_corridor": "Indian Ocean → Red Sea → Suez Canal → Mediterranean Sea → North Sea",
                "transit_days": 21,
                "distance_nautical_miles": 6500,
                "transshipments": 0,
                "route_score": 94,
                "primary_chokepoints": "Suez Canal, Bab-el-Mandeb",
                "reliability_rating": 96,
                "selection_reason": "Optimal direct route with minimal transit time and highest sea reliability."
            },
            "available_routes": [
                {
                    "route_id": "R-CHE-ROT-01",
                    "route_name": "Express Suez Direct",
                    "ocean_corridor": "Indian Ocean → Red Sea → Suez Canal → Mediterranean Sea → North Sea",
                    "transit_days": 21,
                    "distance_nautical_miles": 6500,
                    "transshipments": 0,
                    "route_score": 94
                },
                {
                    "route_id": "R-CHE-ROT-02",
                    "route_name": "Cape Route Alternative",
                    "ocean_corridor": "Indian Ocean → Cape of Good Hope → Atlantic Ocean → English Channel",
                    "transit_days": 32,
                    "distance_nautical_miles": 10800,
                    "transshipments": 1,
                    "route_score": 78
                }
            ]
        },
        "pricing_result": {
            "route_id": "R-CHE-ROT-01",
            "origin": "Chennai",
            "destination": "Rotterdam",
            "cargo_type": "Machinery",
            "containers": 10,
            "container_type": "40ft",
            "currency": "USD",
            "pricing": {
                "base_freight": 14000,
                "fuel_surcharge": 3500,
                "port_handling": 2200,
                "total_freight_cost": 20700
            }
        },
        "margin_percent": 7.0,
        "quotation_result": {
            "status": "success",
            "quotation_id": "QTE-CHE-ROT-0012",
            "financials": {
                "freight_cost": 20700,
                "margin_percent": 7.0,
                "margin_amount": 1449,
                "customer_price": 22149,
                "currency": "USD"
            }
        }
    },
    {
        "id": "REQ-0011",
        "customer_id": "CUST-DEMO-001",
        "customer_name": "Global Logistics Corp",
        "customer_email": "customer@maritime.com",
        "origin": "Singapore",
        "destination": "Los Angeles",
        "cargo_type": "Electronics",
        "container_type": "40ft",
        "containers": 5,
        "details": "High value consumer electronics.",
        "notes": "Requires sealed container monitoring.",
        "request_date": "Sep 18, 2026",
        "status": "In Review",
        "rejection_reason": None,
        "route_result": None,
        "pricing_result": None,
        "margin_percent": 15.0,
        "quotation_result": None
    },
    {
        "id": "REQ-0010",
        "customer_id": "CUST-DEMO-001",
        "customer_name": "Global Logistics Corp",
        "customer_email": "customer@maritime.com",
        "origin": "Mumbai",
        "destination": "Hamburg",
        "cargo_type": "Textile",
        "container_type": "20ft",
        "containers": 8,
        "details": "Garments & raw textile rolls.",
        "notes": "Dry container storage.",
        "request_date": "Sep 15, 2026",
        "status": "Accepted",
        "rejection_reason": None,
        "route_result": None,
        "pricing_result": None,
        "margin_percent": 15.0,
        "quotation_result": None
    },
    {
        "id": "REQ-0009",
        "customer_id": "CUST-DEMO-001",
        "customer_name": "Global Logistics Corp",
        "customer_email": "customer@maritime.com",
        "origin": "Chennai",
        "destination": "New York",
        "cargo_type": "Chemicals",
        "container_type": "40ft",
        "containers": 6,
        "details": "Industrial non-hazardous liquid chemicals.",
        "notes": "Special ISO tank container handling.",
        "request_date": "Sep 10, 2026",
        "status": "Quotation Ready",
        "rejection_reason": None,
        "route_result": {
            "query": {"origin": "Chennai", "destination": "New York", "cargo_type": "Chemicals", "containers": 6},
            "best_route": {
                "route_id": "R-CHE-NYC-01",
                "route_name": "Atlantic Express",
                "ocean_corridor": "Indian Ocean → Suez Canal → Atlantic Ocean",
                "transit_days": 26,
                "distance_nautical_miles": 8400,
                "transshipments": 0,
                "route_score": 91
            }
        },
        "pricing_result": {
            "route_id": "R-CHE-NYC-01",
            "origin": "Chennai",
            "destination": "New York",
            "cargo_type": "Chemicals",
            "containers": 6,
            "container_type": "40ft",
            "currency": "USD",
            "pricing": {"total_freight_cost": 18400}
        },
        "margin_percent": 10.0,
        "quotation_result": {
            "status": "success",
            "quotation_id": "QTE-CHE-NYC-0009",
            "financials": {
                "customer_price": 20240,
                "currency": "USD"
            }
        }
    },
    {
        "id": "REQ-0008",
        "customer_id": "CUST-DEMO-001",
        "customer_name": "Global Logistics Corp",
        "customer_email": "customer@maritime.com",
        "origin": "Shanghai",
        "destination": "Sydney",
        "cargo_type": "Automobile Parts",
        "container_type": "20ft",
        "containers": 4,
        "details": "OEM spare automotive components.",
        "notes": "Delivered successfully.",
        "request_date": "Sep 05, 2026",
        "status": "Completed",
        "rejection_reason": None,
        "route_result": None,
        "pricing_result": None,
        "margin_percent": 12.0,
        "quotation_result": None
    }
]


@app.get("/api/requests", summary="Get All Customer Shipment Requests")
def get_customer_requests(customer_id: Optional[str] = None, email: Optional[str] = None):
    """
    Retrieve customer shipment requests.
    If customer_id or email is specified, filters accordingly.
    """
    if customer_id:
        return [r for r in customer_requests_db if r.get("customer_id") == customer_id or r.get("customer_email", "").lower() == customer_id.lower()]
    if email:
        clean_email = email.strip().lower()
        return [r for r in customer_requests_db if r.get("customer_email", "").lower() == clean_email]
    return customer_requests_db


@app.post("/api/requests", summary="Create Customer Shipment Request")
def create_customer_request(req: CustomerShipmentRequestModel):
    """
    Customer submits a new shipment request.
    Status defaults to 'Pending'.
    """
    try:
        if req.containers <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to submit the shipment request. Please try again."
            )

        new_id = f"REQ-2026-{1001 + len(customer_requests_db)}"
        now_str = datetime.now().strftime("%Y-%m-%d %I:%M %p")

        cust_id = req.customer_id or f"CUST-{req.customer_email.strip().lower()}"

        record = {
            "id": new_id,
            "customer_id": cust_id,
            "customer_name": req.customer_name.strip(),
            "customer_email": req.customer_email.strip().lower(),
            "origin": req.origin.strip(),
            "destination": req.destination.strip(),
            "cargo_type": req.cargo_type.strip(),
            "container_type": req.container_type or "40ft",
            "containers": req.containers,
            "details": req.details or "",
            "notes": req.notes or "",
            "request_date": now_str,
            "status": "Pending",
            "rejection_reason": None,
            "route_result": None,
            "pricing_result": None,
            "margin_percent": 15.0,
            "quotation_result": None
        }

        customer_requests_db.insert(0, record)
        return {
            "status": "success",
            "message": "Shipment request submitted successfully. Waiting for broker approval.",
            "request": record
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating shipment request: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to submit the shipment request. Please try again."
        )


@app.put("/api/requests/{request_id}", summary="Update Customer Shipment Request Status")
def update_customer_request(request_id: str, update: UpdateRequestStatusModel):
    """
    Broker updates status, route results, pricing results, or quotation results for a request.
    """
    for req in customer_requests_db:
        if req["id"].upper() == request_id.upper():
            req["status"] = update.status
            req["last_updated"] = update.last_updated or datetime.now().strftime("%b %d, %Y %I:%M %p")
            if update.rejection_reason is not None:
                req["rejection_reason"] = update.rejection_reason
            if update.route_result is not None:
                req["route_result"] = update.route_result
            if update.pricing_result is not None:
                req["pricing_result"] = update.pricing_result
            if update.margin_percent is not None:
                req["margin_percent"] = update.margin_percent
            if update.quotation_result is not None:
                req["quotation_result"] = update.quotation_result

            return {
                "status": "success",
                "message": f"Request {request_id} updated to status {update.status}",
                "request": req
            }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Shipment request not found."
    )



@app.get("/", summary="Root API Health Check")
def read_root():
    """
    Root endpoint returning system status and milestone information.
    """
    return {
        "message": "Agentic Maritime Brokerage API is running",
        "project": "Maritime Freight Quotation & Pricing Platform",
        "milestones": ["Milestone 1 - Route Intelligence", "Milestone 2 - Pricing Agent & Freight Cost"]
    }


@app.post("/api/routes/analyze", summary="Analyze Shipping Route")
def analyze_route(request: RouteRequest):
    """
    Route Intelligence endpoint.
    Accepts RouteRequest with origin, destination, cargo_type, and container count.
    """
    try:
        if request.containers <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of containers must be greater than 0."
            )

        result = route_agent.analyze_route(request)

        if result.get("status") == "error" or not result.get("matched") or not result.get("best_route"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No available route found for this shipment."
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Internal Exception in analyze_route: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No available route found for this shipment."
        )


@app.post("/api/pricing/calculate", summary="Calculate Freight Cost Breakdown")
def calculate_pricing(request: PricingRequest):
    """
    Pricing Agent Endpoint.
    Consumes selected Route ID, cargo parameters, and queries pricing.csv to calculate
    base freight, fuel surcharge, port handling, transshipment fees, and total cost.
    """
    try:
        if request.containers <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of containers must be greater than 0."
            )

        transshipments = 0
        route_name = f"{request.origin} → {request.destination}"

        if route_agent.df is not None and not route_agent.df.empty:
            matched_route = route_agent.df[
                route_agent.df["route_id"].astype(str).str.strip().str.upper() == request.route_id.strip().upper()
            ]
            if not matched_route.empty:
                row = matched_route.iloc[0]
                transshipments = int(row.get("transshipments", 0))
                route_name = str(row.get("route_name", route_name))

        result = pricing_agent.calculate_price(
            route_id=request.route_id,
            origin=request.origin,
            destination=request.destination,
            cargo_type=request.cargo_type,
            containers=request.containers,
            container_type=request.container_type,
            transshipments=transshipments,
            route_name=route_name
        )

        if result.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pricing not available for this route."
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Internal Exception in calculate_pricing: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing not available for this route."
        )


@app.post("/api/quotation/generate", summary="Generate Customer Quotation")
def generate_quotation(request: QuotationRequest):
    """
    Quotation Agent Endpoint.
    Consumes Pricing Agent calculation result to generate a formal customer quote.
    """
    try:
        if request.margin_percent is not None and float(request.margin_percent) < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Margin must be 0% or greater."
            )

        # First calculate freight pricing using Pricing Agent
        pricing_res = calculate_pricing(
            PricingRequest(
                route_id=request.route_id,
                origin=request.origin,
                destination=request.destination,
                cargo_type=request.cargo_type,
                containers=request.containers,
                container_type=request.container_type
            )
        )

        # Generate customer quotation via Quotation Agent & Margin Agent
        quote_res = quotation_agent.generate_quotation(
            pricing_result=pricing_res,
            customer_name=request.customer_name or "Valued Maritime Client",
            margin_percent=request.margin_percent if request.margin_percent is not None else 15.0
        )

        if quote_res.get("status") == "error":
            msg = quote_res.get("message", "")
            if "Margin" in msg or "margin" in msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Margin must be 0% or greater."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg or "Margin must be 0% or greater."
            )

        return quote_res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Internal Exception in generate_quotation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Margin must be 0% or greater."
        )


# =====================================================================
# WEATHER INTELLIGENCE AGENT ENDPOINTS
# =====================================================================

@app.post("/api/weather/analyze-route", summary="Analyze Weather Risk for Maritime Route")
def analyze_route_weather(request: WeatherRequest):
    """
    Weather Agent Endpoint.
    Analyzes marine & atmospheric weather conditions across route checkpoints and calculates Weather Risk Score.
    """
    try:
        result = weather_agent.analyze_route(
            origin=request.origin,
            destination=request.destination,
            ocean_corridor=request.ocean_corridor
        )
        return result
    except Exception as e:
        logger.error(f"Error analyzing route weather: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weather service is temporarily unavailable."
        )


@app.get("/api/weather/route/{route_id}", summary="Get Weather Analysis by Route ID")
def get_weather_by_route_id(route_id: str):
    """
    Fetches route data from dataset by route_id and runs Weather Agent analysis.
    """
    try:
        matched_route = None
        if route_agent.df is not None and not route_agent.df.empty:
            matches = route_agent.df[
                route_agent.df["route_id"].astype(str).str.strip().str.upper() == route_id.strip().upper()
            ]
            if not matches.empty:
                matched_route = matches.iloc[0].to_dict()

        if matched_route:
            orig = str(matched_route.get("origin", "Chennai"))
            dest = str(matched_route.get("destination", "Rotterdam"))
            corridor = str(matched_route.get("ocean_corridor", ""))
        else:
            orig = "Chennai"
            dest = "Rotterdam"
            corridor = None

        result = weather_agent.analyze_route(orig, dest, corridor)
        result["route_id"] = route_id
        if matched_route:
            result["route_name"] = str(matched_route.get("route_name", "Ocean Corridor"))
        return result
    except Exception as e:
        logger.error(f"Error fetching weather for route {route_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weather service is temporarily unavailable."
        )


@app.post("/api/weather/compare-routes", summary="Compare Weather Risk Across Multiple Candidate Routes")
def compare_route_weather(request: WeatherRouteCompareRequest):
    """
    Weather Agent Endpoint comparing weather risk scores and safety recommendations across multiple candidate routes.
    """
    try:
        if not request.routes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No candidate routes provided for comparison."
            )
        result = weather_agent.compare_route_weather(request.routes)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing route weather: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weather service is temporarily unavailable."
        )


@app.get("/api/weather/shipment/{shipment_id}", summary="Get Active Weather Monitoring for a Shipment")
def get_shipment_weather(shipment_id: str):
    """
    Retrieves active weather monitoring and customer weather advisory status for a confirmed shipment.
    """
    try:
        req_item = next((r for r in customer_requests_db if r["id"].upper() == shipment_id.upper()), None)
        if not req_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shipment {shipment_id} not found."
            )

        orig = req_item.get("origin", "Chennai")
        dest = req_item.get("destination", "Rotterdam")
        corridor = req_item.get("route_result", {}).get("best_route", {}).get("ocean_corridor") if req_item.get("route_result") else None

        weather_res = weather_agent.analyze_route(orig, dest, corridor)
        customer_summary = weather_agent.get_customer_weather_status(weather_res)

        return {
            "status": "success",
            "shipment_id": shipment_id,
            "weather_analysis": weather_res,
            "customer_summary": customer_summary
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching shipment weather for {shipment_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Weather information is currently unavailable."
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

