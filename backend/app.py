"""
AI Elderly Companion & Cognitive Monitor - Flask Application

A simple web app for caregivers to track daily observations about elderly loved ones
and receive AI-generated, non-diagnostic feedback.

IMPORTANT: This is NOT a medical device and does not diagnose any conditions.
"""
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging
from backend.config import config
from backend import db
from backend import ai_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, 
            template_folder='../templates',
            static_folder='../static')
app.config['SECRET_KEY'] = config.SECRET_KEY

# Enable CORS for development
CORS(app)


# =============================================================================
# Helper Functions
# =============================================================================

def validate_profile_data(data: dict) -> tuple:
    """
    Validate profile data from request.
    Returns (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Invalid request body"
    
    # Age validation (if provided)
    if data.get("age") is not None:
        try:
            age = int(data["age"])
            if age <= 0 or age > 150:
                return False, "Age must be a positive number between 1 and 150"
        except (ValueError, TypeError):
            return False, "Age must be a valid number"
    
    # Education years validation (if provided)
    if data.get("education_years") is not None and data.get("education_years") != "":
        try:
            years = int(data["education_years"])
            if years < 0 or years > 30:
                return False, "Education years must be between 0 and 30"
        except (ValueError, TypeError):
            return False, "Education years must be a valid number"
    
    return True, None


def validate_checkin_data(data: dict) -> tuple:
    """
    Validate check-in data from request.
    Returns (is_valid, error_message)
    """
    if not isinstance(data, dict):
        return False, "Invalid request body"
    
    # Required fields
    required_fields = ["date", "memory_score", "orientation_score", "activities_score", "mood"]
    
    for field in required_fields:
        if field not in data or data[field] is None or data[field] == "":
            return False, f"Missing required field: {field}"
    
    # Date validation
    date = data.get("date", "")
    if not date or len(date) != 10:  # YYYY-MM-DD format
        return False, "Invalid date format. Use YYYY-MM-DD"
    
    # Score validations (1-5 range)
    score_fields = ["memory_score", "orientation_score", "activities_score"]
    for field in score_fields:
        try:
            score = int(data[field])
            if score < 1 or score > 5:
                return False, f"{field} must be between 1 and 5"
        except (ValueError, TypeError):
            return False, f"{field} must be a valid number between 1 and 5"
    
    # Mood validation
    valid_moods = ["Good", "OK", "Low"]
    if data.get("mood") not in valid_moods:
        return False, f"Mood must be one of: {', '.join(valid_moods)}"
    
    return True, None


# =============================================================================
# Routes - Pages
# =============================================================================

@app.route("/")
def index():
    """Serve the main application page."""
    return render_template("index.html")


# =============================================================================
# Routes - Profile API
# =============================================================================

@app.route("/api/profile", methods=["GET"])
def get_profile():
    """
    Get the elder's profile.
    Returns the profile if it exists, or a default blank profile.
    """
    try:
        profile = db.get_profile()
        
        if profile:
            return jsonify({
                "success": True,
                "profile": profile
            })
        else:
            # Return a default blank profile structure
            return jsonify({
                "success": True,
                "profile": {
                    "_id": None,
                    "name": "",
                    "age": None,
                    "education_years": None,
                    "diagnosis_notes": "",
                    "created_at": None,
                    "updated_at": None
                }
            })
    
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve profile"
        }), 500


@app.route("/api/profile", methods=["PUT"])
def update_profile():
    """
    Create or update the elder's profile.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400
        
        # Validate data
        is_valid, error_msg = validate_profile_data(data)
        if not is_valid:
            return jsonify({
                "success": False,
                "error": error_msg
            }), 400
        
        # Clean up the data
        clean_data = {
            "name": data.get("name", "").strip(),
            "age": int(data["age"]) if data.get("age") else None,
            "education_years": int(data["education_years"]) if data.get("education_years") else None,
            "diagnosis_notes": data.get("diagnosis_notes", "").strip() if data.get("diagnosis_notes") else None
        }
        
        # Save to database
        profile = db.upsert_profile(clean_data)
        
        return jsonify({
            "success": True,
            "profile": profile
        })
    
    except Exception as e:
        logger.error(f"Error updating profile: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to save profile"
        }), 500


