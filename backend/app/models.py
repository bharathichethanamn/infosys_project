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
    margin_percent: Optional[float] = Field(default=15.0, description="Broker margin percentage")


class CustomerShipmentRequestModel(BaseModel):
    """
    Model representing a customer-submitted shipment request.
    """
    customer_id: Optional[str] = Field(default=None, description="Authenticated customer ID")
    customer_name: str = Field(..., description="Customer full name or company name")
    customer_email: str = Field(..., description="Customer email address")
    origin: str = Field(..., description="Origin port")
    destination: str = Field(..., description="Destination port")
    cargo_type: str = Field(..., description="Cargo type")
    container_type: str = Field(default="40ft", description="Container type (20ft, 40ft)")
    containers: int = Field(..., gt=0, description="Number of containers")
    details: Optional[str] = Field(default="", description="Required shipment details")
    notes: Optional[str] = Field(default="", description="Optional notes")


class UpdateRequestStatusModel(BaseModel):
    """
    Model for updating the status of a shipment request.
    """
    status: str = Field(..., description="New status")
    last_updated: Optional[str] = Field(default=None, description="Timestamp of status update")
    rejection_reason: Optional[str] = Field(default=None, description="Reason if rejected")
    route_result: Optional[dict] = Field(default=None)
    pricing_result: Optional[dict] = Field(default=None)
    margin_percent: Optional[float] = Field(default=None)
    quotation_result: Optional[dict] = Field(default=None)


class WeatherRequest(BaseModel):
    """
    Model representing a weather analysis request for a route or corridor.
    """
    origin: str = Field(..., description="Origin port or city", example="Chennai")
    destination: str = Field(..., description="Destination port or city", example="Rotterdam")
    ocean_corridor: Optional[str] = Field(default=None, description="Description of shipping corridor")
    route_id: Optional[str] = Field(default=None, description="Optional route ID")


class WeatherRouteCompareRequest(BaseModel):
    """
    Model representing a multi-route weather comparison request.
    """
    routes: list = Field(..., description="List of candidate route objects to analyze and compare")



