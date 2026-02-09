"""
AI Classification Service for CivicSense
Uses Anthropic Claude API for issue classification
"""
import os
import json
import logging
from typing import Optional

import anthropic

from ..models import AIClassificationResponse, Location, TweetParseResult
from ..database import get_database

logger = logging.getLogger(__name__)

# System prompt for issue classification
CLASSIFICATION_SYSTEM_PROMPT = """You are an expert in classifying civic issues in Indian cities.
Your job is to categorize citizen complaints and suggest which government department/official should handle them.

Categories available:
- roads: Potholes, road damage, street lights, traffic signals
- sanitation: Garbage, sewage, drains, cleanliness
- water: Water supply, leakage, contamination
- electricity: Power cuts, streetlights, illegal connections
- encroachment: Illegal construction, footpath blocking
- parks: Park maintenance, playground issues
- public_safety: Crime, harassment, safety concerns
- health: Hospital issues, epidemic concerns
- education: School issues, mid-day meals
- transport: Bus, metro, auto-rickshaw issues
- housing: Building permissions, slum issues
- general: Other issues

Government hierarchy (from local to national):
1. Parshad (Ward Councillor) - Local ward issues
2. MCD (Municipal Corporation) - City level civic issues
3. IAS Officers - Administrative issues
4. MLA (Member of Legislative Assembly) - Constituency level
5. MP (Member of Parliament) - Parliamentary constituency
6. CM (Chief Minister) - State level issues
7. PM (Prime Minister) - National level issues

Respond ONLY with valid JSON in this exact format:
{
    "category": "category_name",
    "sub_category": "optional_sub_category_or_null",
    "suggested_hierarchy_levels": [1, 2],
    "confidence": 0.95
}"""


def get_anthropic_client() -> Optional[anthropic.Anthropic]:
    """Get Anthropic client if API key is configured"""
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return None
    return anthropic.Anthropic(api_key=api_key)


