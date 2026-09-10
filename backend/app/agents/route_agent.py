"""
Route Agent Module (Milestone 1)

Processes maritime route requests using Pandas and dataset queries.
Compares candidate routes based on transit time, ocean distance, transshipments,
and reliability, then calculates route scores and selects the Best Route.
"""

from pathlib import Path
import pandas as pd
from app.models import RouteRequest

# Path to maritime routes CSV dataset
DATASET_PATH = Path(__file__).parent.parent / "data" / "maritime_routes.csv"


class RouteAgent:
    """
    Route Agent handling route intelligence, candidate evaluation, and Best Route selection.
    """

    def __init__(self):
        self.df = None
        self.load_dataset()

    def load_dataset(self):
        """Loads maritime CSV dataset into Pandas DataFrame."""
        try:
            if DATASET_PATH.exists():
                self.df = pd.read_csv(DATASET_PATH)
            else:
                self.df = pd.DataFrame()
        except Exception:
            self.df = pd.DataFrame()

    def _calculate_score(self, row) -> int:
        """
        Calculates a composite Route Score (0-100) considering:
        - Transit days (penalty for longer duration)
        - Distance in nautical miles (penalty for longer distance)
        - Transshipment count (penalty per transshipment handling stop)
        - Reliability rating (bonus for higher reliability)
        """
        transit_days = float(row.get("transit_days", 25))
        distance = float(row.get("distance_nautical_miles", 7000))
        transshipments = float(row.get("transshipments", 0))
        reliability = float(row.get("reliability_rating", 90))

        # Scoring Formula
        raw_score = 100 - (transit_days * 1.4) - (distance / 350.0) - (transshipments * 8.0) + (reliability * 0.15)
        # Normalize between 10 and 99
        return max(10, min(99, round(raw_score)))

    def _generate_selection_reason(self, best_row, score: int) -> str:
        """Generates a human-readable reason why this route was selected as Best Route."""
        transit = best_row.get("transit_days")
        transshipments = best_row.get("transshipments")
        route_name = best_row.get("route_name")

        if transshipments == 0:
            return f"Selected '{route_name}' for optimal transit efficiency: Fastest speed ({transit} days) with 0 transshipment stops (Direct Ocean Service) and high carrier reliability."
        else:
            return f"Selected '{route_name}' as the optimal available corridor: Balanced transit time ({transit} days) via {best_row.get('transshipment_ports')}."

    def analyze_route(self, request: RouteRequest) -> dict:
        """
        Main Route Intelligence method.
        Filters candidate routes by origin & destination, scores all options,
        and returns the Best Route recommendation.
        """
        # Reload dataset in case updated
        self.load_dataset()

        origin_clean = request.origin.strip().lower()
        dest_clean = request.destination.strip().lower()

        available_routes = []
        best_route = None

        if self.df is not None and not self.df.empty:
            matches = self.df[
                (self.df["origin"].str.lower() == origin_clean) &
                (self.df["destination"].str.lower() == dest_clean)
            ]

            if not matches.empty:
                for _, row in matches.iterrows():
                    score = self._calculate_score(row)
                    route_item = {
                        "route_id": str(row["route_id"]),
                        "route_name": str(row["route_name"]),
                        "origin": str(row["origin"]),
                        "destination": str(row["destination"]),
                        "distance_nautical_miles": int(row["distance_nautical_miles"]),
                        "transit_days": int(row["transit_days"]),
                        "transshipments": int(row["transshipments"]),
                        "transshipment_ports": str(row["transshipment_ports"]),
                        "primary_chokepoints": str(row["primary_chokepoints"]),
                        "reliability_rating": int(row["reliability_rating"]),
                        "ocean_corridor": str(row["ocean_corridor"]),
                        "route_score": score
                    }
                    available_routes.append(route_item)

                # Sort routes by route_score descending
                available_routes.sort(key=lambda r: r["route_score"], reverse=True)

                # Best Route is the highest scoring route
                top_item = available_routes[0]
                best_route = dict(top_item)
                best_route["selection_reason"] = self._generate_selection_reason(top_item, top_item["route_score"])

                return {
                    "status": "success",
                    "matched": True,
                    "query": {
                        "origin": request.origin,
                        "destination": request.destination,
                        "cargo_type": request.cargo_type,
                        "containers": request.containers
                    },
                    "matching_count": len(available_routes),
                    "best_route": best_route,
                    "available_routes": available_routes
                }

        # If no exact match in CSV dataset
        return {
            "status": "success",
            "matched": False,
            "query": {
                "origin": request.origin,
                "destination": request.destination,
                "cargo_type": request.cargo_type,
                "containers": request.containers
            },
            "matching_count": 0,
            "best_route": None,
            "available_routes": [],
            "message": f"No matching routes found in dataset for corridor: {request.origin} ➔ {request.destination}"
        }
