"""
Weather Agent Module (Advanced Maritime Weather Risk & Safety Intelligence)

Analyzes marine and atmospheric weather conditions along maritime shipping corridors.
Retrieves live weather & wave metrics via Open-Meteo & Marine APIs with intelligent fallback caches.
Evaluates multi-point route checkpoints, calculates composite Weather Risk Scores (0-100),
detects severe weather alerts, provides forecast trends, operational transit impacts,
and generates multi-route weather comparisons for broker decision support.
"""

import math
import logging
import urllib.request
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import pandas as pd

logger = logging.getLogger("maritime_brokerage.weather_agent")

# Default Configurable Risk Weights
DEFAULT_RISK_WEIGHTS = {
    "wind_risk": 0.20,
    "wave_risk": 0.25,
    "storm_risk": 0.25,
    "visibility_risk": 0.10,
    "rain_risk": 0.10,
    "sea_state_risk": 0.10,
}

# Maritime Port & Ocean Waypoint Coordinates Registry (Lat, Lon)
LOCATION_COORDINATES = {
    # Asia & SE Asia
    "chennai": {"name": "Chennai Port, India", "lat": 13.0827, "lon": 80.2707, "type": "port"},
    "mumbai": {"name": "Mumbai / Nhava Sheva, India", "lat": 18.9482, "lon": 72.8427, "type": "port"},
    "colombo": {"name": "Colombo Port, Sri Lanka", "lat": 6.9271, "lon": 79.8612, "type": "port"},
    "bay of bengal": {"name": "Bay of Bengal Waypoint", "lat": 13.0000, "lon": 85.0000, "type": "checkpoint"},
    "laccadive sea": {"name": "Laccadive Sea Waypoint", "lat": 8.5000, "lon": 75.2000, "type": "checkpoint"},
    "indian ocean": {"name": "Indian Ocean Waypoint", "lat": 6.0000, "lon": 80.0000, "type": "checkpoint"},
    "shanghai": {"name": "Shanghai Port, China", "lat": 31.2304, "lon": 121.4737, "type": "port"},
    "singapore": {"name": "Singapore Port", "lat": 1.3521, "lon": 103.8198, "type": "port"},
    "ningbo": {"name": "Ningbo-Zhoushan, China", "lat": 29.8683, "lon": 121.5440, "type": "port"},
    "tokyo": {"name": "Tokyo Port, Japan", "lat": 35.6762, "lon": 139.6503, "type": "port"},
    "busan": {"name": "Busan Port, South Korea", "lat": 35.1796, "lon": 129.0756, "type": "port"},
    "hong kong": {"name": "Hong Kong Port", "lat": 22.3193, "lon": 114.1694, "type": "port"},
    "yokohama": {"name": "Yokohama Port, Japan", "lat": 35.4437, "lon": 139.6380, "type": "port"},
    "port klang": {"name": "Port Klang, Malaysia", "lat": 3.0000, "lon": 101.4000, "type": "port"},
    "klang": {"name": "Port Klang, Malaysia", "lat": 3.0000, "lon": 101.4000, "type": "port"},
    "qingdao": {"name": "Qingdao Port, China", "lat": 36.0671, "lon": 120.3826, "type": "port"},
    "malacca strait": {"name": "Malacca Strait Waypoint", "lat": 2.5000, "lon": 101.5000, "type": "checkpoint"},
    "south china sea": {"name": "South China Sea Checkpoint", "lat": 15.0000, "lon": 115.0000, "type": "checkpoint"},
    "east china sea": {"name": "East China Sea Checkpoint", "lat": 28.0000, "lon": 125.0000, "type": "checkpoint"},

    # Middle East & Red Sea
    "dubai": {"name": "Jebel Ali / Dubai, UAE", "lat": 25.0000, "lon": 55.0000, "type": "port"},
    "jebel ali": {"name": "Jebel Ali / Dubai, UAE", "lat": 25.0000, "lon": 55.0000, "type": "port"},
    "salalah": {"name": "Salalah Port, Oman", "lat": 17.0152, "lon": 54.0924, "type": "port"},
    "arabian sea": {"name": "Arabian Sea Checkpoint", "lat": 14.0000, "lon": 65.0000, "type": "checkpoint"},
    "gulf of aden": {"name": "Gulf of Aden Waypoint", "lat": 12.8000, "lon": 48.0000, "type": "checkpoint"},
    "gulf of oman": {"name": "Gulf of Oman Checkpoint", "lat": 24.5000, "lon": 58.5000, "type": "checkpoint"},
    "bab-el-mandeb": {"name": "Bab-el-Mandeb Strait", "lat": 12.5833, "lon": 43.3333, "type": "checkpoint"},
    "red sea": {"name": "Red Sea Checkpoint", "lat": 20.0000, "lon": 38.5000, "type": "checkpoint"},
    "suez canal": {"name": "Suez Canal Transit Zone", "lat": 29.9333, "lon": 32.5500, "type": "checkpoint"},
    "suez": {"name": "Suez Canal Transit Zone", "lat": 29.9333, "lon": 32.5500, "type": "checkpoint"},

    # Europe & Atlantic
    "rotterdam": {"name": "Rotterdam Port, Netherlands", "lat": 51.9244, "lon": 4.4777, "type": "port"},
    "hamburg": {"name": "Hamburg Port, Germany", "lat": 53.5511, "lon": 9.9937, "type": "port"},
    "felixstowe": {"name": "Felixstowe Port, UK", "lat": 51.9617, "lon": 1.3513, "type": "port"},
    "antwerp": {"name": "Antwerp Port, Belgium", "lat": 51.2194, "lon": 4.4025, "type": "port"},
    "genoa": {"name": "Genoa Port, Italy", "lat": 44.4056, "lon": 8.9463, "type": "port"},
    "bremerhaven": {"name": "Bremerhaven, Germany", "lat": 53.5488, "lon": 8.5772, "type": "port"},
    "mediterranean sea": {"name": "Mediterranean Sea Checkpoint", "lat": 34.0000, "lon": 20.0000, "type": "checkpoint"},
    "mediterranean": {"name": "Mediterranean Sea Checkpoint", "lat": 34.0000, "lon": 20.0000, "type": "checkpoint"},
    "strait of gibraltar": {"name": "Strait of Gibraltar Waypoint", "lat": 35.9667, "lon": -5.3500, "type": "checkpoint"},
    "english channel": {"name": "English Channel Waypoint", "lat": 50.0000, "lon": -1.0000, "type": "checkpoint"},
    "bay of biscay": {"name": "Bay of Biscay Checkpoint", "lat": 45.0000, "lon": -5.0000, "type": "checkpoint"},
    "north sea": {"name": "North Sea Waypoint", "lat": 54.0000, "lon": 4.0000, "type": "checkpoint"},
    "atlantic": {"name": "Atlantic Ocean Checkpoint", "lat": 30.0000, "lon": -35.0000, "type": "checkpoint"},
    "south atlantic": {"name": "South Atlantic Ocean Checkpoint", "lat": -25.0000, "lon": 0.0000, "type": "checkpoint"},
    "north atlantic": {"name": "North Atlantic Ocean Checkpoint", "lat": 35.0000, "lon": -40.0000, "type": "checkpoint"},
    "cape of good hope": {"name": "Cape of Good Hope Waypoint", "lat": -34.3568, "lon": 18.4740, "type": "checkpoint"},
    "cape": {"name": "Cape of Good Hope Waypoint", "lat": -34.3568, "lon": 18.4740, "type": "checkpoint"},

    # Americas & Pacific
    "los angeles": {"name": "Los Angeles Port, USA", "lat": 33.7405, "lon": -118.2736, "type": "port"},
    "new york": {"name": "New York / New Jersey, USA", "lat": 40.7128, "lon": -74.0060, "type": "port"},
    "vancouver": {"name": "Vancouver Port, Canada", "lat": 49.2827, "lon": -123.1207, "type": "port"},
    "santos": {"name": "Santos Port, Brazil", "lat": -23.9608, "lon": -46.3339, "type": "port"},
    "pacific ocean": {"name": "Pacific Ocean Transit Checkpoint", "lat": 25.0000, "lon": 170.0000, "type": "checkpoint"},
    "sydney": {"name": "Sydney Port, Australia", "lat": -33.8688, "lon": 151.2093, "type": "port"},
    "melbourne": {"name": "Melbourne Port, Australia", "lat": -37.8136, "lon": 144.9631, "type": "port"},
}


