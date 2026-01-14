import React, { useState, useRef } from 'react';
import { Mic, Square, CheckCircle, XCircle, Activity, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { identifySpeaker } from '../api/apiClient';

const RecordPage = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, recording, processing, success, denied
  const [result, setResult] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);

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
        
        setStatus('processing');
        
        try {
          const response = await identifySpeaker(audioBlob);
          setResult(response);
          setStatus(response.confidence > 0.8 ? 'success' : 'denied');
        } catch (error) {
          console.error('Error:', error);
          setStatus('denied');
        }
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
      setStatus('recording');
      setRecordingTime(0);
      updateLevel();
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 0.1);
      }, 100);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
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
    }
  };

  const resetRecording = () => {
    setStatus('idle');
    setResult(null);
    setRecordingTime(0);
    setAudioLevel(0);
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #164e63 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '28rem', width: '100%' }}>
        
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
              <User style={{ width: '6rem', height: '6rem', margin: '0 auto 1rem', color: '#22d3ee' }} />
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                Идентификация по голосу
              </h1>
              <p style={{ color: '#a5f3fc' }}>Нажмите кнопку для записи</p>
            </motion.div>
          )}

          {status === 'recording' && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ position: 'relative', display: 'inline-block', marginBottom: '1.5rem' }}
              >
                <div 
                  style={{
                    width: '8rem',
                    height: '8rem',
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 ${audioLevel * 100}px rgba(239, 68, 68, 0.8)`
                  }}
                >
                  <Activity style={{ width: '4rem', height: '4rem', color: 'white' }} />
                </div>
              </motion.div>
              
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
                Запись голоса...
              </h2>
              
              <div style={{ width: '100%', background: '#334155', borderRadius: '9999px', height: '0.75rem', marginBottom: '0.5rem' }}>
                <motion.div
                  style={{
                    background: '#22d3ee',
                    height: '0.75rem',
                    borderRadius: '9999px'
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((recordingTime / 5) * 100, 100)}%` }}
                />
              </div>
              <p style={{ color: '#a5f3fc' }}>{recordingTime.toFixed(1)} / 5.0 сек</p>
            </motion.div>
          )}

          {status === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                style={{
                  width: '6rem',
                  height: '6rem',
                  border: '8px solid #22d3ee',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  margin: '0 auto 1.5rem'
                }}
              />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
                Обработка...
              </h2>
            </motion.div>
          )}

          {status === 'success' && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <CheckCircle style={{ width: '8rem', height: '8rem', margin: '0 auto 1.5rem', color: '#4ade80' }} />
              </motion.div>
              
              <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                Доступ разрешен
              </h2>
              <p style={{ fontSize: '1.25rem', color: '#4ade80', marginBottom: '1.5rem' }}>
                Добро пожаловать, {result.identified_speaker}!
              </p>
              
              <div style={{ 
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(10px)',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#9ca3af' }}>Уверенность:</span>
                  <span style={{ color: 'white', fontWeight: 'bold' }}>
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>Модель:</span>
                  <span style={{ color: 'white' }}>{result.model_used}</span>
                </div>
              </div>
            </motion.div>
          )}

          {status === 'denied' && (
            <motion.div
              key="denied"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <XCircle style={{ width: '8rem', height: '8rem', margin: '0 auto 1.5rem', color: '#f87171' }} />
              </motion.div>
              
              <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
                Доступ запрещен
              </h2>
              <p style={{ fontSize: '1.25rem', color: '#f87171', marginBottom: '1.5rem' }}>
                Личность не распознана
              </p>
              
              {result && (
                <div style={{ 
                  background: 'rgba(30, 41, 59, 0.5)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#9ca3af' }}>Уверенность:</span>
                    <span style={{ color: 'white', fontWeight: 'bold' }}>
                      {(result.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {status === 'idle' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startRecording}
              style={{
                background: '#06b6d4',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '9999px',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Mic style={{ width: '1.5rem', height: '1.5rem' }} />
              Начать запись
            </motion.button>
          )}

          {status === 'recording' && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopRecording}
              style={{
                background: '#ef4444',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '9999px',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Square style={{ width: '1.5rem', height: '1.5rem' }} />
              Остановить
            </motion.button>
          )}

          {(status === 'success' || status === 'denied') && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetRecording}
              style={{
                background: '#475569',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '9999px',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Новая запись
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordPage;