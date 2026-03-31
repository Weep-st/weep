import React, { useState } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminEmails = () => {
    const [target, setTarget] = useState('usuarios');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!subject || !message) {
            toast.error('Asunto y mensaje son obligatorios');
            return;
        }

        setSending(true);
        const loading = toast.loading('Enviando emails...');

        try {
            const htmlBody = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff;">
                    <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" style="width: 100px; display: block; margin: 0 auto 20px;">
                    <h2 style="color: #6366f1; text-align: center;">${subject}</h2>
                    <div style="font-size: 16px; color: #333; line-height: 1.6;">
                        ${message.replace(/\n/g, '<br>')}
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
                        © ${new Date().getFullYear()} WEEP. Todos los derechos reservados.
                    </div>
                </div>
            `;

            const res = await api.adminSendBulkEmail({ target, subject, htmlBody });
            if (res.success) {
                toast.success(`Emails enviados a ${res.count} destinatarios!`, { id: loading });
                setSubject('');
                setMessage('');
            } else {
                toast.error(res.error || 'Error al enviar emails', { id: loading });
            }
        } catch (err) {
            toast.error('Error de conexión con el servidor', { id: loading });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="panel-card animate-fade-in" style={{ maxWidth: '800px' }}>
            <header className="panel-header">
                <h2>Panel de Marketing & Avisos</h2>
            </header>

            <form onSubmit={handleSend} className="admin-form">
                <div className="form-group">
                    <label>Enviar a:</label>
                    <select value={target} onChange={(e) => setTarget(e.target.value)} className="form-control">
                        <option value="usuarios">Todos los Usuarios</option>
                        <option value="locales">Todos los Locales</option>
                        <option value="repartidores">Todos los Repartidores</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Asunto:</label>
                    <input 
                        type="text" 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value)} 
                        className="form-control" 
                        placeholder="Ej: ¡Nueva promoción disponible! 🍔"
                    />
                </div>

                <div className="form-group">
                    <label>Mensaje (Soporta saltos de línea):</label>
                    <textarea 
                        value={message} 
                        onChange={(e) => setMessage(e.target.value)} 
                        className="form-control" 
                        placeholder="Escribe el contenido del email aquí..."
                        rows="10"
                    />
                </div>

                <button type="submit" className="btn btn-primary" disabled={sending} style={{ width: '100%', marginTop: '1rem' }}>
                    {sending ? 'Enviando...' : '🚀 Enviar Ahora'}
                </button>
            </form>

            <style>{`
                .admin-form .form-group { margin-bottom: 1.5rem; }
                .admin-form label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #94a3b8; font-weight: 500; }
                .admin-form .form-control {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border-radius: 0.75rem;
                    background: rgba(15, 23, 42, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    font-size: 1rem;
                    transition: border-color 0.2s;
                }
                .admin-form .form-control:focus {
                    outline: none;
                    border-color: #6366f1;
                    background: rgba(15, 23, 42, 0.7);
                }
            `}</style>
        </div>
    );
};

export default AdminEmails;
