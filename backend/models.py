from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    voice_profiles = relationship("VoiceProfile", back_populates="user")
    identifications = relationship("IdentificationLog", back_populates="user")

class VoiceProfile(Base):
    __tablename__ = "voice_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    speaker_name = Column(String, nullable=False)
    num_samples = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="voice_profiles")
    audio_samples = relationship("AudioSample", back_populates="voice_profile")

class AudioSample(Base):
    __tablename__ = "audio_samples"
    
    id = Column(Integer, primary_key=True, index=True)
    voice_profile_id = Column(Integer, ForeignKey("voice_profiles.id"), nullable=False)
    file_path = Column(String, nullable=False)
    duration = Column(Float)
    sample_rate = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    voice_profile = relationship("VoiceProfile", back_populates="audio_samples")

class IdentificationLog(Base):
    __tablename__ = "identification_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    identified_speaker = Column(String)
    confidence = Column(Float)
    model_used = Column(String)
    processing_time = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="identifications")