import React, { useState, useEffect } from 'react';
import type { User } from '../types';
import { VehicleManager } from './VehicleManager';
import { OdometerTracker } from './OdometerTracker';
import { getUserPreferences, saveUserPreferences } from '../lib/firestore';

interface SettingsProps {
  user: User;
}

type SettingsTab = 'vehicles' | 'odometer' | 'navigation' | 'account';

export const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('vehicles');
  const [preferredNavApp, setPreferredNavApp] = useState<'google' | 'waze'>('google');
  const [savingNavPref, setSavingNavPref] = useState(false);

  // Load navigation preference on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const prefs = await getUserPreferences(user.id);
        if (prefs.preferredNavApp) {
          setPreferredNavApp(prefs.preferredNavApp);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPrefs();
  }, [user.id]);

  // Save navigation preference
  const saveNavPreference = async (app: 'google' | 'waze') => {
    setSavingNavPref(true);
    setPreferredNavApp(app);
    try {
      await saveUserPreferences(user.id, { preferredNavApp: app });
    } catch (error) {
      console.error('Error saving navigation preference:', error);
    }
    setSavingNavPref(false);
  };

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-4">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-600 mt-1">Manage your account and vehicle settings</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex space-x-1 px-4">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'vehicles'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path>
              </svg>
              <span>Vehicles</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('odometer')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'odometer'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span>Odometer & Fuel</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('navigation')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'navigation'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
              </svg>
              <span>Navigation</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'account'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              <span>Account</span>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'vehicles' && <VehicleManager user={user} />}
        {activeTab === 'odometer' && <OdometerTracker user={user} />}
        {activeTab === 'navigation' && (
          <div className="p-6">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Preferred Navigation App</h3>
              <p className="text-sm text-gray-600 mb-6">
                Choose your preferred navigation app. When you select an address and tap Pickup or Delivery, the app will automatically open for navigation.
              </p>

              <div className="space-y-3">
                {/* Google Maps Option */}
                <button
                  onClick={() => saveNavPreference('google')}
                  disabled={savingNavPref}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center space-x-4 ${
                    preferredNavApp === 'google'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    preferredNavApp === 'google' ? 'bg-green-500' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-6 h-6 ${preferredNavApp === 'google' ? 'text-white' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-semibold ${preferredNavApp === 'google' ? 'text-green-900' : 'text-gray-900'}`}>
                      Google Maps
                    </p>
                    <p className={`text-sm ${preferredNavApp === 'google' ? 'text-green-700' : 'text-gray-500'}`}>
                      Standard navigation with traffic updates
                    </p>
                  </div>
                  {preferredNavApp === 'google' && (
                    <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>

                {/* Waze Option */}
                <button
                  onClick={() => saveNavPreference('waze')}
                  disabled={savingNavPref}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center space-x-4 ${
                    preferredNavApp === 'waze'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    preferredNavApp === 'waze' ? 'bg-blue-500' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-6 h-6 ${preferredNavApp === 'waze' ? 'text-white' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-semibold ${preferredNavApp === 'waze' ? 'text-blue-900' : 'text-gray-900'}`}>
                      Waze
                    </p>
                    <p className={`text-sm ${preferredNavApp === 'waze' ? 'text-blue-700' : 'text-gray-500'}`}>
                      Community-powered with real-time alerts
                    </p>
                  </div>
                  {preferredNavApp === 'waze' && (
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Quick Navigation Flow</p>
                      <p className="text-blue-800">When you select an address and tap Pickup or Delivery, your preferred navigation app will open automatically - no extra taps needed!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'account' && (
          <div className="p-6">
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{user.name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{user.email}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">User ID</label>
                  <p className="text-xs font-mono text-gray-600 mt-1">{user.id}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">About Settings</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm text-blue-900">
                      <p className="font-medium mb-1">Vehicle and odometer settings are stored here for security.</p>
                      <p className="text-blue-800">Drivers who share your vehicle will only see Route Planner and Trip Log - they won't be able to modify vehicle settings or clear trip history.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
