from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.models import RouteRequest, PricingRequest, QuotationRequest
from app.agents.route_agent import RouteAgent
from app.agents.pricing_agent import PricingAgent
from app.agents.quotation_agent import QuotationAgent

# Initialize FastAPI Application with metadata
app = FastAPI(
    title="Agentic Maritime Brokerage Platform",
    description="AI-powered maritime freight pricing and route optimization platform",
    version="1.1.0"
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
quotation_agent = QuotationAgent()


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
    result = route_agent.analyze_route(request)
    return result


@app.post("/api/pricing/calculate", summary="Calculate Freight Cost Breakdown")
def calculate_pricing(request: PricingRequest):
    """
    Pricing Agent Endpoint.
    Consumes selected Route ID, cargo parameters, and queries pricing.csv to calculate
    base freight, fuel surcharge, port handling, transshipment fees, and total cost.
    """
    if request.containers <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number of containers must be greater than 0."
        )

    # Search route_dataset to fetch route transshipments and route name
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

    # Calculate pricing via Pricing Agent using pricing.csv
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
            detail=result.get("message", "Pricing data not available for the selected parameters.")
        )

    return result


@app.post("/api/quotation/generate", summary="Generate Customer Quotation")
def generate_quotation(request: QuotationRequest):
    """
    Quotation Agent Endpoint.
    Consumes Pricing Agent calculation result to generate a formal customer quote.
    """
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

    # Generate customer quotation via Quotation Agent
    quote_res = quotation_agent.generate_quotation(
        pricing_result=pricing_res,
        customer_name=request.customer_name or "Valued Maritime Client",
        margin_percent=request.margin_percent or 15.0
    )

    return quote_res


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
