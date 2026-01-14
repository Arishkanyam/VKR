import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, Mic, Square, RefreshCw, CheckCircle, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { registerAudioSample, getRegisteredSpeakers, retrainModels } from '../api/apiClient';

const MonitorPage = () => {
  const [mode, setMode] = useState('view'); // 'view' или 'register'
  const [speakerName, setSpeakerName] = useState('');
  const [currentSample, setCurrentSample] = useState(1);
  const [samples, setSamples] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [registeredSpeakers, setRegisteredSpeakers] = useState([]);
  const [isRetraining, setIsRetraining] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    loadSpeakers();
  }, []);

  const loadSpeakers = async () => {
    try {
      const data = await getRegisteredSpeakers();
      setRegisteredSpeakers(data.speakers || []);
    } catch (error) {
      console.error('Error loading speakers:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        stream.getTracks().forEach(track => track.stop());
        setSamples(prev => [...prev, audioBlob]);
      };
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateLevel = () => {
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setAudioLevel(average / 255);
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      updateLevel();
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 0.1);
      }, 100);
      
    } catch (error) {
      console.error('Error:', error);
      alert('Не удалось получить доступ к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationRef.current);
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      if (currentSample < 3) {
        setCurrentSample(prev => prev + 1);
      }
    }
  };

  const submitRegistration = async () => {
    if (!speakerName.trim()) {
      alert('Введите имя говорящего');
      return;
    }
    
    if (samples.length !== 3) {
      alert('Необходимо 3 записи');
      return;
    }
    
    try {
      for (let i = 0; i < samples.length; i++) {
        await registerAudioSample(speakerName, i + 1, samples[i]);
      }
      
      alert(`Пользователь ${speakerName} зарегистрирован! Не забудьте переобучить модель.`);
      
      setSpeakerName('');
      setSamples([]);
      setCurrentSample(1);
      setMode('view');
      loadSpeakers();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка при регистрации');
    }
  };

  const handleRetrain = async () => {
    if (!confirm('Переобучение займёт несколько минут. Продолжить?')) {
      return;
    }
    
    setIsRetraining(true);
    try {
      await retrainModels();
      alert('Модель успешно переобучена! Перезапустите backend для загрузки новых моделей.');
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка при переобучении');
    } finally {
      setIsRetraining(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #0f172a 100%)',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2.25rem', 
          fontWeight: 'bold', 
          color: 'white', 
          marginBottom: '2rem', 
          textAlign: 'center' 
        }}>
          Панель администратора
        </h1>

        {/* Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem', 
          justifyContent: 'center' 
        }}>
          <button
            onClick={() => setMode('view')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              background: mode === 'view' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Просмотр пользователей
          </button>
          <button
            onClick={() => {
              setMode('register');
              setSpeakerName('');
              setSamples([]);
              setCurrentSample(1);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 'bold',
              background: mode === 'register' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <UserPlus style={{ width: '1.25rem', height: '1.25rem' }} />
            Регистрация
          </button>
        </div>

        {/* VIEW MODE */}
        {mode === 'view' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(16px)',
              borderRadius: '1rem',
              padding: '2rem',
              marginBottom: '1rem'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                  Зарегистрированные пользователи
                </h2>
                <button
                  onClick={loadSpeakers}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <RefreshCw style={{ width: '1rem', height: '1rem' }} />
                  Обновить
                </button>
              </div>

              {registeredSpeakers.length === 0 ? (
                <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                  Нет зарегистрированных пользователей
                </p>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {registeredSpeakers.map((speaker, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.125rem' }}>
                          {speaker.name}
                        </p>
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                          Записей: {speaker.samples}
                        </p>
                      </div>
                      {speaker.samples >= 3 && (
                        <CheckCircle style={{ width: '1.5rem', height: '1.5rem', color: '#4ade80' }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleRetrain}
              disabled={isRetraining || registeredSpeakers.length === 0}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '0.5rem',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                background: isRetraining ? '#9ca3af' : '#22c55e',
                color: 'white',
                border: 'none',
                cursor: isRetraining || registeredSpeakers.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              <RefreshCw 
                style={{ 
                  width: '1.5rem', 
                  height: '1.5rem',
                  animation: isRetraining ? 'spin 1s linear infinite' : 'none'
                }} 
              />
              {isRetraining ? 'Переобучение...' : 'Переобучить модель'}
            </button>
          </motion.div>
        )}

        {/* REGISTER MODE */}
        {mode === 'register' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(16px)',
              borderRadius: '1rem',
              padding: '2rem'
            }}
          >
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: 'white',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              Регистрация нового пользователя
            </h2>

            {/* Name Input */}
            {samples.length === 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  color: '#a5f3fc', 
                  marginBottom: '0.5rem',
                  fontWeight: 'bold'
                }}>
                  Имя пользователя:
                </label>
                <input
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  placeholder="Введите имя..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '2px solid rgba(34, 211, 238, 0.3)',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                />
              </div>
            )}

            {/* Recording Progress */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <p style={{ color: 'white', fontSize: '1.25rem', marginBottom: '1rem' }}>
                Запись {currentSample} из 3
              </p>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {[1, 2, 3].map(num => (
                  <div
                    key={num}
                    style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '50%',
                      background: samples.length >= num ? '#22c55e' : 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      color: 'white',
                      fontSize: '1.25rem'
                    }}
                  >
                    {samples.length >= num ? '✓' : num}
                  </div>
                ))}
              </div>

              {/* Recording Visualizer */}
              {isRecording && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ marginBottom: '1rem' }}
                >
                  <div
                    style={{
                      width: '6rem',
                      height: '6rem',
                      borderRadius: '50%',
                      background: '#ef4444',
                      margin: '0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 0 ${audioLevel * 80}px rgba(239, 68, 68, 0.8)`
                    }}
                  >
                    <Activity style={{ width: '3rem', height: '3rem', color: 'white' }} />
                  </div>
                </motion.div>
              )}

              {/* Recording Time */}
              {isRecording && (
                <p style={{ color: '#a5f3fc', fontSize: '1.125rem' }}>
                  {recordingTime.toFixed(1)} сек
                </p>
              )}
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {samples.length < 3 && !isRecording && (
                <button
                  onClick={startRecording}
                  disabled={!speakerName.trim() && samples.length === 0}
                  style={{
                    padding: '1rem 2rem',
                    borderRadius: '9999px',
                    fontWeight: 'bold',
                    fontSize: '1.125rem',
                    background: (!speakerName.trim() && samples.length === 0) ? '#9ca3af' : '#06b6d4',
                    color: 'white',
                    border: 'none',
                    cursor: (!speakerName.trim() && samples.length === 0) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <Mic style={{ width: '1.5rem', height: '1.5rem' }} />
                  Записать образец {currentSample}
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  style={{
                    padding: '1rem 2rem',
                    borderRadius: '9999px',
                    fontWeight: 'bold',
                    fontSize: '1.125rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <Square style={{ width: '1.5rem', height: '1.5rem' }} />
                  Остановить
                </button>
              )}

              {samples.length === 3 && !isRecording && (
                <button
                  onClick={submitRegistration}
                  style={{
                    padding: '1rem 2rem',
                    borderRadius: '9999px',
                    fontWeight: 'bold',
                    fontSize: '1.125rem',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <CheckCircle style={{ width: '1.5rem', height: '1.5rem' }} />
                  Завершить регистрацию
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MonitorPage;