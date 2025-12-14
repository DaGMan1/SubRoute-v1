
import React, { useState } from 'react';
import type { User } from '../types';

interface AuthProps {
    onLoginSuccess: (user: User) => void;
}

type AuthMode = 'login' | 'register';
type AuthProvider = 'google' | 'facebook' | 'tiktok' | 'microsoft' | 'apple';

// Mock storage keys
const STORAGE_KEY_USERS = 'subroute_users';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to safely get users from storage
const getStoredUsers = (): any[] => {
    try {
        const usersRaw = localStorage.getItem(STORAGE_KEY_USERS);
        const parsed = usersRaw ? JSON.parse(usersRaw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("Error parsing user database", e);
        return [];
    }
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [abn, setAbn] = useState('');

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
            // Simulate API call delay for realism
            await delay(800);

            const users = getStoredUsers();
            const cleanEmail = email.trim().toLowerCase();
            
            // Basic validation
            const user = users.find((u: any) => u.email.toLowerCase() === cleanEmail && u.password === password);

            if (!user) {
                throw new Error('Invalid email or password.');
            }

            // Remove password before returning
            const { password: _, ...userWithoutPassword } = user;
            onLoginSuccess(userWithoutPassword);
            resetForm();

        } catch (err: any) {
            setError(err.message || 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Simulate API call delay
            await delay(800);

            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long.');
            }

            const users = getStoredUsers();
            const cleanEmail = email.trim().toLowerCase();

            if (users.find((u: any) => u.email.toLowerCase() === cleanEmail)) {
                throw new Error('An account with this email already exists.');
            }

            const newUser = {
                id: Date.now().toString(),
                name: name.trim(),
                email: cleanEmail,
                password,
                abn: abn.trim()
            };

            users.push(newUser);
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));

            const { password: _, ...userWithoutPassword } = newUser;
            onLoginSuccess(userWithoutPassword);
            resetForm();

        } catch (err: any) {
            setError(err.message || 'Registration failed.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleOAuthSignIn = async (provider: AuthProvider) => {
        setIsLoading(true);
        setError('');
        try {
            await delay(1500); // Simulate popup and redirect

             const mockUsers = {
                google: { email: 'driver@google.com', name: 'Alex Doe (Google)', provider: 'google', providerId: '10987654321' },
                facebook: { email: 'driver@facebook.com', name: 'Alex Doe (Facebook)', provider: 'facebook', providerId: '20987654321' },
                tiktok: { email: 'driver@tiktok.com', name: 'Alex Doe (TikTok)', provider: 'tiktok', providerId: '30987654321' },
                microsoft: { email: 'driver@outlook.com', name: 'Alex Doe (Microsoft)', provider: 'microsoft', providerId: '40987654321' },
                apple: { email: 'driver@apple.com', name: 'Alex Doe (Apple)', provider: 'apple', providerId: '50987654321' },
            };
            const mockUser = { ...mockUsers[provider], id: Date.now().toString() };

            onLoginSuccess(mockUser);
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


    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
             <div className="max-w-md mx-auto">
                <div className="bg-brand-gray-100 p-1.5 rounded-lg flex space-x-2 mb-6">
                    <button onClick={() => handleModeChange('login')} className={tabClasses('login')}>
                        Login
                    </button>
                    <button onClick={() => handleModeChange('register')} className={tabClasses('register')}>
                        Register
                    </button>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4 text-center" role="alert">{error}</p>}

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
                                autoComplete="email"
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
                                autoComplete="current-password"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400 disabled:cursor-not-allowed"
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
                                autoComplete="name"
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
                                autoComplete="email"
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
                                autoComplete="new-password"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>
                )}
                
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-brand-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-brand-gray-500">Or</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <button type="button" onClick={() => handleOAuthSignIn('google')} disabled={isLoading} className="w-full flex items-center justify-center px-4 py-2 border border-brand-gray-300 rounded-md shadow-sm text-sm font-medium text-brand-gray-700 bg-white hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50">
                         <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.9 56.5l-69.5 69.5c-23.6-21.5-55.2-34.6-92.3-34.6-69.5 0-126.5 57.2-126.5 128s57 128 126.5 128c78.8 0 112.3-52.5 115.8-78.2H248V261.8h239.2z"></path></svg>
                        Sign in with Google
                    </button>
                     <button type="button" onClick={() => handleOAuthSignIn('facebook')} disabled={isLoading} className="w-full flex items-center justify-center px-4 py-2 border border-brand-gray-300 rounded-md shadow-sm text-sm font-medium text-brand-gray-700 bg-white hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50">
                        <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#1877F2" d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"></path></svg>
                        Sign in with Facebook
                    </button>
                    <button type="button" onClick={() => handleOAuthSignIn('tiktok')} disabled={isLoading} className="w-full flex items-center justify-center px-4 py-2 border border-brand-gray-300 rounded-md shadow-sm text-sm font-medium text-brand-gray-700 bg-white hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50">
                         <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"></path></svg>
                        Sign in with TikTok
                    </button>
                    <button type="button" onClick={() => handleOAuthSignIn('microsoft')} disabled={isLoading} className="w-full flex items-center justify-center px-4 py-2 border border-brand-gray-300 rounded-md shadow-sm text-sm font-medium text-brand-gray-700 bg-white hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50">
                         <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="#F25022" d="M0 0h210v210H0z"/><path fill="#7FBA00" d="M238 0h210v210H238z"/><path fill="#00A4EF" d="M0 238h210v210H0z"/><path fill="#FFB900" d="M238 238h210v210H238z"/></svg>
                        Sign in with Outlook (Microsoft)
                    </button>
                     <button type="button" onClick={() => handleOAuthSignIn('apple')} disabled={isLoading} className="w-full flex items-center justify-center px-4 py-2 border border-brand-gray-300 rounded-md shadow-sm text-sm font-medium text-brand-gray-700 bg-white hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50">
                        <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C34 140.7 0 175.1 0 243.2c0 65.7 60.7 124.3 124.3 124.3 22.2 0 41.5-1.7 53.4-4.8 11.9 3.1 22.9 4.8 33.1 4.8 21.2 0 43.6-7.2 66.8-14.3-36.7-22.3-54.3-64.5-54.3-102.8zM243.8 102.4c14.4-13.4 24.9-32.5 24.9-54.2 0-24.5-20.6-44.4-47.9-44.4-23.5 0-44.4 16.6-54.5 39.5-15.5-24.3-43.9-39.5-74.4-39.5C53.5 3.8 16 34.8 16 79.4c0 30.6 23.5 54.2 53.4 54.2 22.9 0 42.1-13.4 54.5-31.5 15.6 24.3 42.1 31.5 69.5 31.5 22.2 0 46.1-10.4 50.4-11.2z"></path></svg>
                        Sign in with Apple
                    </button>
                </div>
            </div>
        </div>
    );
};
