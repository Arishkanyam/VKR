from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
import numpy as np
import soundfile as sf
import librosa
import io
import subprocess
import sys
from datetime import timedelta
from typing import List
import shutil
from pathlib import Path
import uuid


from config import settings
from database import engine, get_db
import models
import schemas
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, oauth2_scheme
)
from ml_service import ml_service

# Создаём таблицы
models.Base.metadata.create_all(bind=engine)

# Инициализация FastAPI
app = FastAPI(
    title="Speaker Recognition API",
    description="Биометрическая идентификация личности по голосу",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ROUTES: Authentication
# ============================================================================

@app.post("/api/auth/register", response_model=schemas.UserResponse)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверяем существование
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Создаём
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=get_password_hash(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/login", response_model=schemas.Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Вход в систему"""
    print(f"[LOGIN] Попытка входа: username={form_data.username}")
    
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    
    if not user:
        print(f"[LOGIN] Пользователь не найден: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        print(f"[LOGIN] Неверный пароль для: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    print(f"[LOGIN] Успешный вход: {form_data.username}, токен сгенерирован")
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    """Получить текущего пользователя"""
    return current_user

# ============================================================================
# ROUTES: Speaker Identification
# ============================================================================

@app.post("/api/identify", response_model=schemas.IdentificationResponse)
async def identify_speaker(
    audio_file: UploadFile = File(...),
    use_ensemble: bool = True,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Идентификация говорящего по аудиофайлу"""
    try:
        # Читаем аудио
        audio_bytes = await audio_file.read()
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))
        
        # Ресемплинг если нужно
        if sr != 16000:
            audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=16000)
            sr = 16000
        
        # Идентификация
        result = ml_service.identify(audio_data, sr, use_ensemble)
        
        # Сохраняем лог
        log = models.IdentificationLog(
            user_id=current_user.id,
            identified_speaker=result['identified_speaker'],
            confidence=result['confidence'],
            model_used=result['model_used'],
            processing_time=result['processing_time']
        )
        db.add(log)
        db.commit()
        db.refresh(log) # Добавьте это, чтобы получить ID из базы
        
        return result
        
    except Exception as e:
        db.rollback() # Важно откатить транзакцию при ошибке
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/speakers")
async def get_speakers():
    """Получить список всех зарегистрированных говорящих"""
    speakers = ml_service.get_speakers()
    return {"total": len(speakers), "speakers": speakers}

@app.get("/api/identifications", response_model=List[schemas.IdentificationLogResponse])
async def get_identification_history(
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """История идентификаций пользователя"""
    logs = db.query(models.IdentificationLog)\
        .filter(models.IdentificationLog.user_id == current_user.id)\
        .order_by(models.IdentificationLog.created_at.desc())\
        .limit(limit)\
        .all()
    return logs

# ============================================================================
# ROUTES: Health & Info
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": "Speaker Recognition API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": True,
        "num_speakers": len(ml_service.get_speakers())
    }

# ============================================================================
# ROUTES: Monitoring Endpoint
# ============================================================================
@app.get("/api/monitor/latest")
async def get_latest_identification(db: Session = Depends(get_db)):
    """Получить самую последнюю попытку идентификации для панели оператора"""
    # Запрос последней записи по дате создания
    latest_log = db.query(models.IdentificationLog)\
        .order_by(desc(models.IdentificationLog.created_at))\
        .first()
    
    if not latest_log:
        return {"status": "waiting", "message": "Нет записей в системе"}
  
    return {
        "status": "success",
        "id": latest_log.id,
        "speaker": latest_log.identified_speaker,
        "confidence": latest_log.confidence,
        "model": latest_log.model_used,
        "timestamp": latest_log.created_at.strftime("%H:%M:%S"),
        "full_date": latest_log.created_at.date(),
        "is_access_granted": latest_log.confidence > 0.8  # Порог доступа changable
    }

#============================================================================
# ROUTES: Voice Registration & Retraining
# ============================================================================

@app.post("/api/register/audio")
async def register_audio_sample(
    speaker_name: str,
    sample_number: int,
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Сохранение аудиообразца для регистрации нового говорящего"""
    try:
        # Создаём директорию для нового пользователя
        user_dir = Path("./audio_samples") / speaker_name
        user_dir.mkdir(parents=True, exist_ok=True)
        
        # Сохраняем файл
        file_path = user_dir / f"sample_{sample_number}.wav"
        audio_bytes = await audio_file.read()

        with open(file_path, "wb") as f:
            f.write(audio_bytes)
        
        return {
            "status": "success",
            "speaker_name": speaker_name,
            "sample_number": sample_number,
            "file_path": str(file_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/speakers/registered")
async def get_registered_speakers():
    """Получить список зарегистрированных говорящих"""
    try:
        audio_dir = Path("./audio_samples")
        if not audio_dir.exists():
            return {"speakers": [], "count": 0}
        
        speakers = []
        for speaker_dir in audio_dir.iterdir():
            if speaker_dir.is_dir():
                sample_count = len(list(speaker_dir.glob("*.wav")))
                speakers.append({
                    "name": speaker_dir.name,
                    "samples": sample_count
                })
        
        return {"speakers": speakers, "count": len(speakers)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/retrain")
async def retrain_models():
    """Переобучение моделей с новыми данными"""
    try:
        # Запускаем скрипт переобучения
        result = subprocess.run(
            [sys.executable, "retrain_model.py"],
            capture_output=True,
            text=True,
            timeout=600  # 10 минут максимум
        )
        
        if result.returncode != 0:
            raise Exception(f"Ошибка переобучения: {result.stderr}")
        
        # ПЕРЕЗАГРУЖАЕМ модели в память
        ml_service.reload_models()
        
        return {
            "status": "success",
            "message": "Модели успешно переобучены и перезагружены!",
            "num_speakers": len(ml_service.get_speakers()),
            "speakers": ml_service.get_speakers()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ЗАПУСК
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )