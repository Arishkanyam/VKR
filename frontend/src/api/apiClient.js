// API Configuration
const API_BASE = 'http://localhost:8000';

// ======================== IDENTIFICATION ========================
export const identifySpeaker = async (audioBlob) => {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, 'recording.wav');
  
  const response = await fetch(`${API_BASE}/api/identify?use_ensemble=true`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) throw new Error('Identification failed');
  return response.json();
};

// ======================== REGISTRATION ========================
export const registerAudioSample = async (speakerName, sampleNumber, audioBlob) => {
  const formData = new FormData();
  formData.append('audio_file', audioBlob, `sample_${sampleNumber}.wav`);
  
  const response = await fetch(
    `${API_BASE}/api/register/audio?speaker_name=${encodeURIComponent(speakerName)}&sample_number=${sampleNumber}`,
    {
      method: 'POST',
      body: formData
    }
  );
  
  if (!response.ok) throw new Error('Registration failed');
  return response.json();
};

export const getRegisteredSpeakers = async () => {
  const response = await fetch(`${API_BASE}/api/speakers/registered`);
  return response.json();
};

// ======================== MODEL MANAGEMENT ========================
export const retrainModels = async () => {
  const response = await fetch(`${API_BASE}/api/models/retrain`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Retraining failed');
  return response.json();
};

export const getLatestIdentification = async () => {
  const response = await fetch(`${API_BASE}/api/monitor/latest`);
  return response.json();
};