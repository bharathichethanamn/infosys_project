from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.models import RouteRequest
from app.agents.route_agent import RouteAgent

# Initialize FastAPI Application with metadata
app = FastAPI(
    title="Agentic Maritime Brokerage Platform",
    description="AI-powered maritime freight quotation platform",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from Vite React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate Route Agent foundation
route_agent = RouteAgent()


@app.get("/", summary="Root API Health Check")
def read_root():
    """
    Root endpoint returning system status and milestone information.
    """
    return {
        "message": "Agentic Maritime Brokerage API is running",
        "project": "Maritime Freight Quotation Platform",
        "milestone": "Milestone 1 - Route Intelligence"
    }


@app.post("/api/routes/analyze", summary="Analyze Shipping Route (Foundation)")
def analyze_route(request: RouteRequest):
    """
    Route Intelligence & Quotation Foundation endpoint.
    Accepts RouteRequest with origin, destination, cargo_type, and container count.
    """
    result = route_agent.analyze_route(request)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
