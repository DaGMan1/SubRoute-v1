import React, { useState } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { User } from '../types';

interface AuthProps {
    onLoginSuccess: (user: User) => void;
}

type AuthMode = 'login' | 'register';

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

    const createUserDocument = async (firebaseUser: any, additionalData: any = {}) => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
            const { email, displayName } = firebaseUser;
            const createdAt = new Date();

            try {
                await setDoc(userRef, {
                    email,
                    name: displayName || additionalData.name || '',
                    abn: additionalData.abn || '',
                    createdAt,
                    ...additionalData
                });
            } catch (error) {
                console.error('Error creating user document:', error);
            }
        }

        return userRef;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            const userData = userDoc.data();

            const user: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: userData?.name || firebaseUser.displayName || 'User'
            };

            onLoginSuccess(user);
            resetForm();

        } catch (err: any) {
            console.error('Login error:', err);
            if (err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/user-not-found') {
                setError('No account found with this email.');
            } else if (err.code === 'auth/wrong-password') {
                setError('Invalid password.');
            } else {
                setError(err.message || 'Login failed.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long.');
            }

            // Create Firebase user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // Update display name
            await updateProfile(firebaseUser, {
                displayName: name.trim()
            });

            // Create user document in Firestore
            await createUserDocument(firebaseUser, {
                name: name.trim(),
                abn: abn.trim()
            });

            const user: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: name.trim()
            };

            onLoginSuccess(user);
            resetForm();

        } catch (err: any) {
            console.error('Registration error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists.');
            } else if (err.code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password is too weak. Please use at least 8 characters.');
            } else {
                setError(err.message || 'Registration failed.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;

            // Create or get user document
            await createUserDocument(firebaseUser);

            // Get user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            const userData = userDoc.data();

            const user: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: userData?.name || firebaseUser.displayName || 'User'
            };

            onLoginSuccess(user);
            resetForm();

        } catch (err: any) {
            console.error('Google sign-in error:', err);
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Sign-in cancelled.');
            } else if (err.code === 'auth/popup-blocked') {
                setError('Pop-up blocked. Please allow pop-ups for this site.');
            } else {
                setError(err.message || 'Google sign-in failed.');
            }
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
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center px-4 py-2 border border-brand-gray-300 rounded-md shadow-sm text-sm font-medium text-brand-gray-700 bg-white hover:bg-brand-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:opacity-50"
                    >
                         <svg className="w-5 h-5 mr-3" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 172.9 56.5l-69.5 69.5c-23.6-21.5-55.2-34.6-92.3-34.6-69.5 0-126.5 57.2-126.5 128s57 128 126.5 128c78.8 0 112.3-52.5 115.8-78.2H248V261.8h239.2z"></path></svg>
                        Sign in with Google
                    </button>

                    <p className="text-xs text-center text-gray-500 mt-4">
                        Other sign-in options (Facebook, Apple, etc.) coming soon
                    </p>
                </div>
            </div>
        </div>
    );
};
