
import React, { useState } from 'react';
import type { User } from '../types';

interface AuthSandboxProps {
    onLoginSuccess: (user: User) => void;
    currentUser: User | null;
    onLogout: () => void;
}

type AuthMode = 'login' | 'register';

export const AuthSandbox: React.FC<AuthSandboxProps> = ({ onLoginSuccess, currentUser, onLogout }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [abn, setAbn] = useState('');

    const API_BASE_URL = '/api';

    const resetForm = () => {
        setName('');
        setEmail('');
        setPassword('');
        setAbn('');
        setError('');
    };

    const handleModeChange = (newMode: AuthMode) => {
        setMode(newMode);
        resetForm();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            onLoginSuccess(data);
            resetForm();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, abn }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }
            onLoginSuccess(data);
            resetForm();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const tabClasses = (tabMode: AuthMode) => 
        `px-4 py-2 text-sm font-semibold w-full rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
            mode === tabMode 
            ? 'bg-brand-blue text-white shadow' 
            : 'text-brand-gray-600 hover:bg-brand-gray-200'
        }`;

    if (currentUser) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
                <div className="flex items-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div>
                        <h2 className="text-xl font-bold text-brand-gray-800">Welcome, {currentUser.name}</h2>
                        <p className="text-sm text-brand-gray-600">You are successfully logged in.</p>
                    </div>
                </div>
                <button 
                    onClick={onLogout}
                    className="w-full mt-4 bg-brand-gray-600 text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-brand-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-gray-500"
                >
                    Logout
                </button>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Component: Authentication</h2>
                    <p className="text-sm text-brand-gray-600">Implements **Story 1.1**: User registration and login UI.</p>
                </div>
            </div>

            <div className="max-w-md mx-auto mt-6">
                <div className="bg-brand-gray-100 p-1.5 rounded-lg flex space-x-2 mb-6">
                    <button onClick={() => handleModeChange('login')} className={tabClasses('login')}>
                        Login
                    </button>
                    <button onClick={() => handleModeChange('register')} className={tabClasses('register')}>
                        Register
                    </button>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4 text-center">{error}</p>}

                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-brand-gray-700 mb-1">Email Address</label>
                            <input 
                                type="email" 
                                id="login-email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label htmlFor="login-password" className="block text-sm font-medium text-brand-gray-700 mb-1">Password</label>
                            <input 
                                type="password" 
                                id="login-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="••••••••"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400"
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </button>
                    </form>
                )}

                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                         <div>
                            <label htmlFor="register-name" className="block text-sm font-medium text-brand-gray-700 mb-1">Full Name</label>
                            <input 
                                type="text" 
                                id="register-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label htmlFor="register-email" className="block text-sm font-medium text-brand-gray-700 mb-1">Email Address</label>
                            <input 
                                type="email" 
                                id="register-email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="you@example.com"
                            />
                        </div>
                         <div>
                            <label htmlFor="register-abn" className="block text-sm font-medium text-brand-gray-700 mb-1">ABN (Optional)</label>
                            <input 
                                type="text" 
                                id="register-abn"
                                value={abn}
                                onChange={e => setAbn(e.target.value)}
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="Australian Business Number"
                            />
                        </div>
                        <div>
                            <label htmlFor="register-password" className="block text-sm font-medium text-brand-gray-700 mb-1">Password</label>
                            <input 
                                type="password" 
                                id="register-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="Minimum 8 characters"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400"
                        >
                            {isLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