# =============================================================================
# Routes - Check-ins API
# =============================================================================

@app.route("/api/checkins", methods=["GET"])
def get_checkins():
    """
    Get recent check-ins (most recent first).
    """
    try:
        limit = request.args.get("limit", 20, type=int)
        limit = min(max(limit, 1), 50)  # Clamp between 1 and 50
        
        checkins = db.get_checkins(limit=limit)
        
        return jsonify({
            "success": True,
            "checkins": checkins
        })
    
    except Exception as e:
        logger.error(f"Error getting checkins: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve check-ins"
        }), 500


@app.route("/api/checkins/<checkin_id>", methods=["GET"])
def get_checkin(checkin_id: str):
    """
    Get a single check-in by ID.
    """
    try:
        checkin = db.get_checkin_by_id(checkin_id)
        
        if checkin:
            return jsonify({
                "success": True,
                "checkin": checkin
            })
        else:
            return jsonify({
                "success": False,
                "error": "Not found"
            }), 404
    
    except Exception as e:
        logger.error(f"Error getting checkin {checkin_id}: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve check-in"
        }), 500


@app.route("/api/checkins", methods=["POST"])
def create_checkin():
    """
    Create a new check-in and generate AI feedback.
    
    The check-in is saved first, then AI feedback is generated.
    Even if AI fails, the check-in data is preserved.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400
        
        # Validate data
        is_valid, error_msg = validate_checkin_data(data)
        if not is_valid:
            return jsonify({
                "success": False,
                "error": error_msg
            }), 400
        
        # Clean up the data
        clean_data = {
            "date": data["date"],
            "memory_score": int(data["memory_score"]),
            "orientation_score": int(data["orientation_score"]),
            "activities_score": int(data["activities_score"]),
            "mood": data["mood"],
            "notes": data.get("notes", "").strip() if data.get("notes") else ""
        }
        
        # Step 1: Save check-in to database (with ai_status = "pending")
        checkin = db.create_checkin(clean_data)
        checkin_id = checkin["_id"]
        
        logger.info(f"Created check-in {checkin_id}, now generating AI feedback...")
        
        # Step 2: Generate AI feedback
        try:
            # Get recent check-ins for context (excluding the current one)
            recent_checkins = db.get_recent_checkins_for_context(limit=5)
            
            # Generate AI feedback
            ai_result = ai_client.generate_checkin_feedback(clean_data, recent_checkins)
            
            # Update check-in with AI results
            updated_checkin = db.update_checkin_ai_fields(checkin_id, ai_result)
            
            if updated_checkin:
                checkin = updated_checkin
            
            logger.info(f"AI feedback generated for check-in {checkin_id}: status={ai_result.get('status')}")
        
        except Exception as ai_error:
            # AI failed but check-in is still saved
            logger.error(f"AI feedback generation failed: {ai_error}")
            
            # Update with error status
            error_data = {
                "risk_level": None,
                "summary": "AI feedback is temporarily unavailable due to a technical issue.",
                "suggestions": ["Please try again later or consult a healthcare professional if you are worried."],
                "disclaimer": "This feedback is for informational purposes only and is not a medical diagnosis. Please consult a licensed healthcare professional for any concerns.",
                "status": "error",
                "error_message": str(ai_error)[:200]
            }
            
            updated_checkin = db.update_checkin_ai_fields(checkin_id, error_data)
            if updated_checkin:
                checkin = updated_checkin
        
        return jsonify({
            "success": True,
            "checkin": checkin
        }), 201
    
    except Exception as e:
        logger.error(f"Error creating checkin: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to create check-in"
        }), 500


# =============================================================================
# Error Handlers
# =============================================================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        "success": False,
        "error": "Resource not found"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    logger.info("Starting Elderly Companion application...")
    logger.info(f"OpenAI configured: {config.is_openai_configured()}")
    
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=config.DEBUG
    )
