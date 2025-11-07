
import React, { useState } from 'react';

type AuthMode = 'login' | 'register';

export const AuthSandbox: React.FC = () => {
    const [mode, setMode] = useState<AuthMode>('login');
    
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Login submitted");
        // Here we would call the auth service
    };

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Register submitted");
        // Here we would call the auth service
    };

    const tabClasses = (tabMode: AuthMode) => 
        `px-4 py-2 text-sm font-semibold w-full rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
            mode === tabMode 
            ? 'bg-brand-blue text-white shadow' 
            : 'text-brand-gray-600 hover:bg-brand-gray-200'
        }`;

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
                    <button onClick={() => setMode('login')} className={tabClasses('login')}>
                        Login
                    </button>
                    <button onClick={() => setMode('register')} className={tabClasses('register')}>
                        Register
                    </button>
                </div>

                {mode === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-brand-gray-700 mb-1">Email Address</label>
                            <input 
                                type="email" 
                                id="login-email"
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
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="••••••••"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue"
                        >
                            Sign In
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
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="Australian Business Number"
                            />
                        </div>
                        <div>
                            <label htmlFor="register-password" className="block text-sm font-medium text-brand-gray-700 mb-1">Password</label>
                            <input 
                                type="password" 
                                id="register-password"
                                required
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder="Minimum 8 characters"
                            />
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue"
                        >
                            Create Account
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
