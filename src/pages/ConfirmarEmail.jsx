import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './Landing.css';

export default function ConfirmarEmail() {
  const [status, setStatus] = useState('input'); // 'input', 'verificando', 'success', 'error'
  const [message, setMessage] = useState('');
  const [tipo, setTipo] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get('tipo');
    const e = params.get('email');
    setTipo(t || '');
    setEmail(e || '');

    if (!t || !e) {
      setStatus('error');
      setMessage('El enlace de confirmación está incompleto. Por favor, asegúrate de abrir el link desde tu email.');
    }
  }, [location]);

  const handleInputChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus next
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pasteData)) return;

    const newCode = [...code];
    pasteData.split('').forEach((char, i) => {
      if (i < 6) newCode[i] = char;
    });
    setCode(newCode);

    const nextIndex = Math.min(pasteData.length, 5);
    inputRefs.current[nextIndex].focus();
  };

  const handleConfirm = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      toast.error('Por favor, ingresá los 6 dígitos');
      return;
    }

    setStatus('verificando');
    try {
      const res = await api.confirmarEmail(fullCode, tipo, email);
      if (res.success) {
        setStatus('success');
        setMessage('¡Tu email ha sido confirmado con éxito!');
        
        const mapping = {
          'usuario': 'userEmailConfirmado',
          'local': 'localEmailConfirmado',
          'repartidor': 'driverEmailConfirmado'
        };
        if (mapping[tipo]) {
          localStorage.setItem(mapping[tipo], 'true');
        }
      } else {
        setStatus('input');
        toast.error(res.error || 'Código incorrecto');
      }
    } catch (err) {
      setStatus('input');
      toast.error('Error de conexión');
    }
  };

  const handleGoHome = () => {
    const path = tipo === 'local' ? '/locales' : tipo === 'repartidor' ? '/repartidores' : '/pedir';
    navigate(path);
  };

  const handleResend = async () => {
    if (!email || !tipo) return;
    const loading = toast.loading('Reenviando código...');
    try {
      const res = await api.reenviarEmailConfirmacion(email, tipo);
      if (res.success) toast.success('¡Código reenviado!', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  return (
    <div className="landing-page" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: 'var(--gray-50)',
      padding: '20px'
    }}>
      <div className="card animate-fade-in" style={{ 
        maxWidth: '450px', 
        width: '100%', 
        padding: '40px', 
        textAlign: 'center',
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.08)'
      }}>
        <img 
          src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" 
          alt="Weep" 
          style={{ width: '100px', marginBottom: '30px' }} 
        />
        
        {status === 'input' && (
          <>
            <h2 style={{ color: 'var(--gray-900)', fontSize: '1.5rem', marginBottom: '10px' }}>Verifica tu Email</h2>
            <p style={{ color: 'var(--gray-600)', marginBottom: '30px', fontSize: '0.95rem' }}>
              Enviamos un código de 6 dígitos a <br/><strong>{email}</strong>
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '30px' }} onPaste={handlePaste}>
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => inputRefs.current[idx] = el}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  style={{
                    width: '45px',
                    height: '55px',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    border: '2px solid var(--gray-200)',
                    borderRadius: '12px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    background: 'var(--gray-50)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--red-500)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--gray-200)'}
                />
              ))}
            </div>

            <button 
              className="btn btn-primary btn-full" 
              onClick={handleConfirm}
              style={{ padding: '15px', fontSize: '1rem' }}
            >
              Confirmar Código
            </button>
            
            <p style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              ¿No recibiste nada? <button onClick={handleResend} style={{ background: 'none', border: 'none', color: 'var(--red-600)', fontWeight: 600, cursor: 'pointer' }}>Reenviar</button>
            </p>
          </>
        )}

        {status === 'verificando' && (
          <div style={{ padding: '40px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 20px', width: '40px', height: '40px' }} />
            <p style={{ color: 'var(--gray-600)' }}>Verificando código...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="success-state animate-fade-in">
            <div style={{ 
              width: '70px', height: '70px', background: '#e6f4ea', color: '#1e8e3e', 
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '35px', margin: '0 auto 25px' 
            }}>✓</div>
            <h2 style={{ color: 'var(--gray-900)', marginBottom: '10px' }}>¡Email Confirmado!</h2>
            <p style={{ color: 'var(--gray-600)', marginBottom: '35px' }}>{message}</p>
            <button className="btn btn-primary btn-full" onClick={handleGoHome} style={{ padding: '15px' }}>
              Comenzar a usar Weep
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="error-state animate-fade-in">
            <div style={{ 
              width: '70px', height: '70px', background: '#fce8e6', color: '#d93025', 
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: '35px', margin: '0 auto 25px' 
            }}>!</div>
            <h2 style={{ color: 'var(--gray-900)', marginBottom: '10px' }}>Datos Imcompletos</h2>
            <p style={{ color: 'var(--gray-600)', marginBottom: '35px' }}>{message}</p>
            <button className="btn btn-secondary btn-full" onClick={handleGoHome} style={{ padding: '15px' }}>
              Volver al Inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
