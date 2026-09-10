"""
Quotation Agent Module

Consumes Pricing Agent results to generate formal customer freight quotations.
Supports broker markup percentage, margin calculation, quote validity, and terms.
"""

from typing import Dict, Any, Optional
from datetime import datetime, timedelta


class QuotationAgent:
    """
    Quotation Agent consuming PricingAgent calculations to generate customer quotations.
    """

    def generate_quotation(
        self,
        pricing_result: Dict[str, Any],
        customer_name: str = "Valued Maritime Client",
        margin_percent: float = 15.0
    ) -> Dict[str, Any]:
        """
        Generates formal customer quotation based on PricingAgent result.
        
        Customer Price = Total Freight Cost * (1 + margin_percent / 100)
        Profit = Customer Price - Total Freight Cost
        Profit Margin = (Profit / Customer Price) * 100
        """
        if not pricing_result or pricing_result.get("status") != "success":
            return {
                "status": "error",
                "message": "Cannot generate quotation without a valid pricing calculation result."
            }

        pricing = pricing_result.get("pricing", {})
        total_freight_cost = float(pricing.get("total_freight_cost", 0))
        currency = pricing_result.get("currency", "USD")

        # Apply broker markup/margin
        margin_factor = 1.0 + (max(0.0, float(margin_percent)) / 100.0)
        customer_price = round(total_freight_cost * margin_factor, 2)
        profit = round(customer_price - total_freight_cost, 2)
        actual_margin_percent = round((profit / customer_price * 100.0) if customer_price > 0 else 0.0, 2)

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
                "customer_price": customer_price,
                "estimated_profit": profit,
                "profit_margin_percent": actual_margin_percent,
                "currency": currency
            },
            "terms": "Quotation valid for 14 days. Rates subject to port congestion and bunker fuel price fluctuations."
        }
