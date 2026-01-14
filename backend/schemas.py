from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime

# User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Voice Profile Schemas
class VoiceProfileCreate(BaseModel):
    speaker_name: str

class VoiceProfileResponse(BaseModel):
    id: int
    speaker_name: str
    num_samples: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Identification Schemas
class IdentificationResponse(BaseModel):
    identified_speaker: str
    confidence: float
    model_used: str
    probabilities: Dict[str, float]
    processing_time: float

class IdentificationLogResponse(BaseModel):
    id: int
    identified_speaker: str
    confidence: float
    model_used: str
    created_at: datetime
    
    class Config:
        from_attributes = True
