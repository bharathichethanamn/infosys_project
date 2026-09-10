from pydantic import BaseModel, Field


class RouteRequest(BaseModel):
    """
    Model representing a maritime route intelligence request.
    Validates origin, destination, cargo type, and container count.
    """
    origin: str = Field(..., description="Origin port or city", example="Chennai")
    destination: str = Field(..., description="Destination port or city", example="Rotterdam")
    cargo_type: str = Field(..., description="Type of cargo being transported", example="Electronics")
    containers: int = Field(..., gt=0, description="Number of containers (must be a positive integer)", example=10)
