"""
Tweet parsing and location extraction logic
Extracts issue information from tweets including title, description, and location
"""
import re
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ParsedTweet:
    """Parsed tweet ready for issue creation"""
    title: str
    description: str
    extracted_location: Optional[str] = None
    extracted_city: Optional[str] = None
    hashtags: List[str] = None
    has_geotag: bool = False
    geotag_coords: Optional[Tuple[float, float]] = None  # (latitude, longitude)
    media_urls: List[str] = None
    location_confidence: str = "none"  # "high", "medium", "low", "none"

    def __post_init__(self):
        if self.hashtags is None:
            self.hashtags = []
        if self.media_urls is None:
            self.media_urls = []


class TweetParser:
    """Extracts issue information from tweets"""

    # Indian city patterns
    INDIAN_CITIES = {
        "delhi": ("Delhi", 28.6139, 77.2090),
        "new delhi": ("Delhi", 28.6139, 77.2090),
        "mumbai": ("Mumbai", 19.0760, 72.8777),
        "bombay": ("Mumbai", 19.0760, 72.8777),
        "bangalore": ("Bangalore", 12.9716, 77.5946),
        "bengaluru": ("Bangalore", 12.9716, 77.5946),
        "chennai": ("Chennai", 13.0827, 80.2707),
        "madras": ("Chennai", 13.0827, 80.2707),
        "kolkata": ("Kolkata", 22.5726, 88.3639),
        "calcutta": ("Kolkata", 22.5726, 88.3639),
        "hyderabad": ("Hyderabad", 17.3850, 78.4867),
        "pune": ("Pune", 18.5204, 73.8567),
        "ahmedabad": ("Ahmedabad", 23.0225, 72.5714),
        "jaipur": ("Jaipur", 26.9124, 75.7873),
        "lucknow": ("Lucknow", 26.8467, 80.9462),
        "chandigarh": ("Chandigarh", 30.7333, 76.7794),
        "noida": ("Noida", 28.5355, 77.3910),
        "gurgaon": ("Gurgaon", 28.4595, 77.0266),
        "gurugram": ("Gurgaon", 28.4595, 77.0266),
        "faridabad": ("Faridabad", 28.4089, 77.3178),
        "ghaziabad": ("Ghaziabad", 28.6692, 77.4538),
    }

    # Location extraction patterns
    LOCATION_PATTERNS = [
        # "near X", "at X", "in X" patterns
        r"(?:near|at|in|from|around)\s+([A-Za-z][A-Za-z\s,]+?)(?:\.|,|!|\?|$|\s+(?:road|sector|area|colony))",
        # Sector pattern (common in Delhi NCR)
        r"(?:sector|sec)[\s\-]*(\d+[A-Za-z]?(?:\s*,\s*[A-Za-z]+)?)",
        # Road/Street patterns
        r"([A-Za-z\s]+(?:Road|Street|Marg|Chowk|Circle|Flyover|Bridge))",
        # Colony/Area patterns
        r"([A-Za-z\s]+(?:Colony|Nagar|Enclave|Vihar|Park|Extension|Phase|Block))",
        # Ward pattern
        r"ward[\s\-]*(?:no\.?\s*)?(\d+[A-Za-z]?)",
    ]

    # Hashtag location patterns
    HASHTAG_LOCATION_PATTERNS = [
        r"#([A-Za-z]+)(?:roads?|traffic|issues?|problems?)?$",
    ]

    def parse_tweet(
        self,
        tweet_text: str,
        tweet_data: Dict,
        user_data: Dict,
        media_data: Optional[List[Dict]] = None
    ) -> ParsedTweet:
        """
        Parse a tweet into issue-ready format

        Args:
            tweet_text: Raw tweet text
            tweet_data: Full tweet data from Twitter API
            user_data: User data from includes
            media_data: Media data from includes

        Returns:
            ParsedTweet with extracted information
        """
        # Clean tweet text (remove @mentions at start)
        clean_text = self._clean_tweet_text(tweet_text)

        # Extract title (first sentence or first 100 chars)
        title = self._extract_title(clean_text)

        # Full description is the cleaned text
        description = clean_text if clean_text else tweet_text

        # Extract hashtags
        hashtags = self._extract_hashtags(tweet_data)

        # Extract location using multiple strategies
        location_result = self._extract_location_multi_strategy(
            clean_text, tweet_data, hashtags
        )

        # Get media URLs
        media_urls = self._extract_media_urls(media_data)

        return ParsedTweet(
            title=title,
            description=description,
            extracted_location=location_result["location"],
            extracted_city=location_result["city"],
            hashtags=hashtags,
            has_geotag=location_result["has_geotag"],
            geotag_coords=location_result["coords"],
            media_urls=media_urls,
            location_confidence=location_result["confidence"]
        )

    def _clean_tweet_text(self, text: str) -> str:
        """Remove @mentions at start and clean up text"""
        # Remove leading mentions (like @CivicSenseIndia)
        text = re.sub(r"^(@\w+\s*)+", "", text).strip()
        # Remove URLs
        text = re.sub(r"https?://\S+", "", text).strip()
        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _extract_title(self, text: str) -> str:
        """Extract a title from tweet text (first sentence or truncated)"""
        if not text:
            return "Issue reported via Twitter"

        # Try to get first sentence
        sentences = re.split(r'[.!?]\s', text)
        if sentences and sentences[0]:
            title = sentences[0][:100]
            if len(sentences[0]) > 100:
                # Truncate at word boundary
                title = title.rsplit(' ', 1)[0] + "..."
            return title

        # Fallback to first 100 chars
        if len(text) > 100:
            return text[:97].rsplit(' ', 1)[0] + "..."
        return text

    def _extract_hashtags(self, tweet_data: Dict) -> List[str]:
        """Extract hashtags from tweet entities"""
        hashtags = []
        entities = tweet_data.get("entities", {})
        if entities.get("hashtags"):
            hashtags = [h.get("tag", "") for h in entities["hashtags"] if h.get("tag")]
        return hashtags

    def _extract_media_urls(self, media_data: Optional[List[Dict]]) -> List[str]:
        """Extract media URLs from tweet media data"""
        media_urls = []
        if media_data:
            for media in media_data:
                # Prefer full URL, fall back to preview
                if media.get("url"):
                    media_urls.append(media["url"])
                elif media.get("preview_image_url"):
                    media_urls.append(media["preview_image_url"])
        return media_urls

    def _extract_location_multi_strategy(
        self,
        clean_text: str,
        tweet_data: Dict,
        hashtags: List[str]
    ) -> Dict:
        """
        Extract location using multiple strategies in priority order:
        1. Twitter geotag (highest confidence)
        2. Text extraction patterns
        3. Hashtag-based city detection
        4. City mentions in text

        Returns:
            Dict with location, city, has_geotag, coords, confidence
        """
        result = {
            "location": None,
            "city": None,
            "has_geotag": False,
            "coords": None,
            "confidence": "none"
        }

        # Strategy 1: Twitter Geotag (highest confidence)
        geo = tweet_data.get("geo")
        if geo:
            if geo.get("coordinates"):
                coords = geo["coordinates"].get("coordinates", [])
                if len(coords) >= 2:
                    # Twitter returns [longitude, latitude]
                    result["has_geotag"] = True
                    result["coords"] = (coords[1], coords[0])  # (lat, lng)
                    result["confidence"] = "high"
                    logger.debug(f"Found geotag: {result['coords']}")

            # Also check for place name
            if geo.get("place_id"):
                place = tweet_data.get("includes", {}).get("places", [])
                if place:
                    result["location"] = place[0].get("full_name")

        # Strategy 2: Text extraction patterns
        if not result["location"]:
            for pattern in self.LOCATION_PATTERNS:
                match = re.search(pattern, clean_text, re.IGNORECASE)
                if match:
                    location = match.group(1).strip()
                    # Clean up the location
                    location = re.sub(r"\s+", " ", location).strip(" ,.")
                    if len(location) >= 3:  # Minimum meaningful location
                        result["location"] = location
                        if result["confidence"] == "none":
                            result["confidence"] = "medium"
                        logger.debug(f"Extracted location from text: {location}")
                        break

        # Strategy 3: Check hashtags for city names
        text_lower = clean_text.lower()
        for hashtag in hashtags:
            hashtag_lower = hashtag.lower()
            if hashtag_lower in self.INDIAN_CITIES:
                city_info = self.INDIAN_CITIES[hashtag_lower]
                result["city"] = city_info[0]
                if not result["coords"]:
                    result["coords"] = (city_info[1], city_info[2])
                if result["confidence"] == "none":
                    result["confidence"] = "low"
                logger.debug(f"Found city in hashtag: {city_info[0]}")
                break

        # Strategy 4: Check text for city mentions
        if not result["city"]:
            for city_key, city_info in self.INDIAN_CITIES.items():
                if city_key in text_lower:
                    result["city"] = city_info[0]
                    if not result["coords"]:
                        result["coords"] = (city_info[1], city_info[2])
                    if result["confidence"] == "none":
                        result["confidence"] = "low"
                    logger.debug(f"Found city in text: {city_info[0]}")
                    break

        return result

    def suggest_category_from_text(self, text: str) -> Optional[str]:
        """
        Suggest a category based on keywords in the text
        This is a preliminary hint before AI classification
        """
        text_lower = text.lower()

        category_keywords = {
            "roads": ["pothole", "road", "street", "footpath", "pavement", "broken road", "damaged road"],
            "sanitation": ["garbage", "trash", "waste", "dump", "dirty", "filth", "litter", "garbage dump"],
            "water": ["water", "pipeline", "leak", "supply", "tanker", "sewage", "drain", "waterlogging"],
            "electricity": ["power", "electricity", "light", "streetlight", "outage", "blackout", "power cut"],
            "traffic": ["traffic", "signal", "jam", "congestion", "parking"],
            "public_safety": ["crime", "theft", "harassment", "unsafe", "danger", "police", "eve teasing"],
            "encroachment": ["encroach", "illegal", "occupy", "hawker", "vendor"],
            "parks": ["park", "garden", "playground", "green", "tree"],
            "health": ["hospital", "clinic", "medical", "disease", "epidemic"],
            "transport": ["bus", "metro", "auto", "rickshaw", "cab"],
        }

        for category, keywords in category_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return category

        return None
