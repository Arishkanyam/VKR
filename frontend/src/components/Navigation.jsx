import React from 'react';

const Navigation = ({ currentPage, onNavigate }) => {
  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 50,
      display: 'flex',
      gap: '0.5rem'
    }}>
      <button
        onClick={() => onNavigate('record')}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          background: currentPage === 'record' ? '#06b6d4' : 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Запись
      </button>
      <button
        onClick={() => onNavigate('monitor')}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.5rem',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          background: currentPage === 'monitor' ? '#06b6d4' : 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Монитор
      </button>
    </div>
  );
};

export default Navigation;