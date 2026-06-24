import React, { useState, useEffect } from 'react';

/**
 * CountdownTimer
 * @param {string} startTime - ISO string or Date object when the timer started
 * @param {number} limitMinutes - Total duration in minutes (default 8)
 * @param {function} onTimeout - Callback when timer reaches zero
 */
const CountdownTimer = ({ startTime, limitMinutes = 8, onTimeout }) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!startTime) return;

    const calculateTimeLeft = () => {
      const start = new Date(startTime).getTime();
      const limit = limitMinutes * 60 * 1000;
      const now = new Date().getTime();
      const difference = (start + limit) - now;
      return Math.max(0, Math.floor(difference / 1000));
    };

    // Initial calculation
    const initialRemaining = calculateTimeLeft();
    setTimeLeft(initialRemaining);

    if (initialRemaining <= 0) {
      // Si ya está expirado al montar, no disparamos onTimeout para evitar bucles
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        if (onTimeout) onTimeout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, limitMinutes, onTimeout]);

  if (timeLeft === null) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="countdown-timer" style={{ 
      fontSize: '1.2rem', 
      fontWeight: 'bold', 
      color: timeLeft < 60 ? '#d32f2f' : '#9a3412',
      fontFamily: 'monospace',
      background: timeLeft < 60 ? '#fee2e2' : '#ffedd5',
      padding: '4px 12px',
      borderRadius: '8px',
      display: 'inline-block',
      marginTop: '8px'
    }}>
      {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
    </div>
  );
};

export default CountdownTimer;
