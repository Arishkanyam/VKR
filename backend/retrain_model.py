import librosa
import numpy as np
from pathlib import Path
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings('ignore')

def extract_features(audio_path, sr=16000):
    """Извлечение 54 признаков из аудио"""
    y, _ = librosa.load(audio_path, sr=sr)
    
    # Предобработка
    y = librosa.util.normalize(y)
    y, _ = librosa.effects.trim(y, top_db=20)
    y = librosa.effects.preemphasis(y, coef=0.97)
    
    # MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)
    
    # Chroma
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)
    chroma_std = np.std(chroma, axis=1)
    
    # ZCR
    zcr = librosa.feature.zero_crossing_rate(y)
    zcr_mean = np.mean(zcr)
    zcr_std = np.std(zcr)
    
    # Spectral Centroid
    sc = librosa.feature.spectral_centroid(y=y, sr=sr)
    sc_mean = np.mean(sc) / sr
    sc_std = np.std(sc) / sr
    
    features = np.concatenate([
        mfcc_mean, mfcc_std,
        chroma_mean, chroma_std,
        [zcr_mean, zcr_std],
        [sc_mean, sc_std]
    ])
    
    return features

def retrain_models():
    """Переобучение всех моделей с новыми данными"""
    print("="*60)
    print("НАЧАЛО ПЕРЕОБУЧЕНИЯ МОДЕЛЕЙ")
    print("="*60)
    
    # Загрузка данных
    audio_dir = Path("./audio_samples")
    if not audio_dir.exists():
        print("Папка с аудио не найдена!")
        return False
    
    X = []
    y = []
    
    print("\n Загрузка аудиофайлов...")
    for speaker_dir in audio_dir.iterdir():
        if speaker_dir.is_dir():
            speaker_name = speaker_dir.name
            audio_files = list(speaker_dir.glob("*.wav"))
            print(f"   👤 {speaker_name}: {len(audio_files)} файлов")
            
            for audio_file in audio_files:
                try:
                    features = extract_features(audio_file)
                    X.append(features)
                    y.append(speaker_name)
                except Exception as e:
                    print(f"   Ошибка при обработке {audio_file.name}: {e}")
    
    if len(X) == 0:
        print("\nНет данных для обучения!")
        return False
    
    X = np.array(X)
    y = np.array(y)
    
    unique_speakers = np.unique(y)
    print(f"\nЗагружено {len(X)} записей от {len(unique_speakers)} говорящих")
    print(f"   Говорящие: {', '.join(unique_speakers)}")
    
    # Проверка минимального количества данных
    if len(X) < 10:
        print("\nСлишком мало данных для надёжного обучения (минимум 10 записей)")
    
    # Кодирование меток
    label_encoder = LabelEncoder()
    y_encoded = label_encoder.fit_transform(y)
    
    # Нормализация
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Разделение данных
    test_size = 0.2 if len(X) > 20 else 0.1
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y_encoded, 
        test_size=test_size, 
        random_state=42, 
        stratify=y_encoded
    )
    
    print(f"\nРазделение данных:")
    print(f"   Обучающая выборка: {len(X_train)} записей")
    print(f"   Тестовая выборка: {len(X_test)} записей")
    
    # Обучение Random Forest
    print("\nОбучение Random Forest...")
    rf_model = RandomForestClassifier(
        n_estimators=200,
        max_depth=30,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train, y_train)
    rf_score = rf_model.score(X_test, y_test)
    print(f"   Accuracy: {rf_score:.4f} ({rf_score*100:.2f}%)")
    
    # Обучение SVM
    print("\nОбучение SVM...")
    svm_model = SVC(kernel='rbf', C=10, gamma='scale', probability=True, random_state=42)
    svm_model.fit(X_train, y_train)
    svm_score = svm_model.score(X_test, y_test)
    print(f"   Accuracy: {svm_score:.4f} ({svm_score*100:.2f}%)")
    
    # Обучение Logistic Regression
    print("\nОбучение Logistic Regression...")
    lr_model = LogisticRegression(max_iter=1000, random_state=42)
    lr_model.fit(X_train, y_train)
    lr_score = lr_model.score(X_test, y_test)
    print(f"   Accuracy: {lr_score:.4f} ({lr_score*100:.2f}%)")
    
    # Сохранение моделей
    print("\nСохранение моделей...")
    models_dir = Path("./models")
    models_dir.mkdir(exist_ok=True)
    
    joblib.dump(rf_model, models_dir / "model_randomforest.pkl")
    joblib.dump(svm_model, models_dir / "model_svm.pkl")
    joblib.dump(lr_model, models_dir / "model_logisreg.pkl")
    joblib.dump(scaler, models_dir / "scaler.pkl")
    joblib.dump(label_encoder, models_dir / "label_encoder.pkl")
    
    print("\n" + "="*60)
    print("ПЕРЕОБУЧЕНИЕ ЗАВЕРШЕНО УСПЕШНО!")
    print("="*60)
    print(f"\nИтоговая статистика:")
    print(f"   Зарегистрировано говорящих: {len(label_encoder.classes_)}")
    print(f"   Лучшая модель: {'Random Forest' if rf_score >= max(svm_score, lr_score) else 'SVM' if svm_score >= lr_score else 'Logistic Regression'}")
    print(f"   Средняя точность: {np.mean([rf_score, svm_score, lr_score]):.4f}")
    
    return True

if __name__ == "__main__":
    success = retrain_models()
    exit(0 if success else 1)