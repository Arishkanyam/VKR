import React, { useState } from 'react';
import Navigation from './components/Navigation';
import RecordPage from './pages/RecordPage';
import MonitorPage from './pages/MonitorPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState('record'); // 'record' или 'monitor'

  return (
    <>
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      {currentPage === 'record' ? <RecordPage /> : <MonitorPage />}
    </>
  );
}