"""
MongoDB database connection and helper functions.
"""
from pymongo import MongoClient, DESCENDING
from bson import ObjectId
from datetime import datetime
from typing import Optional, Dict, Any, List
from backend.config import config


# Global MongoDB client instance
_client: Optional[MongoClient] = None
_db = None


def get_db():
    """
    Get the MongoDB database instance.
    Creates a connection if one doesn't exist.
    """
    global _client, _db
    
    if _db is None:
        _client = MongoClient(config.MONGO_URI)
        _db = _client[config.DATABASE_NAME]
    
    return _db


def get_profile_collection():
    """Get the profile collection."""
    return get_db()["profile"]


def get_checkins_collection():
    """Get the checkins collection."""
    return get_db()["checkins"]


def serialize_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a MongoDB document to a JSON-serializable dictionary.
    
    - Converts ObjectId to string
    - Converts datetime objects to ISO format strings
    """
    if doc is None:
        return None
    
    result = dict(doc)
    
    # Convert ObjectId to string
    if "_id" in result and isinstance(result["_id"], ObjectId):
        result["_id"] = str(result["_id"])
    
    # Convert datetime fields to ISO strings
    datetime_fields = ["created_at", "updated_at"]
    for field in datetime_fields:
        if field in result and isinstance(result[field], datetime):
            result["created_at" if field == "created_at" else field] = result[field].isoformat() + "Z"
    
    return result


def serialize_documents(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Serialize a list of MongoDB documents."""
    return [serialize_document(doc) for doc in docs]


# Profile operations
def get_profile() -> Optional[Dict[str, Any]]:
    """
    Get the single profile document.
    Returns None if no profile exists.
    """
    collection = get_profile_collection()
    profile = collection.find_one({})
    return serialize_document(profile) if profile else None


def upsert_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create or update the single profile document.
    """
    collection = get_profile_collection()
    now = datetime.utcnow()
    
    existing = collection.find_one({})
    
    if existing:
        # Update existing profile
        update_data = {
            "name": data.get("name", ""),
            "age": data.get("age"),
            "education_years": data.get("education_years"),
            "diagnosis_notes": data.get("diagnosis_notes"),
            "updated_at": now
        }
        collection.update_one({"_id": existing["_id"]}, {"$set": update_data})
        updated = collection.find_one({"_id": existing["_id"]})
        return serialize_document(updated)
    else:
        # Create new profile
        new_profile = {
            "name": data.get("name", ""),
            "age": data.get("age"),
            "education_years": data.get("education_years"),
            "diagnosis_notes": data.get("diagnosis_notes"),
            "created_at": now,
            "updated_at": now
        }
        result = collection.insert_one(new_profile)
        new_profile["_id"] = result.inserted_id
        return serialize_document(new_profile)


# Checkin operations
def create_checkin(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new check-in document with AI fields set to pending.
    """
    collection = get_checkins_collection()
    now = datetime.utcnow()
    
    checkin = {
        "date": data["date"],
        "created_at": now,
        "memory_score": data["memory_score"],
        "orientation_score": data["orientation_score"],
        "activities_score": data["activities_score"],
        "mood": data["mood"],
        "notes": data.get("notes", ""),
        
        # AI fields - initially pending
        "ai_risk_level": None,
        "ai_summary": None,
        "ai_suggestions": None,
        "ai_disclaimer": None,
        "ai_status": "pending",
        "ai_error_message": None
    }
    
    result = collection.insert_one(checkin)
    checkin["_id"] = result.inserted_id
    
    return serialize_document(checkin)


def update_checkin_ai_fields(checkin_id: str, ai_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update the AI-related fields of a check-in document.
    """
    collection = get_checkins_collection()
    
    try:
        object_id = ObjectId(checkin_id)
    except Exception:
        return None
    
    update_data = {
        "ai_risk_level": ai_data.get("risk_level"),
        "ai_summary": ai_data.get("summary"),
        "ai_suggestions": ai_data.get("suggestions"),
        "ai_disclaimer": ai_data.get("disclaimer"),
        "ai_status": ai_data.get("status", "ok"),
        "ai_error_message": ai_data.get("error_message")
    }
    
    collection.update_one({"_id": object_id}, {"$set": update_data})
    updated = collection.find_one({"_id": object_id})
    
    return serialize_document(updated) if updated else None


def get_checkins(limit: int = 20) -> List[Dict[str, Any]]:
    """
    Get recent check-ins sorted by created_at descending.
    """
    collection = get_checkins_collection()
    checkins = list(collection.find({}).sort("created_at", DESCENDING).limit(limit))
    return serialize_documents(checkins)


def get_checkin_by_id(checkin_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single check-in by its ID.
    """
    collection = get_checkins_collection()
    
    try:
        object_id = ObjectId(checkin_id)
    except Exception:
        return None
    
    checkin = collection.find_one({"_id": object_id})
    return serialize_document(checkin) if checkin else None


def get_recent_checkins_for_context(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get recent check-ins to provide context for AI analysis.
    Returns simplified data for the AI prompt.
    """
    collection = get_checkins_collection()
    checkins = list(collection.find({}).sort("created_at", DESCENDING).limit(limit))
    
    # Return simplified data for AI context
    result = []
    for c in checkins:
        result.append({
            "date": c.get("date"),
            "memory_score": c.get("memory_score"),
            "orientation_score": c.get("orientation_score"),
            "activities_score": c.get("activities_score"),
            "mood": c.get("mood"),
            "notes": c.get("notes", "")
        })
    
    return result
