"""
Margin Agent Module

Calculates broker margin amount, final customer price, and profit metrics based on cost and target/broker margin percent.
"""

from typing import Dict, Any


class MarginAgent:
    """
    Margin Agent responsible for broker markup and customer pricing calculations.
    """

    def calculate_margin(
        self,
        cost: float,
        margin_percent: float,
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """
        Calculates margin amount, customer price, and profit margin.

        Formula:
        margin_factor = 1.0 + (margin_percent / 100.0)
        customer_price = round(cost * margin_factor, 2)
        margin_amount = round(customer_price - cost, 2)
        profit_margin_percent = round((margin_amount / customer_price) * 100.0, 2) if customer_price > 0 else 0.0
        """
        try:
            margin_pct = float(margin_percent)
            if margin_pct < 0:
                return {
                    "status": "error",
                    "message": "Margin must be 0% or greater."
                }
        except (ValueError, TypeError):
            return {
                "status": "error",
                "message": "Margin must be 0% or greater."
            }

        cost_val = max(0.0, float(cost))
        margin_factor = 1.0 + (margin_pct / 100.0)
        customer_price = round(cost_val * margin_factor, 2)
        margin_amount = round(customer_price - cost_val, 2)
        profit_margin_percent = round((margin_amount / customer_price * 100.0) if customer_price > 0 else 0.0, 2)

        return {
            "status": "success",
            "base_cost": cost_val,
            "margin_percent": margin_pct,
            "margin_amount": margin_amount,
            "customer_price": customer_price,
            "profit_margin_percent": profit_margin_percent,
            "currency": currency
        }
