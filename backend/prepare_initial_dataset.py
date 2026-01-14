"""
Скрипт для подготовки изначального датасета (50 Speakers Audio Data)
Копирует файлы из исходного датасета в audio_samples/
"""

import shutil
from pathlib import Path

# Путь к вашему исходному датасету Kaggle
SOURCE_DATASET = Path(r"C:\Users\ancol\.cache\kagglehub\datasets\vjcalling\speaker-recognition-audio-dataset\versions\1\50_speakers_audio_data")  
TARGET_DIR = Path("./audio_samples")

def prepare_dataset():
    """Копирует исходный датасет в рабочую папку"""
    
    if not SOURCE_DATASET.exists():
        print(f"Ошибка: датасет не найден по пути {SOURCE_DATASET}")
        return
    
    TARGET_DIR.mkdir(exist_ok=True)
    
    copied_speakers = 0
    copied_files = 0
    
    for speaker_dir in SOURCE_DATASET.iterdir():
        if speaker_dir.is_dir():
            target_speaker_dir = TARGET_DIR / speaker_dir.name
            target_speaker_dir.mkdir(exist_ok=True)
            
            # Копируем только WAV файлы
            for audio_file in speaker_dir.glob("*.wav"):
                shutil.copy2(audio_file, target_speaker_dir / audio_file.name)
                copied_files += 1
            
            copied_speakers += 1
            print(f"Скопирован говорящий: {speaker_dir.name}")
    
    print(f"\nГотово! Скопировано {copied_speakers} говорящих, {copied_files} файлов")
    print("Теперь запустите: python retrain_model.py")

if __name__ == "__main__":
    prepare_dataset()