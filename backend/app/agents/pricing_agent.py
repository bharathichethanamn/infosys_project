"""
Pricing Agent Module (Milestone 2 Specification)

Calculates freight operating cost and demand adjusted cost based on separate pricing.csv dataset queries.

Milestone 2 Formulas:
1. Operating Cost = Base Freight + Fuel Surcharge + Port Charge + Risk Surcharge
2. Demand Adjustment = Operating Cost * Demand Factor => Demand Adjusted Cost
Target Margin Percent is returned as data only.
No final selling price, brokerage profit, or Margin Agent calculation is added.
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
        Calculates Milestone 2 Freight Operating Cost & Demand Adjusted Cost based on pricing.csv data.
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

        # Support exact column names in pricing.csv (with fallback to old names)
        cols_lower = {str(c).strip().lower(): c for c in self.df.columns}
        route_col = cols_lower.get("route_id", cols_lower.get("route id", "route_id"))
        cargo_col = cols_lower.get("cargo_type", cols_lower.get("cargo type", "cargo_type"))
        container_col = cols_lower.get("container_type", cols_lower.get("container type", "container_type"))

        # Step 1: Filter by Route ID (case-insensitive)
        route_matches = self.df[self.df[route_col].astype(str).str.strip().str.upper() == route_id_clean]

        if route_matches.empty:
            return {
                "status": "error",
                "message": f"Pricing data not available for the selected route ({route_id})."
            }

        # Step 2: Try matching exact Cargo Type & Container Type
        exact_match = route_matches[
            (route_matches[cargo_col].astype(str).str.strip().str.lower() == cargo_clean) &
            (route_matches[container_col].astype(str).str.strip().str.lower() == container_clean)
        ]

        matched_row = None
        if not exact_match.empty:
            matched_row = exact_match.iloc[0]
        else:
            # Fallback 1: Match Container Type with any cargo
            container_match = route_matches[
                route_matches[container_col].astype(str).str.strip().str.lower() == container_clean
            ]
            if not container_match.empty:
                matched_row = container_match.iloc[0]
            else:
                # Fallback 2: Match any available row for this Route ID
                matched_row = route_matches.iloc[0]

        try:
            pricing_id = str(matched_row.get("pricing_id", matched_row.get("Pricing ID", "P000"))).strip()

            base_rate = float(matched_row.get("base_freight_usd", matched_row.get("Base Freight Per Container", 1500)))
            fuel_rate = float(matched_row.get("fuel_surcharge_usd", matched_row.get("Fuel Surcharge Per Container", 200)))
            port_rate = float(matched_row.get("port_charge_usd", matched_row.get("Port Handling Per Container", 100)))
            risk_rate = float(matched_row.get("risk_surcharge_usd", 0.0))

            demand_factor = float(matched_row.get("demand_factor", 1.15))
            target_margin_percent = float(matched_row.get("target_margin_percent", 15.0))
            currency = str(matched_row.get("currency", matched_row.get("Currency", "USD"))).strip()

            # Quantity calculation: Per-container value x number of containers
            base_freight = round(base_rate * containers, 2)
            fuel_surcharge = round(fuel_rate * containers, 2)
            port_charge = round(port_rate * containers, 2)
            risk_surcharge = round(risk_rate * containers, 2)

            # Milestone 2 Calculations:
            # 1. Operating Cost = Base Freight + Fuel Surcharge + Port Charge + Risk Surcharge
            operating_cost = round(base_freight + fuel_surcharge + port_charge + risk_surcharge, 2)

            # 2. Demand Adjustment = Operating Cost * Demand Factor
            demand_adjusted_cost = round(operating_cost * demand_factor, 2)

            display_route_name = route_name or f"{origin} → {destination}"

            return {
                "status": "success",
                "pricing_id": pricing_id,
                "route_id": route_id,
                "route_name": display_route_name,
                "origin": origin,
                "destination": destination,
                "cargo_type": cargo_type,
                "container_type": container_type,
                "containers": containers,
                "transshipments": int(transshipments),
                "pricing": {
                    "pricing_id": pricing_id,
                    "route_id": route_id,
                    "base_freight": base_freight,
                    "fuel_surcharge": fuel_surcharge,
                    "port_charge": port_charge,
                    "risk_surcharge": risk_surcharge,
                    "operating_cost": operating_cost,
                    "demand_factor": demand_factor,
                    "demand_adjusted_cost": demand_adjusted_cost,
                    "target_margin_percent": target_margin_percent,
                    # Primary Milestone 2 output
                    "total_freight_cost": demand_adjusted_cost,
                    "rates_per_container": {
                        "base_freight_usd": base_rate,
                        "fuel_surcharge_usd": fuel_rate,
                        "port_charge_usd": port_rate,
                        "risk_surcharge_usd": risk_rate,
                        "base_freight_per_container": base_rate,
                        "fuel_surcharge_per_container": fuel_rate,
                        "port_handling_per_container": port_rate
                    }
                },
                "currency": currency
            }

        except Exception as e:
            return {
                "status": "error",
                "message": f"Error parsing pricing calculations: {str(e)}"
            }

