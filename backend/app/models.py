from pydantic import BaseModel, Field
from typing import Optional


class RouteRequest(BaseModel):
    """
    Model representing a maritime route intelligence request.
    Validates origin, destination, cargo type, and container count.
    """
    origin: str = Field(..., description="Origin port or city", example="Chennai")
    destination: str = Field(..., description="Destination port or city", example="Rotterdam")
    cargo_type: str = Field(..., description="Type of cargo being transported", example="Electronics")
    containers: int = Field(..., gt=0, description="Number of containers (must be greater than 0)", example=10)


class PricingRequest(BaseModel):
    """
    Model representing a freight pricing calculation request.
    Validates route ID, origin, destination, cargo type, containers, and container type.
    """
    route_id: str = Field(..., description="Route ID selected from dataset", example="R-CHE-ROT-01")
    origin: str = Field(..., description="Origin port or city", example="Chennai")
    destination: str = Field(..., description="Destination port or city", example="Rotterdam")
    cargo_type: str = Field(..., description="Cargo type", example="Electronics")
    containers: int = Field(..., gt=0, description="Number of containers (must be greater than 0)", example=10)
    container_type: str = Field(default="40ft", description="Container type (20ft, 40ft)", example="40ft")


class QuotationRequest(BaseModel):
    """
    Model representing a customer quotation generation request.
    """
    route_id: str = Field(..., description="Route ID selected from dataset", example="R-CHE-ROT-01")
    origin: str = Field(..., description="Origin port", example="Chennai")
    destination: str = Field(..., description="Destination port", example="Rotterdam")
    cargo_type: str = Field(..., description="Cargo type", example="Electronics")
    containers: int = Field(..., gt=0, description="Number of containers", example=10)
    container_type: str = Field(default="40ft", description="Container type", example="40ft")
    customer_name: Optional[str] = Field(default="Valued Maritime Client", description="Client or company name")
    margin_percent: Optional[float] = Field(default=15.0, ge=0.0, description="Broker margin percentage")
