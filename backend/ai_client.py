"""
AI client for generating feedback on check-ins using OpenAI's gpt-3.5-turbo.
"""
import json
import logging
from typing import Dict, Any, List, Optional
from openai import OpenAI
from backend.config import config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default disclaimer text
DEFAULT_DISCLAIMER = (
    "This feedback is for informational purposes only and is not a medical diagnosis. "
    "Please consult a licensed healthcare professional for any concerns."
)


def get_openai_client() -> Optional[OpenAI]:
    """
    Get OpenAI client if API key is configured.
    Returns None if not configured.
    """
    if not config.is_openai_configured():
        return None
    
    return OpenAI(api_key=config.OPENAI_API_KEY)


def build_ai_prompt(checkin: Dict[str, Any], recent_checkins: Optional[List[Dict[str, Any]]] = None) -> str:
    """
    Build the prompt for the AI model.
    """
    # Build recent history context if available
    history_context = ""
    if recent_checkins and len(recent_checkins) > 0:
        history_lines = []
        for i, rc in enumerate(recent_checkins[:5], 1):
            history_lines.append(
                f"  {i}. Date: {rc.get('date', 'N/A')}, "
                f"Memory: {rc.get('memory_score', 'N/A')}/5, "
                f"Orientation: {rc.get('orientation_score', 'N/A')}/5, "
                f"Activities: {rc.get('activities_score', 'N/A')}/5, "
                f"Mood: {rc.get('mood', 'N/A')}"
            )
            if rc.get('notes'):
                history_lines.append(f"     Notes: {rc['notes']}")
        history_context = "\n\nRecent check-in history (most recent first):\n" + "\n".join(history_lines)
    
    prompt = f"""You are a caring, non-diagnostic assistant helping family caregivers track daily observations about an elderly loved one. You provide supportive, practical feedback but NEVER diagnose medical conditions.

SCORING GUIDE (1-5 scale):
- 1 = Much worse than usual
- 2 = Somewhat worse than usual  
- 3 = About usual/typical
- 4 = Somewhat better than usual
- 5 = Much better than usual

TODAY'S CHECK-IN:
- Date: {checkin.get('date', 'Not provided')}
- Memory Score: {checkin.get('memory_score', 'N/A')}/5
- Orientation (time/place) Score: {checkin.get('orientation_score', 'N/A')}/5  
- Daily Activities Score: {checkin.get('activities_score', 'N/A')}/5
- Mood: {checkin.get('mood', 'N/A')}
- Notes: {checkin.get('notes', 'None provided')}
{history_context}

CLASSIFICATION GUIDELINES:
- "Low" risk: Scores are mostly stable or higher (3-5), notes describe minor or infrequent issues
- "Monitor" risk: Some lower scores (2-3) or variable pattern, occasional forgetfulness or confusion
- "Concerning" risk: Very low scores (1-2) especially on memory/orientation, significant confusion, safety issues, or repeated concerning events

Provide your response in the following JSON format ONLY (no other text):
{{
    "risk_level": "Low" or "Monitor" or "Concerning",
    "summary": "2-4 sentences summarizing today's observations in plain, friendly language. Mention if today differs from recent patterns.",
    "suggestions": [
        "First practical, non-medical suggestion",
        "Second practical suggestion",
        "Third suggestion if warranted"
    ]
}}

Remember: Be supportive and practical. Do NOT diagnose any medical conditions. Focus on caregiving tips and when to consult professionals."""

    return prompt


def parse_ai_response(response_text: str) -> Dict[str, Any]:
    """
    Parse the AI response text into structured data.
    """
    try:
        # Try to parse as JSON
        data = json.loads(response_text)
        
        # Validate and extract fields
        risk_level = data.get("risk_level", "Monitor")
        if risk_level not in ["Low", "Monitor", "Concerning"]:
            risk_level = "Monitor"
        
        summary = data.get("summary", "Unable to generate summary.")
        
        suggestions = data.get("suggestions", [])
        if not isinstance(suggestions, list):
            suggestions = [str(suggestions)]
        
        # Ensure 2-3 suggestions
        if len(suggestions) < 2:
            suggestions.append("Keep notes of any changes to discuss with a healthcare provider.")
        if len(suggestions) > 3:
            suggestions = suggestions[:3]
        
        return {
            "risk_level": risk_level,
            "summary": summary,
            "suggestions": suggestions,
            "disclaimer": DEFAULT_DISCLAIMER,
            "status": "ok",
            "error_message": None
        }
    
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        # Try to extract information from non-JSON response
        return {
            "risk_level": "Monitor",
            "summary": response_text[:500] if response_text else "Unable to process AI response.",
            "suggestions": [
                "Continue monitoring and keeping notes.",
                "Consult a healthcare professional if you have concerns."
            ],
            "disclaimer": DEFAULT_DISCLAIMER,
            "status": "ok",
            "error_message": None
        }


def generate_checkin_feedback(
    checkin: Dict[str, Any],
    recent_checkins: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Generate AI feedback for a check-in.
    
    Args:
        checkin: The current check-in data
        recent_checkins: Optional list of recent check-ins for context
    
    Returns:
        Dictionary with AI feedback fields including status
    """
    
    # Check if OpenAI is configured
    if not config.is_openai_configured():
        logger.warning("OpenAI API key not configured. Returning fallback response.")
        return {
            "risk_level": None,
            "summary": "AI feedback is not configured. Please set OPENAI_API_KEY environment variable to enable AI-powered analysis.",
            "suggestions": [
                "Please try again later or consult a healthcare professional if you are worried."
            ],
            "disclaimer": DEFAULT_DISCLAIMER,
            "status": "error",
            "error_message": "OpenAI API key not configured"
        }
    
    try:
        client = get_openai_client()
        if client is None:
            raise ValueError("Failed to initialize OpenAI client")
        
        prompt = build_ai_prompt(checkin, recent_checkins)
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful, caring assistant for family caregivers. You provide supportive, practical feedback but never diagnose medical conditions. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        # Extract response content
        ai_content = response.choices[0].message.content.strip()
        logger.info(f"AI response received: {ai_content[:200]}...")
        
        # Parse and return structured response
        return parse_ai_response(ai_content)
    
    except Exception as e:
        error_msg = str(e)
        # Sanitize error message (remove any API keys if present)
        if "api_key" in error_msg.lower():
            error_msg = "API authentication error"
        
        logger.error(f"OpenAI API call failed: {error_msg}")
        
        return {
            "risk_level": None,
            "summary": "AI feedback is temporarily unavailable due to a technical issue.",
            "suggestions": [
                "Please try again later or consult a healthcare professional if you are worried."
            ],
            "disclaimer": DEFAULT_DISCLAIMER,
            "status": "error",
            "error_message": error_msg[:200]  # Limit error message length
        }