async def classify_issue_with_ai(
    title: str,
    description: str,
    location: Optional[Location] = None
) -> AIClassificationResponse:
    """Use AI to classify the civic issue using Anthropic Claude"""
    try:
        client = get_anthropic_client()
        if not client:
            logger.warning("ANTHROPIC_API_KEY not found, returning default classification")
            return AIClassificationResponse(category="general", confidence=0.5)

        # Build user message
        location_str = ""
        if location:
            location_str = f"\nLocation: {location.area or ''}, {location.city}"

        user_message = f"Classify this civic issue:\nTitle: {title}\nDescription: {description}{location_str}\n\nRespond with JSON only."

        # Get model from env or use default
        model = os.environ.get('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

        # Call Anthropic API
        response = client.messages.create(
            model=model,
            max_tokens=200,
            system=CLASSIFICATION_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )

        # Extract response text
        response_text = response.content[0].text.strip()

        # Parse JSON response
        try:
            # Handle potential markdown code blocks
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            result = json.loads(response_text)

            # Get suggested officials from database
            suggested_officials = []
            hierarchy_levels = result.get('suggested_hierarchy_levels', [1, 2])

            # Ensure hierarchy_levels is a list
            if isinstance(hierarchy_levels, int):
                hierarchy_levels = [hierarchy_levels]

            # Find officials matching the hierarchy
            db = get_database()
            officials_cursor = db.govt_officials.find({
                "hierarchy_level": {"$in": hierarchy_levels},
                "is_active": True
            }).limit(5)

            async for official in officials_cursor:
                suggested_officials.append({
                    "id": official.get('_id') or official.get('id'),
                    "name": official['name'],
                    "designation": official['designation'],
                    "department": official['department']
                })

            return AIClassificationResponse(
                category=result.get('category', 'general'),
                sub_category=result.get('sub_category'),
                suggested_officials=suggested_officials,
                confidence=result.get('confidence', 0.8)
            )

        except json.JSONDecodeError:
            logger.error(f"Failed to parse AI response: {response_text}")
            return AIClassificationResponse(category="general", confidence=0.5)

    except Exception as e:
        logger.error(f"AI classification error: {str(e)}")
        return AIClassificationResponse(category="general", confidence=0.5)


async def generate_issue_description(
    title: str,
    category: str,
    location: Optional[Location] = None
) -> Optional[str]:
    """Generate a detailed description for an issue based on title and category"""
    try:
        client = get_anthropic_client()
        if not client:
            return None

        location_str = ""
        if location:
            location_str = f" in {location.area or location.city}"

        prompt = f"""Based on the following civic issue title, generate a brief but detailed description (2-3 sentences) that a citizen might write when reporting this issue.

Title: {title}
Category: {category}
Location: {location_str}

Write a realistic, helpful description that includes relevant details about the issue."""

        model = os.environ.get('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

        response = client.messages.create(
            model=model,
            max_tokens=150,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        return response.content[0].text.strip()

    except Exception as e:
        logger.error(f"Description generation error: {str(e)}")
        return None


# System prompt for parsing tweets into civic issues
TWEET_PARSE_SYSTEM_PROMPT = """You are an expert at analyzing tweets about civic issues in Indian cities, especially Delhi.
Your job is to determine if a tweet is reporting a civic issue and extract structured data from it.

A civic issue is a problem with public infrastructure, services, or safety that a government body should address.
Examples: potholes, garbage, water leaks, broken streetlights, illegal encroachment, etc.
NOT civic issues: personal opinions, jokes, questions about CivicSense, general conversation, political commentary without a specific issue.

Categories available:
- roads: Potholes, road damage, street lights, traffic signals
- sanitation: Garbage, sewage, drains, cleanliness
- water: Water supply, leakage, contamination
- electricity: Power cuts, streetlights, illegal connections
- encroachment: Illegal construction, footpath blocking
- parks: Park maintenance, playground issues
- public_safety: Crime, harassment, safety concerns
- health: Hospital issues, epidemic concerns
- education: School issues, mid-day meals
- transport: Bus, metro, auto-rickshaw issues
- housing: Building permissions, slum issues
- general: Other issues

Respond ONLY with valid JSON in this exact format:
{
    "is_civic_issue": true,
    "title": "Short descriptive title (max 100 chars)",
    "description": "Expanded 2-3 sentence description of the issue",
    "category": "category_name",
    "sub_category": null,
    "area": "Extracted area/landmark or null if not mentioned",
    "city": "Delhi",
    "confidence": 0.85
}

If the tweet is NOT a civic issue, respond with:
{
    "is_civic_issue": false,
    "title": "",
    "description": "",
    "category": "general",
    "sub_category": null,
    "area": null,
    "city": "Delhi",
    "confidence": 0.0
}"""


async def parse_tweet_to_issue(tweet_text: str, author_handle: str) -> TweetParseResult:
    """Use AI to parse a tweet into structured issue data"""
    try:
        client = get_anthropic_client()
        if not client:
            logger.warning("ANTHROPIC_API_KEY not found, cannot parse tweet")
            return TweetParseResult(is_civic_issue=False)

        # Strip the @CivicSupportIN mention from the tweet for cleaner parsing
        cleaned_text = tweet_text.replace("@CivicSupportIN", "").strip()

        user_message = f"Tweet by @{author_handle}:\n\"{cleaned_text}\"\n\nAnalyze this tweet and respond with JSON only."

        model = os.environ.get('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

        response = client.messages.create(
            model=model,
            max_tokens=300,
            system=TWEET_PARSE_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )

        response_text = response.content[0].text.strip()

        # Handle markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        result = json.loads(response_text)

        return TweetParseResult(
            is_civic_issue=result.get('is_civic_issue', False),
            title=result.get('title', ''),
            description=result.get('description', ''),
            category=result.get('category', 'general'),
            sub_category=result.get('sub_category'),
            area=result.get('area'),
            city=result.get('city', 'Delhi'),
            confidence=result.get('confidence', 0.0)
        )

    except json.JSONDecodeError:
        logger.error(f"Failed to parse tweet AI response for tweet: {tweet_text[:100]}")
        return TweetParseResult(is_civic_issue=False)
    except Exception as e:
        logger.error(f"Tweet parsing error: {str(e)}")
        return TweetParseResult(is_civic_issue=False)