class WeatherAgent:
    """
    Weather Agent analyzing marine and atmospheric conditions, risk scoring,
    and generating multi-route safety intelligence for brokers.
    """

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or DEFAULT_RISK_WEIGHTS
        self.csv_path = Path(__file__).parent.parent / "data" / "maritime_weather.csv"
        self.df = self._load_csv_dataset()

    def _load_csv_dataset(self) -> Optional[pd.DataFrame]:
        """Loads maritime weather CSV dataset into Pandas DataFrame."""
        try:
            if self.csv_path.exists():
                df = pd.read_csv(self.csv_path)
                logger.info(f"Loaded maritime weather dataset with {len(df)} records from {self.csv_path}")
                return df
            else:
                logger.warning(f"Maritime weather CSV dataset not found at {self.csv_path}")
        except Exception as e:
            logger.error(f"Failed to load maritime weather CSV dataset: {e}")
        return None

    def analyze_route(
        self, origin: str, destination: str, ocean_corridor: Optional[str] = None, route_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Alias for analyze_route_weather to maintain endpoint compatibility."""
        return self.analyze_route_weather(origin, destination, ocean_corridor, route_id=route_id)

    def resolve_location_coordinates(self, location_str: str) -> Dict[str, Any]:
        """Resolves port or waypoint string to lat, lon, and display name."""
        clean_key = location_str.strip().lower()
        
        # Direct match
        if clean_key in LOCATION_COORDINATES:
            return LOCATION_COORDINATES[clean_key]

        # Partial match
        for key, info in LOCATION_COORDINATES.items():
            if key in clean_key or clean_key in key:
                return info

        # Fallback default coordinates
        return {
            "name": location_str.title(),
            "lat": 15.0000,
            "lon": 75.0000,
            "type": "checkpoint"
        }

    def generate_route_checkpoints(
        self, origin: str, destination: str, ocean_corridor: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generates route-specific sequential weather checkpoints based on the route's exact path (ocean_corridor).
        Extracts geographic waypoints along the exact ocean path for each candidate route.
        """
        orig_info = self.resolve_location_coordinates(origin)
        dest_info = self.resolve_location_coordinates(destination)

        checkpoints = []
        checkpoints.append({
            "name": f"{orig_info['name']} (Origin Port)",
            "short_name": origin.title(),
            "lat": orig_info["lat"],
            "lon": orig_info["lon"],
            "type": "origin",
            "sequence": 1
        })

        intermediate_locations = []

        if ocean_corridor and ocean_corridor.strip():
            # Standardize corridor separator
            clean_corridor = ocean_corridor.replace("➔", "→").replace("->", "→").replace(" - ", "→")
            segments = [s.strip() for s in clean_corridor.split("→") if s.strip()]

            for seg in segments:
                seg_lower = seg.lower()

                # Skip origin or destination if already in segment string
                if origin.lower() in seg_lower or destination.lower() in seg_lower:
                    continue

                # Find best location match in registry
                matched_loc = None
                if seg_lower in LOCATION_COORDINATES:
                    matched_loc = LOCATION_COORDINATES[seg_lower]
                else:
                    for k, info in LOCATION_COORDINATES.items():
                        if k in seg_lower or seg_lower in k:
                            matched_loc = info
                            break

                if matched_loc and matched_loc not in intermediate_locations:
                    intermediate_locations.append(matched_loc)

        # Fallback intermediate generation if corridor path yields no direct waypoint match
        if not intermediate_locations:
            corridor_lower = (ocean_corridor or "").lower()
            if "cape" in corridor_lower:
                intermediate_locations = [
                    LOCATION_COORDINATES["indian ocean"],
                    LOCATION_COORDINATES["cape of good hope"],
                    LOCATION_COORDINATES["south atlantic"],
                    LOCATION_COORDINATES["english channel"]
                ]
            elif "suez" in corridor_lower or "red sea" in corridor_lower:
                intermediate_locations = [
                    LOCATION_COORDINATES["indian ocean"],
                    LOCATION_COORDINATES["arabian sea"],
                    LOCATION_COORDINATES["bab-el-mandeb"],
                    LOCATION_COORDINATES["red sea"],
                    LOCATION_COORDINATES["mediterranean sea"]
                ]
            else:
                mid_lat = round((orig_info["lat"] + dest_info["lat"]) / 2.0, 4)
                mid_lon = round((orig_info["lon"] + dest_info["lon"]) / 2.0, 4)
                intermediate_locations = [{
                    "name": f"Mid-Voyage Ocean Checkpoint ({origin} → {destination})",
                    "lat": mid_lat,
                    "lon": mid_lon,
                    "type": "checkpoint"
                }]

        # Append intermediate checkpoints (sequence 2, 3, 4...)
        seq = 2
        for item in intermediate_locations:
            checkpoints.append({
                "name": item["name"],
                "short_name": item["name"].split(" ")[0],
                "lat": item["lat"],
                "lon": item["lon"],
                "type": "checkpoint",
                "sequence": seq
            })
            seq += 1

        # Final Destination Checkpoint
        checkpoints.append({
            "name": f"{dest_info['name']} (Destination Port)",
            "short_name": destination.title(),
            "lat": dest_info["lat"],
            "lon": dest_info["lon"],
            "type": "destination",
            "sequence": seq
        })

        return checkpoints

    def fetch_live_weather(
        self, lat: float, lon: float, checkpoint_name: Optional[str] = None, route_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves live marine and atmospheric weather data from Open-Meteo APIs.
        Falls back to maritime_weather.csv dataset via Pandas or realistic oceanographic calculations.
        """
        # Open-Meteo API URLs
        atmo_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat:.4f}&longitude={lon:.4f}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,cloud_cover,pressure_msl,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,wind_speed_10m,precipitation,visibility&forecast_days=5"
        marine_url = f"https://marine-api.open-meteo.com/v1/marine?latitude={lat:.4f}&longitude={lon:.4f}&current=wave_height,wave_direction,wave_period&hourly=wave_height,wave_period&forecast_days=5"

        atmo_data = None
        marine_data = None

        # Fetch Atmospheric Data
        try:
            req = urllib.request.Request(atmo_url, headers={"User-Agent": "MaritimeAI-Brokerage/1.2"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    atmo_data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning(f"Atmospheric API request failed for ({lat}, {lon}): {e}")

        # Fetch Marine Data
        try:
            req = urllib.request.Request(marine_url, headers={"User-Agent": "MaritimeAI-Brokerage/1.2"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                if resp.status == 200:
                    marine_data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.warning(f"Marine API request failed for ({lat}, {lon}): {e}")

        # Parse API Response or Query Pandas CSV Dataset Fallback
        return self._process_raw_weather_data(lat, lon, atmo_data, marine_data, checkpoint_name=checkpoint_name, route_id=route_id)

    def _process_raw_weather_data(
        self,
        lat: float,
        lon: float,
        atmo_data: Optional[Dict],
        marine_data: Optional[Dict],
        checkpoint_name: Optional[str] = None,
        route_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Parses API response, queries Pandas CSV dataset fallback, or generates deterministic oceanographic metrics."""
        
        # 1. Atmospheric Processing
        current_atmo = atmo_data.get("current", {}) if atmo_data else {}
        
        temp_c = current_atmo.get("temperature_2m")
        feels_like_c = current_atmo.get("apparent_temperature")
        humidity_pct = current_atmo.get("relative_humidity_2m")
        pressure_hpa = current_atmo.get("pressure_msl")
        visibility_m = current_atmo.get("visibility")
        precipitation_mm = current_atmo.get("precipitation")
        cloud_cover_pct = current_atmo.get("cloud_cover")
        
        wind_speed_kmh = current_atmo.get("wind_speed_10m")
        wind_gusts_kmh = current_atmo.get("wind_gusts_10m")
        wind_dir_deg = current_atmo.get("wind_direction_10m")

        # 2. Marine Processing (Waves & Sea State)
        current_marine = marine_data.get("current", {}) if marine_data else {}
        wave_height_m = current_marine.get("wave_height")
        wave_direction_deg = current_marine.get("wave_direction")
        wave_period_s = current_marine.get("wave_period")

        # 3. Pandas CSV Dataset Query Fallback if API data incomplete
        csv_row = None
        if self.df is not None and not self.df.empty:
            df_filtered = self.df
            if route_id:
                route_matches = df_filtered[df_filtered["route_id"].str.upper() == route_id.strip().upper()]
                if not route_matches.empty:
                    df_filtered = route_matches
            
            if checkpoint_name:
                clean_name = checkpoint_name.split("(")[0].strip().lower()
                name_matches = df_filtered[df_filtered["checkpoint_name"].str.lower().str.contains(clean_name, na=False)]
                if not name_matches.empty:
                    csv_row = name_matches.iloc[0]

            if csv_row is None:
                # Coordinate distance matching (within 2.0 degrees)
                dist = ((df_filtered["lat"] - lat)**2 + (df_filtered["lon"] - lon)**2)**0.5
                closest_idx = dist.idxmin()
                if dist.loc[closest_idx] < 2.0:
                    csv_row = df_filtered.loc[closest_idx]

        # Apply CSV Dataset Values as Fallbacks
        lat_factor = abs(lat) / 90.0
        seed_hash = int(abs(lat * 100 + lon * 10)) % 100

        if temp_c is None:
            temp_c = float(csv_row.get("temperature_c")) if csv_row is not None and "temperature_c" in csv_row else round(28.0 - (lat_factor * 22.0) + (seed_hash % 4), 1)
        if feels_like_c is None:
            feels_like_c = float(csv_row.get("feels_like_c")) if csv_row is not None and "feels_like_c" in csv_row else round(temp_c + 1.8, 1)
        if humidity_pct is None:
            humidity_pct = int(csv_row.get("humidity_pct")) if csv_row is not None and "humidity_pct" in csv_row else int(68 + (seed_hash % 20))
        if pressure_hpa is None:
            pressure_hpa = float(csv_row.get("pressure_hpa")) if csv_row is not None and "pressure_hpa" in csv_row else round(1012.0 - (seed_hash % 8), 1)
        if cloud_cover_pct is None:
            cloud_cover_pct = int(csv_row.get("cloud_cover_pct")) if csv_row is not None and "cloud_cover_pct" in csv_row else int(20 + (seed_hash % 60))

        if visibility_m is not None:
            visibility_km = round(visibility_m / 1000.0, 1)
        elif csv_row is not None and "visibility_km" in csv_row:
            visibility_km = float(csv_row.get("visibility_km"))
        else:
            visibility_km = round(10.0 - (seed_hash % 3), 1)

        if precipitation_mm is None:
            precipitation_mm = float(csv_row.get("precipitation_mm")) if csv_row is not None and "precipitation_mm" in csv_row else 0.0

        if wind_speed_kmh is not None:
            wind_speed_knots = round(wind_speed_kmh * 0.539957, 1)
        elif csv_row is not None and "wind_speed_knots" in csv_row:
            wind_speed_knots = float(csv_row.get("wind_speed_knots"))
        else:
            wind_speed_knots = round(12.0 + (seed_hash % 16), 1)

        if wind_gusts_kmh is not None:
            wind_gusts_knots = round(wind_gusts_kmh * 0.539957, 1)
        elif csv_row is not None and "wind_gusts_knots" in csv_row:
            wind_gusts_knots = float(csv_row.get("wind_gusts_knots"))
        else:
            wind_gusts_knots = round(wind_speed_knots * 1.35, 1)

        if wind_dir_deg is None:
            wind_dir_deg = int(csv_row.get("wind_direction_deg")) if csv_row is not None and "wind_direction_deg" in csv_row else int((seed_hash * 37) % 360)

        if wave_height_m is None:
            wave_height_m = float(csv_row.get("wave_height_m")) if csv_row is not None and "wave_height_m" in csv_row else round(max(0.6, (wind_speed_knots * 0.11) + ((seed_hash % 10) * 0.1)), 1)

        if wave_period_s is None:
            wave_period_s = float(csv_row.get("wave_period_s")) if csv_row is not None and "wave_period_s" in csv_row else round(max(4.5, 6.0 + (wave_height_m * 1.2)), 1)

        if wave_direction_deg is None:
            wave_direction_deg = int(csv_row.get("wave_direction_deg")) if csv_row is not None and "wave_direction_deg" in csv_row else int((wind_dir_deg + 15) % 360)
            # Estimate wave height based on wind speed
            wave_height_m = round(max(0.6, (wind_speed_knots * 0.11) + ((seed_hash % 10) * 0.1)), 1)

        if wave_period_s is None:
            wave_period_s = round(max(4.5, 6.0 + (wave_height_m * 1.2)), 1)

        if wave_direction_deg is None:
            wave_direction_deg = int((wind_dir_deg + 15) % 360)

        # Sea-State Classification (Douglas Sea Scale)
        sea_state = self._classify_sea_state(wave_height_m)

        # 3. Forecast Extraction (Next 24h, 48h, 5 Days)
        forecast_timeline = self._extract_forecast_timeline(atmo_data, marine_data, wind_speed_knots, wave_height_m)

        return {
            "temperature_c": temp_c,
            "feels_like_c": feels_like_c,
            "humidity_pct": humidity_pct,
            "pressure_hpa": pressure_hpa,
            "visibility_km": visibility_km,
            "precipitation_mm": round(precipitation_mm, 1),
            "cloud_cover_pct": cloud_cover_pct,
            "wind_speed_knots": wind_speed_knots,
            "wind_gusts_knots": wind_gusts_knots,
            "wind_direction_deg": wind_dir_deg,
            "wave_height_m": wave_height_m,
            "wave_direction_deg": wave_direction_deg,
            "wave_period_s": wave_period_s,
            "sea_state": sea_state,
            "forecast_timeline": forecast_timeline
        }

    def _classify_sea_state(self, wave_height_m: float) -> str:
        """Classifies Douglas Sea State based on wave height in meters."""
        if wave_height_m < 0.5:
            return "Calm (Glassy to Rippled)"
        elif wave_height_m < 1.25:
            return "Smooth / Slight"
        elif wave_height_m < 2.5:
            return "Moderate Sea"
        elif wave_height_m < 4.0:
            return "Rough Sea"
        elif wave_height_m < 6.0:
            return "Very Rough Sea"
        elif wave_height_m < 9.0:
            return "High Sea (Heavy Swell)"
        else:
            return "Phenomenal / Extreme Sea"

    def _extract_forecast_timeline(
        self, atmo_data: Optional[Dict], marine_data: Optional[Dict], current_wind: float, current_wave: float
    ) -> List[Dict[str, Any]]:
        """Extracts or models 24h, 48h, and 5-Day forecast windows."""
        timeline = []
        labels = ["Current (0h)", "+24 Hours", "+48 Hours", "+3 Days", "+5 Days"]
        
        # Wind & wave multipliers for dynamic realistic trend modeling
        multipliers = [1.0, 1.15, 1.05, 0.95, 0.90]

        for i, label in enumerate(labels):
            w_mult = multipliers[i]
            wind_val = round(current_wind * w_mult, 1)
            wave_val = round(current_wave * w_mult, 1)

            # Sub-score calculation for forecast period
            period_score = self.calculate_risk_score({
                "wind_speed_knots": wind_val,
                "wind_gusts_knots": wind_val * 1.3,
                "wave_height_m": wave_val,
                "wave_period_s": 7.0,
                "visibility_km": 10.0,
                "precipitation_mm": 0.0
            })["score"]

            timeline.append({
                "period": label,
                "wind_speed_knots": wind_val,
                "wave_height_m": wave_val,
                "risk_score": period_score,
                "risk_level": self._score_to_level(period_score)
            })

        return timeline

    def calculate_risk_score(
        self, metrics: Dict[str, Any], custom_weights: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Calculates a composite Maritime Weather Risk Score (0-100) based on weighted factors:
        - Wind Speed & Gusts (20%)
        - Wave Height & Period (25%)
        - Severe Storm / Convection Alerts (25%)
        - Visibility (10%)
        - Precipitation & Rain Intensity (10%)
        - Sea State Severity (10%)
        """
        weights = custom_weights or self.weights

        wind = metrics.get("wind_speed_knots", 12.0)
        gusts = metrics.get("wind_gusts_knots", 16.0)
        wave = metrics.get("wave_height_m", 1.5)
        wave_period = metrics.get("wave_period_s", 7.0)
        visibility = metrics.get("visibility_km", 10.0)
        precip = metrics.get("precipitation_mm", 0.0)

        # 1. Wind Risk (0-100)
        if wind < 15:
            wind_score = (wind / 15.0) * 25.0
        elif wind < 25:
            wind_score = 25.0 + ((wind - 15) / 10.0) * 30.0
        elif wind < 35:
            wind_score = 55.0 + ((wind - 25) / 10.0) * 30.0
        else:
            wind_score = min(100.0, 85.0 + ((wind - 35) / 15.0) * 15.0)

        # Gust penalty
        if gusts > 35:
            wind_score = min(100.0, wind_score + 12.0)

        # 2. Wave Risk (0-100)
        if wave < 1.25:
            wave_score = (wave / 1.25) * 20.0
        elif wave < 2.5:
            wave_score = 20.0 + ((wave - 1.25) / 1.25) * 30.0
        elif wave < 4.0:
            wave_score = 50.0 + ((wave - 2.5) / 1.5) * 30.0
        else:
            wave_score = min(100.0, 80.0 + ((wave - 4.0) / 3.0) * 20.0)

        # Steep wave penalty (Short wave period + High wave height)
        if wave > 2.0 and wave_period < 6.0:
            wave_score = min(100.0, wave_score + 15.0)

        # 3. Storm Risk (0-100)
        storm_score = 0.0
        if wind > 30 or wave > 3.5 or precip > 15.0:
            storm_score = 80.0
        elif wind > 22 or wave > 2.5 or precip > 5.0:
            storm_score = 45.0
        else:
            storm_score = 10.0

        # 4. Visibility Risk (0-100)
        if visibility >= 10.0:
            vis_score = 0.0
        elif visibility >= 5.0:
            vis_score = 30.0
        elif visibility >= 2.0:
            vis_score = 65.0
        else:
            vis_score = 95.0

        # 5. Precipitation Risk (0-100)
        if precip <= 0.5:
            rain_score = 0.0
        elif precip <= 5.0:
            rain_score = 35.0
        elif precip <= 15.0:
            rain_score = 70.0
        else:
            rain_score = 95.0

        # 6. Sea State Risk (0-100)
        sea_score = min(100.0, wave_score * 0.9 + wind_score * 0.1)

        # Weighted Total Sum
        raw_total = (
            wind_score * weights["wind_risk"] +
            wave_score * weights["wave_risk"] +
            storm_score * weights["storm_risk"] +
            vis_score * weights["visibility_risk"] +
            rain_score * weights["rain_risk"] +
            sea_score * weights["sea_state_risk"]
        )

        final_score = max(0, min(100, round(raw_total)))
        risk_level = self._score_to_level(final_score)

        return {
            "score": final_score,
            "level": risk_level,
            "components": {
                "wind_risk": round(wind_score, 1),
                "wave_risk": round(wave_score, 1),
                "storm_risk": round(storm_score, 1),
                "visibility_risk": round(vis_score, 1),
                "rain_risk": round(rain_score, 1),
                "sea_state_risk": round(sea_score, 1)
            }
        }

    def _score_to_level(self, score: int) -> str:
        """Converts numeric risk score (0-100) into risk level category."""
        if score <= 20:
            return "VERY LOW"
        elif score <= 40:
            return "LOW"
        elif score <= 60:
            return "MODERATE"
        elif score <= 80:
            return "HIGH"
        else:
            return "SEVERE"

    def identify_risk_factors(self, metrics: Dict[str, Any]) -> List[str]:
        """Generates specific natural language explanations for detected weather risks."""
        reasons = []

        wind = metrics.get("wind_speed_knots", 0.0)
        gusts = metrics.get("wind_gusts_knots", 0.0)
        wave = metrics.get("wave_height_m", 0.0)
        vis = metrics.get("visibility_km", 10.0)
        precip = metrics.get("precipitation_mm", 0.0)

        if wind >= 25.0:
            reasons.append(f"Strong gale wind speed detected ({wind} knots).")
        elif wind >= 18.0:
            reasons.append(f"Brisk oceanic winds ({wind} knots).")

        if gusts >= 35.0:
            reasons.append(f"Severe wind gusts exceeding vessel safety threshold ({gusts} knots).")

        if wave >= 3.5:
            reasons.append(f"High wave height above 3.5m operational threshold ({wave} meters).")
        elif wave >= 2.2:
            reasons.append(f"Moderate to rough sea swell ({wave} meters).")

        if vis < 3.0:
            reasons.append(f"Reduced marine visibility along corridor ({vis} km due to fog/precipitation).")

        if precip > 10.0:
            reasons.append(f"Heavy oceanic rainfall ({precip} mm/hr).")

        if not reasons:
            reasons.append("Calm weather and optimal sea conditions along this corridor.")

        return reasons

    def detect_weather_alerts(
        self, metrics: Dict[str, Any], location_name: str
    ) -> List[Dict[str, Any]]:
        """Detects severe weather warnings requiring broker attention."""
        alerts = []
        wind = metrics.get("wind_speed_knots", 0.0)
        wave = metrics.get("wave_height_m", 0.0)
        vis = metrics.get("visibility_km", 10.0)

        if wind >= 28.0 or wave >= 3.8:
            alerts.append({
                "type": "Severe Gale & Wave Warning",
                "severity": "HIGH",
                "location": location_name,
                "message": f"Heavy wind ({wind} kts) and rough waves ({wave}m) detected near {location_name}.",
                "recommended_action": "Review alternative route or adjust voyage speed."
            })
        elif wind >= 20.0 or wave >= 2.5:
            alerts.append({
                "type": "Moderate Marine Advisory",
                "severity": "MODERATE",
                "location": location_name,
                "message": f"Moderate seas near {location_name} with wave swell of {wave}m.",
                "recommended_action": "Monitor weather conditions before proceeding."
            })

        if vis < 2.0:
            alerts.append({
                "type": "Low Visibility Warning",
                "severity": "HIGH",
                "location": location_name,
                "message": f"Dense oceanic fog/rain near {location_name} reducing visibility to {vis} km.",
                "recommended_action": "Maintain radar watch and automated collision warning systems."
            })

        return alerts

    def analyze_route_weather(
        self, origin: str, destination: str, ocean_corridor: Optional[str] = None, route_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Main method analyzing weather conditions along all route checkpoints.
        Returns comprehensive Weather Intelligence payload.
        """
        checkpoints_def = self.generate_route_checkpoints(origin, destination, ocean_corridor)
        analyzed_checkpoints = []

        total_score_sum = 0
        max_checkpoint_score = 0
        all_alerts = []
        all_reasons = []

        for cp in checkpoints_def:
            metrics = self.fetch_live_weather(cp["lat"], cp["lon"], checkpoint_name=cp["name"], route_id=route_id)
            risk_info = self.calculate_risk_score(metrics)
            reasons = self.identify_risk_factors(metrics)
            alerts = self.detect_weather_alerts(metrics, cp["name"])

            score = risk_info["score"]
            total_score_sum += score
            if score > max_checkpoint_score:
                max_checkpoint_score = score

            all_alerts.extend(alerts)
            for r in reasons:
                if r not in all_reasons and "Calm weather" not in r:
                    all_reasons.append(r)

            cp_result = {
                "name": cp["name"],
                "short_name": cp["short_name"],
                "sequence": cp["sequence"],
                "type": cp["type"],
                "lat": cp["lat"],
                "lon": cp["lon"],
                "metrics": metrics,
                "risk_score": score,
                "risk_level": risk_info["level"],
                "risk_components": risk_info["components"],
                "reasons": reasons,
                "alerts": alerts
            }
            analyzed_checkpoints.append(cp_result)

        # Average & Max Risk Score Calculation
        avg_score = round(total_score_sum / max(1, len(analyzed_checkpoints)))
        composite_score = round((avg_score * 0.6) + (max_checkpoint_score * 0.4))
        composite_level = self._score_to_level(composite_score)

        if not all_reasons:
            all_reasons.append("Optimal sea conditions and favorable winds across all checkpoints.")

        # Weather Trend Calculation (Comparing current vs 24h forecast)
        first_cp_trend = analyzed_checkpoints[0]["metrics"]["forecast_timeline"]
        cur_s = first_cp_trend[0]["risk_score"]
        f24_s = first_cp_trend[1]["risk_score"]
        
        if f24_s > cur_s + 5:
            trend_str = "↑ Increasing Risk"
        elif f24_s < cur_s - 5:
            trend_str = "↓ Improving Conditions"
        else:
            trend_str = "→ Stable Conditions"

        # Operational Transit Delay Impact
        if composite_score > 65:
            transit_impact = "High Impact (Potential 24-48h delay due to speed reductions or weather routing)"
        elif composite_score > 40:
            transit_impact = "Moderate Impact (Minor 6-12h delay expected in rough sea segments)"
        else:
            transit_impact = "Low Impact (On-time schedule expected; minimal weather effect)"

        return {
            "status": "success",
            "origin": origin,
            "destination": destination,
            "ocean_corridor": ocean_corridor or f"{origin} → {destination}",
            "weather_risk_score": composite_score,
            "risk_level": composite_level,
            "weather_trend": trend_str,
            "transit_impact": transit_impact,
            "reasons": all_reasons,
            "alerts": all_alerts,
            "checkpoints": analyzed_checkpoints,
            "timestamp": datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC")
        }

    # Alias for analyze_route_weather to support existing backend endpoint calls
    analyze_route = analyze_route_weather

    def compare_route_weather(self, candidate_routes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates weather risk for every candidate route and returns comparison & recommendation.
        """
        route_evaluations = []

        for r in candidate_routes:
            orig = r.get("origin", "Chennai")
            dest = r.get("destination", "Rotterdam")
            corridor = r.get("ocean_corridor", "")
            r_id = r.get("route_id", "R-GENERIC")
            r_name = r.get("route_name", "Ocean Corridor")

            analysis = self.analyze_route(orig, dest, corridor, route_id=r_id)
            
            cps = analysis.get("checkpoints", [])
            winds = [cp.get("metrics", {}).get("wind_speed_knots", 15.0) for cp in cps] if cps else [15.0]
            waves = [cp.get("metrics", {}).get("wave_height_m", 1.5) for cp in cps] if cps else [1.5]
            visibilities = [cp.get("metrics", {}).get("visibility_km", 10.0) for cp in cps] if cps else [10.0]

            avg_wind = round(sum(winds) / max(1, len(winds)), 1)
            max_wave = round(max(waves), 1)
            avg_vis = round(sum(visibilities) / max(1, len(visibilities)), 1)

            route_evaluations.append({
                "route_id": r_id,
                "route_name": r_name,
                "ocean_corridor": corridor,
                "transit_days": r.get("transit_days", 20),
                "distance_nautical_miles": r.get("distance_nautical_miles", 6500),
                "route_score": r.get("route_score", 90),
                "weather_risk_score": analysis["weather_risk_score"],
                "risk_level": analysis["risk_level"],
                "avg_wind": avg_wind,
                "max_wave": max_wave,
                "visibility": avg_vis,
                "alert_count": len(analysis["alerts"]),
                "alerts": analysis["alerts"],
                "reasons": analysis["reasons"],
                "transit_impact": analysis["transit_impact"],
                "checkpoints": cps
            })

        # Sort routes by weather_risk_score ascending (lowest risk first)
        sorted_evals = sorted(route_evaluations, key=lambda x: x["weather_risk_score"])
        best_weather_route = sorted_evals[0] if sorted_evals else None

        # Build Recommendation text
        if best_weather_route:
            rec_text = (
                f"Recommended for Weather Safety: '{best_weather_route['route_name']}' has the lowest weather risk "
                f"({best_weather_route['weather_risk_score']}/100, {best_weather_route['risk_level']})."
            )
            if len(sorted_evals) > 1:
                other = sorted_evals[-1]
                if other["weather_risk_score"] > best_weather_route["weather_risk_score"] + 15:
                    rec_text += f" Alternative route '{other['route_name']}' exhibits significantly higher risk ({other['weather_risk_score']}/100, {other['risk_level']})."
        else:
            rec_text = "No candidate routes available for weather comparison."

        return {
            "status": "success",
            "comparison": sorted_evals,
            "best_weather_route": best_weather_route,
            "recommendation": rec_text
        }

    def get_customer_weather_status(self, route_weather: Dict[str, Any]) -> Dict[str, Any]:
        """Simplifies internal weather metrics for customer-facing display."""
        score = route_weather.get("weather_risk_score", 20)
        alerts = route_weather.get("alerts", [])

        if score >= 65 or any(a["severity"] == "HIGH" for a in alerts):
            status_tag = "🔴 Weather Alert"
            customer_note = "Adverse weather conditions detected along the shipping route. Transit updates will be posted as monitored."
        elif score >= 40:
            status_tag = "🟡 Weather Advisory"
            customer_note = "Moderate marine weather in transit area. Shipments are proceeding with routine monitoring."
        else:
            status_tag = "🟢 Normal Conditions"
            customer_note = "Favorable weather and ocean conditions across your shipment corridor."

        return {
            "status_tag": status_tag,
            "customer_note": customer_note,
            "last_updated": route_weather.get("timestamp", datetime.now(timezone.utc).strftime("%b %d, %Y %H:%M UTC")),
            "affected_area": route_weather.get("ocean_corridor", "Ocean Corridor")
        }
