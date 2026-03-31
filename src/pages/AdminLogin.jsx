import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminLogin = () => {
    const { loginAsUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        setLoading(true);

        try {
            const d = await api.loginUsuario(fd.get('email'), fd.get('password'));
            if (d.success) {
                if (d.role === 'admin') {
                    loginAsUser(d);
                    toast.success('Acceso concedido');
                } else {
                    toast.error('No tienes permisos de administrador');
                }
            } else {
                toast.error('Credenciales inválidas');
            }
        } catch (err) {
            toast.error('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-login-page">
            <div className="login-card animate-fade-in">
                <img src="https://i.postimg.cc/5tKhqD4z/Chat-GPT-Image-Feb-23-2026-12-10-45-PM-(5).png" alt="Weep" className="login-logo" />
                <h1>WEEP Admin</h1>
                <p>Ingresa tus credenciales para gestionar la plataforma</p>
                
                <form onSubmit={handleSubmit} className="admin-form">
                    <div className="form-group">
                        <label>Email Corporativo</label>
                        <input type="email" name="email" required className="form-control" placeholder="admin@weep.com.ar" />
                    </div>
                    <div className="form-group">
                        <label>Contraseña</label>
                        <input type="password" name="password" required className="form-control" placeholder="••••••••" />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
                        {loading ? 'Verificando...' : 'Entrar al Panel'}
                    </button>
                </form>
            </div>

            <style>{`
                .admin-login-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #0f172a;
                    color: white;
                    padding: 2rem;
                }
                .login-card {
                    background: rgba(30, 41, 59, 0.7);
                    backdrop-filter: blur(10px);
                    padding: 3rem;
                    border-radius: 2rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    width: 100%;
                    max-width: 450px;
                    text-align: center;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .login-logo { width: 80px; margin-bottom: 1.5rem; }
                .login-card h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.5rem; }
                .login-card p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }
            `}</style>
        </div>
    );
};

export default AdminLogin;
