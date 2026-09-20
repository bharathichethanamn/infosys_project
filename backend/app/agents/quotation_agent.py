"""
Quotation Agent Module

Consumes Pricing Agent results to generate formal customer freight quotations.
Supports broker markup percentage, margin calculation, quote validity, and terms.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from app.agents.margin_agent import MarginAgent


class QuotationAgent:
    """
    Quotation Agent consuming PricingAgent calculations to generate customer quotations.
    Delegates all margin calculations to MarginAgent.
    """

    def __init__(self, margin_agent: Optional[MarginAgent] = None):
        self.margin_agent = margin_agent or MarginAgent()

    def generate_quotation(
        self,
        pricing_result: Dict[str, Any],
        customer_name: str = "Valued Maritime Client",
        margin_percent: float = 15.0
    ) -> Dict[str, Any]:
        """
        Generates formal customer quotation based on PricingAgent result and MarginAgent calculation.
        """
        if not pricing_result or pricing_result.get("status") != "success":
            return {
                "status": "error",
                "message": "Cannot generate quotation without a valid pricing calculation result."
            }

        pricing = pricing_result.get("pricing", {})
        total_freight_cost = float(pricing.get("total_freight_cost", 0))
        currency = pricing_result.get("currency", "USD")

        # Delegate margin calculation to standalone MarginAgent
        margin_res = self.margin_agent.calculate_margin(
            cost=total_freight_cost,
            margin_percent=margin_percent,
            currency=currency
        )

        if margin_res.get("status") == "error":
            return margin_res

        customer_price = margin_res.get("customer_price", 0.0)
        margin_amount = margin_res.get("margin_amount", 0.0)
        actual_margin_percent = margin_res.get("profit_margin_percent", 0.0)

        quote_date = datetime.now()
        valid_until = quote_date + timedelta(days=14)
        quote_id = f"QTE-{quote_date.strftime('%Y%m%d')}-{abs(hash(pricing_result.get('route_id', 'R001'))) % 10000:04d}"

        return {
            "status": "success",
            "quotation_id": quote_id,
            "customer_name": customer_name,
            "created_at": quote_date.strftime("%Y-%m-%d %H:%M:%S"),
            "valid_until": valid_until.strftime("%Y-%m-%d"),
            "shipment_summary": {
                "route_id": pricing_result.get("route_id"),
                "route_name": pricing_result.get("route_name"),
                "origin": pricing_result.get("origin"),
                "destination": pricing_result.get("destination"),
                "cargo_type": pricing_result.get("cargo_type"),
                "container_type": pricing_result.get("container_type"),
                "containers": pricing_result.get("containers"),
                "transshipments": pricing_result.get("transshipments", 0)
            },
            "cost_breakdown": pricing,
            "financials": {
                "total_freight_cost": total_freight_cost,
                "margin_percent": margin_percent,
                "margin_amount": margin_amount,
                "customer_price": customer_price,
                "estimated_profit": margin_amount,
                "profit_margin_percent": actual_margin_percent,
                "currency": currency
            },
            "terms": "Quotation valid for 14 days. Rates subject to port congestion and bunker fuel price fluctuations."
        }

