"""
Pricing Agent Module

Calculates freight costs based on separate pricing.csv dataset queries.
Combines route details (transshipments count), shipment parameters, and container rate surcharges.
"""

from pathlib import Path
import pandas as pd
from typing import Dict, Any, Optional

DATASET_PATH = Path(__file__).parent.parent / "data" / "pricing.csv"


class PricingAgent:
    """
    Pricing Agent handling freight cost calculations and pricing breakdown.
    Uses Pandas to query pricing.csv based on Route ID, Cargo Type, and Container Type.
    """

    def __init__(self):
        self.df = None
        self.load_dataset()

    def load_dataset(self):
        """Loads pricing CSV dataset into Pandas DataFrame."""
        try:
            if DATASET_PATH.exists():
                self.df = pd.read_csv(DATASET_PATH)
            else:
                self.df = pd.DataFrame()
        except Exception:
            self.df = pd.DataFrame()

    def calculate_price(
        self,
        route_id: str,
        origin: str,
        destination: str,
        cargo_type: str,
        containers: int,
        container_type: str = "40ft",
        transshipments: int = 0,
        route_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates total freight cost breakdown based on pricing.csv data.
        
        Formula:
        - Base Freight = Base Freight Per Container * containers
        - Fuel Surcharge = Fuel Surcharge Per Container * containers
        - Port Handling = Port Handling Per Container * containers
        - Transshipment Charge = Transshipment Charge Per Container * containers * transshipments
        - Other Charges = Other Charges Per Container * containers
        - Total Freight Cost = Sum of all above components
        """
        self.load_dataset()

        if self.df is None or self.df.empty:
            return {
                "status": "error",
                "message": "Pricing dataset is unavailable or empty."
            }

        route_id_clean = str(route_id).strip().upper()
        cargo_clean = str(cargo_type).strip().lower()
        container_clean = str(container_type).strip().lower()

        # Step 1: Filter by Route ID (case-insensitive)
        route_matches = self.df[self.df["Route ID"].astype(str).str.strip().str.upper() == route_id_clean]

        if route_matches.empty:
            return {
                "status": "error",
                "message": f"Pricing data not available for the selected route ({route_id}), cargo type and container type."
            }

        # Step 2: Try matching exact Cargo Type & Container Type
        exact_match = route_matches[
            (route_matches["Cargo Type"].astype(str).str.strip().str.lower() == cargo_clean) &
            (route_matches["Container Type"].astype(str).str.strip().str.lower() == container_clean)
        ]

        matched_row = None
        if not exact_match.empty:
            matched_row = exact_match.iloc[0]
        else:
            # Fallback 1: Match Container Type with any cargo
            container_match = route_matches[
                route_matches["Container Type"].astype(str).str.strip().str.lower() == container_clean
            ]
            if not container_match.empty:
                matched_row = container_match.iloc[0]
            else:
                # Fallback 2: Match any available row for this Route ID
                matched_row = route_matches.iloc[0]

        try:
            base_rate = float(matched_row["Base Freight Per Container"])
            fuel_rate = float(matched_row["Fuel Surcharge Per Container"])
            port_rate = float(matched_row["Port Handling Per Container"])
            transshipment_rate = float(matched_row["Transshipment Charge Per Container"])
            other_rate = float(matched_row["Other Charges Per Container"])
            currency = str(matched_row.get("Currency", "USD")).strip()

            # Calculations
            base_freight = round(base_rate * containers, 2)
            fuel_surcharge = round(fuel_rate * containers, 2)
            port_handling = round(port_rate * containers, 2)
            transshipment_charge = round(transshipment_rate * containers * max(0, int(transshipments)), 2)
            other_charges = round(other_rate * containers, 2)

            total_freight_cost = round(
                base_freight + fuel_surcharge + port_handling + transshipment_charge + other_charges, 2
            )

            display_route_name = route_name or f"{origin} → {destination}"

            return {
                "status": "success",
                "route_id": route_id,
                "route_name": display_route_name,
                "origin": origin,
                "destination": destination,
                "cargo_type": cargo_type,
                "container_type": container_type,
                "containers": containers,
                "transshipments": int(transshipments),
                "pricing": {
                    "base_freight": base_freight,
                    "fuel_surcharge": fuel_surcharge,
                    "port_handling": port_handling,
                    "transshipment_charge": transshipment_charge,
                    "other_charges": other_charges,
                    "total_freight_cost": total_freight_cost,
                    "rates_per_container": {
                        "base_freight_per_container": base_rate,
                        "fuel_surcharge_per_container": fuel_rate,
                        "port_handling_per_container": port_rate,
                        "transshipment_charge_per_container": transshipment_rate,
                        "other_charges_per_container": other_rate
                    }
                },
                "currency": currency
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Error parsing pricing calculations: {str(e)}"
            }
