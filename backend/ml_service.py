import numpy as np
import librosa
import joblib
import tensorflow as tf
from pathlib import Path
from typing import Tuple, Dict
import time
from config import settings

class MLService:
    """Сервис для работы с ML моделями с улучшенной обработкой акцентов"""
    
    def __init__(self):
        self.models_path = Path(settings.MODELS_PATH)
        self._load_models()
    
    def reload_models(self):
        """Перезагрузка моделей (после переобучения)"""
        print("Перезагрузка моделей...")
        self._load_models()
        print("Модели успешно перезагружены!")
    
    def _load_models(self):
        """Загружает все ML модели"""
        print("Загрузка моделей...")
        
        try:
            # Random Forest
            self.rf_model = joblib.load(self.models_path / "model_randomforest.pkl")
            self.scaler = joblib.load(self.models_path / "scaler.pkl")
            self.label_encoder = joblib.load(self.models_path / "label_encoder.pkl")
            
            # SVM
            self.svm_model = joblib.load(self.models_path / "model_svm.pkl")

            # Logistic Regression
            self.lr_model = joblib.load(self.models_path / "model_logisreg.pkl")
            
            print(f"Модели загружены. Доступно {len(self.label_encoder.classes_)} говорящих")
            print(f"Говорящие: {', '.join(map(str, self.label_encoder.classes_))}")
            
        except Exception as e:
            print(f"Ошибка при загрузке моделей: {e}")
            raise
    
    def preprocess_audio(self, audio_data: np.ndarray, sr: int = 16000) -> np.ndarray:
        """
        Улучшенная предобработка для работы с акцентами
        """
        # 1. Нормализация громкости
        audio_data = librosa.util.normalize(audio_data)
        
        # 2. Удаление тишины (более агрессивное для шумных записей)
        audio_data, _ = librosa.effects.trim(audio_data, top_db=20, frame_length=512, hop_length=128)
        
        # 3. Предусиление высоких частот (компенсация акцента)
        audio_data = librosa.effects.preemphasis(audio_data, coef=0.97)
        
        # 4. Шумоподавление через спектральное вычитание
        if len(audio_data) > sr:  # Если запись длиннее 1 секунды
            # Берем первые 0.5 сек как шум
            noise_sample = audio_data[:int(sr * 0.5)]
            noise_profile = np.abs(librosa.stft(noise_sample))
            noise_mean = np.mean(noise_profile, axis=1, keepdims=True)
            
            # Вычитаем шум из полного сигнала
            audio_stft = librosa.stft(audio_data)
            audio_magnitude = np.abs(audio_stft)
            audio_phase = np.angle(audio_stft)
            
            # Спектральное вычитание
            cleaned_magnitude = np.maximum(audio_magnitude - 1.5 * noise_mean, 0)
            audio_data = librosa.istft(cleaned_magnitude * np.exp(1j * audio_phase))
        
        return audio_data
    
    def extract_features(self, audio_data: np.ndarray, sr: int = 16000) -> np.ndarray:
        """
        Извлекает 54 признака из аудио с улучшенной обработкой
        """
        # Предобработка
        audio_data = self.preprocess_audio(audio_data, sr)
        
        # MFCC с дельтами (лучше для акцентов)
        mfcc = librosa.feature.mfcc(y=audio_data, sr=sr, n_mfcc=13, 
                                     n_fft=512, hop_length=256)
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_mean = np.mean(mfcc, axis=1)
        mfcc_std = np.std(mfcc, axis=1)
        
        # Chroma
        chroma = librosa.feature.chroma_stft(y=audio_data, sr=sr, n_fft=512, hop_length=256)
        chroma_mean = np.mean(chroma, axis=1)
        chroma_std = np.std(chroma, axis=1)
        
        # ZCR
        zcr = librosa.feature.zero_crossing_rate(audio_data, frame_length=512, hop_length=256)
        zcr_mean = np.mean(zcr)
        zcr_std = np.std(zcr)
        
        # Spectral Centroid (с нормализацией)
        spectral_centroid = librosa.feature.spectral_centroid(y=audio_data, sr=sr, 
                                                               n_fft=512, hop_length=256)
        sc_mean = np.mean(spectral_centroid) / sr  # Нормализуем к частоте дискретизации
        sc_std = np.std(spectral_centroid) / sr
        
        # Объединяем
        features = np.concatenate([
            mfcc_mean, mfcc_std,
            chroma_mean, chroma_std,
            [zcr_mean, zcr_std],
            [sc_mean, sc_std]
        ])
        
        return features
    
    def identify(self, audio_data: np.ndarray, sr: int = 16000, 
                use_ensemble: bool = True) -> Dict:
        """
        Идентифицирует говорящего с улучшенной обработкой
        
        Returns:
            Dict с результатами идентификации
        """
        start_time = time.time()
        
        # Извлекаем признаки
        features = self.extract_features(audio_data, sr)
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        
        # Random Forest предсказание
        rf_proba = self.rf_model.predict_proba(features_scaled)[0]
        rf_pred = np.argmax(rf_proba)
        rf_confidence = rf_proba[rf_pred]
        
        # Если уверенность высокая и не нужен ансамбль
        if rf_confidence > 0.9 and not use_ensemble:
            speaker_id = self.label_encoder.inverse_transform([rf_pred])[0]
            processing_time = time.time() - start_time
            
            # Top-5 вероятности
            top_5_idx = np.argsort(rf_proba)[-5:][::-1]
            probabilities = {
                self.label_encoder.inverse_transform([idx])[0]: float(rf_proba[idx])
                for idx in top_5_idx
            }
            
            return {
                'identified_speaker': speaker_id,
                'confidence': float(rf_confidence),
                'model_used': 'RandomForest',
                'probabilities': probabilities,
                'processing_time': processing_time
            }
        
        # Ансамбль: RF + SVM + Logistic Regression
        svm_proba = self.svm_model.predict_proba(features_scaled)[0]
        lr_proba = self.lr_model.predict_proba(features_scaled)[0]
        
        # Взвешенное голосование (больше веса SVM для акцентов)
        if use_ensemble:
            ensemble_proba = 0.5 * rf_proba + 0.3 * svm_proba + 0.2 * lr_proba
        else:
            ensemble_proba = rf_proba
        
        ensemble_pred = np.argmax(ensemble_proba)
        ensemble_confidence = ensemble_proba[ensemble_pred]
        
        speaker_id = self.label_encoder.inverse_transform([ensemble_pred])[0]
        processing_time = time.time() - start_time
        
        # Top-5
        top_5_idx = np.argsort(ensemble_proba)[-5:][::-1]
        probabilities = {
            self.label_encoder.inverse_transform([idx])[0]: float(ensemble_proba[idx])
            for idx in top_5_idx
        }
        
        model_used = "Ensemble (RF+SVM+LR)" if use_ensemble else "RandomForest"
        
        return {
            'identified_speaker': speaker_id,
            'confidence': float(ensemble_confidence),
            'model_used': model_used,
            'probabilities': probabilities,
            'processing_time': processing_time
        }
    
    def get_speakers(self) -> list:
        """Возвращает список всех зарегистрированных говорящих"""
        return self.label_encoder.classes_.tolist()

# Глобальный экземпляр
ml_service = MLService()