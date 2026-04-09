import React, { useState, useEffect, useRef } from 'react';
import './HelpChatbot.css';

const ASSISTANT_IMAGE = "https://i.postimg.cc/NF3Kf3p6/Gemini-Generated-Image-jlkkysjlkkysjlkk-(2).png";
const WHATSAPP_NUMBER = "5493764275443";

const HelpChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "¡Hola! 👋 Soy tu asistente de Weep. ¿En qué puedo ayudarte hoy?", isBot: true }
  ]);
  const [showButtons, setShowButtons] = useState(true);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleOptionClick = (option) => {
    const userMsg = { id: Date.now(), text: option.label, isBot: false };
    setMessages(prev => [...prev, userMsg]);
    setShowButtons(false);

    setTimeout(() => {
      let botResponse = "";
      let action = null;

      switch (option.id) {
        case 'dev':
          botResponse = "Entiendo. Para gestionar la devolución de un pedido rechazado, te derivaré con nuestro equipo de reembolsos por WhatsApp.";
          action = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola, necesito gestionar la devolucion de un pedido rechazado.`, '_blank');
          break;
        case 'no_llego':
          botResponse = "Lamento escuchar eso. Por favor, indícame tu número de pedido por WhatsApp para que podamos contactar al repartidor de inmediato.";
          action = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola, mi pedido no ha llegado. Necesito ayuda.`, '_blank');
          break;
        case 'seguimiento':
          botResponse = "Podés ver la ubicación de tu repartidor ingresando a 'Mis Pedidos', seleccionando tu pedido activo y presionando en 'Ver Seguimiento'.";
          break;
        case 'sugerencias':
          botResponse = "¡Nos encanta escucharte! Por favor, envíanos tu sugerencia por WhatsApp para que podamos seguir mejorando Weep.";
          action = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola, tengo una sugerencia para mejorar Weep: `, '_blank');
          break;
        case 'pago':
          botResponse = "Si tuviste problemas con Mercado Pago o transferencia, por favor envíanos una captura del comprobante por WhatsApp para verificarlo.";
          action = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola, tuve un problema con el pago de mi pedido.`, '_blank');
          break;
        case 'local':
          botResponse = "¡Excelente! Puedes registrar tu local ingresando a weep.com.ar/locales y siguiendo los pasos de registro.";
          break;
        case 'soporte':
          botResponse = "Para cualquier otro inconveniente técnico o duda, podés escribirnos directamente aquí.";
          action = () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=Hola, necesito soporte con la plataforma Weep.`, '_blank');
          break;
        default:
          botResponse = "Un representante se pondrá en contacto contigo a la brevedad via WhatsApp.";
      }

      const botMsg = { id: Date.now() + 1, text: botResponse, isBot: true };
      setMessages(prev => [...prev, botMsg]);
      
      if (action) {
        setTimeout(action, 1500);
      }
      
      setTimeout(() => setShowButtons(true), 2000);
    }, 1000);
  };

  const options = [
    { id: 'dev', label: '💸 Gestionar devolución' },
    { id: 'no_llego', label: '🛵 Mi pedido no llegó' },
    { id: 'seguimiento', label: '📍 Seguimiento en tiempo real' },
    { id: 'sugerencias', label: '💡 Sugerencias de mejora' },
    { id: 'pago', label: '💳 Problemas con el pago' },
    { id: 'local', label: '🏪 Registrar mi local' },
    { id: 'soporte', label: '🛠️ Soporte técnico' },
  ];

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : ''}`}>
      {!isOpen && (
        <button className="chatbot-toggle" onClick={() => setIsOpen(true)}>
          <img src={ASSISTANT_IMAGE} alt="Ayuda" />
          <span className="toggle-badge">Ayuda</span>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="assistant-info">
              <img src={ASSISTANT_IMAGE} alt="Assistant" />
              <div>
                <h4>Asistente Weep</h4>
                <span>En línea</span>
              </div>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="chatbot-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.isBot ? 'bot' : 'user'}`}>
                {msg.isBot && <img src={ASSISTANT_IMAGE} className="msg-avatar" alt="bot" />}
                <div className="message-text">{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {showButtons && (
            <div className="chatbot-options">
              {options.map(opt => (
                <button key={opt.id} onClick={() => handleOptionClick(opt)}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HelpChatbot;
