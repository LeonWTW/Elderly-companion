"""
Configuration management for the Elderly Companion application.
Reads environment variables and provides defaults.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()


class Config:
    """Application configuration class."""
    
    # MongoDB Configuration
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017/elderly_companion_db")
    DATABASE_NAME = "elderly_companion_db"
    
    # OpenAI Configuration
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = "gpt-3.5-turbo"
    
    # Flask Configuration
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    @classmethod
    def is_openai_configured(cls) -> bool:
        """Check if OpenAI API key is configured."""
        return bool(cls.OPENAI_API_KEY and cls.OPENAI_API_KEY.strip())


config = Config()
