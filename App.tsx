
import React, { useState } from 'react';
import type { User } from './types';
import { Auth } from './components/AuthSandbox';
import { Dashboard } from './components/Dashboard';
import { RoutePlanner } from './components/RoutePlannerSandbox';
import { VehicleManager } from './components/VehicleManagerSandbox';
import { TripLogbook } from './components/TripLogbookSandbox';

type AppView = 'dashboard' | 'planner' | 'vehicles' | 'logbook';

const App: React.FC = () => {
  // Initialize state lazily to check localStorage *before* the first render.
  // This prevents the "flash" of the login screen when you refresh the page.
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedSession = localStorage.getItem('subroute_session');
      if (savedSession) {
        return JSON.parse(savedSession);
      }
    } catch (e) {
      console.error('Failed to parse session:', e);
      localStorage.removeItem('subroute_session');
    }
    return null;
  });

  const [currentView, setCurrentView] = useState<AppView>('dashboard');

  const handleLoginSuccess = (user: User) => {
      try {
        localStorage.setItem('subroute_session', JSON.stringify(user));
        setCurrentUser(user);
      } catch (e) {
        console.error('Failed to save session:', e);
        // Still set the user in memory so they can use the app
        setCurrentUser(user);
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('subroute_session');
      setCurrentUser(null);
      setCurrentView('dashboard');
  };

  const handleNavigate = (view: AppView) => {
      setCurrentView(view);
  };

  if (!currentUser) {
      return (
          <div className="bg-brand-gray-50 min-h-screen flex items-center justify-center p-4">
              <div className="w-full max-w-lg">
                   <header className="text-center mb-8">
                       <div className="flex items-center justify-center space-x-3">
                         <svg className="w-10 h-10 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                         <h1 className="text-4xl font-bold text-brand-gray-900">SubRoute</h1>
                       </div>
                       <p className="text-brand-gray-600 mt-2">The toolkit for Australian courier drivers.</p>
                   </header>
                  <Auth onLoginSuccess={handleLoginSuccess} />
              </div>
          </div>
      );
  }

  return (
    <div className="bg-brand-gray-100 min-h-screen flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-40 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3">
                   <div 
                     className="flex items-center space-x-3 cursor-pointer" 
                     onClick={() => setCurrentView('dashboard')}
                   >
                     <svg className="w-8 h-8 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                     <h1 className="text-2xl font-bold text-brand-gray-900">SubRoute</h1>
                   </div>
                   <div className="flex items-center space-x-4">
                       <span className="text-sm text-brand-gray-700 hidden sm:inline">Welcome, <span className="font-semibold">{currentUser.name}</span></span>
                       <button onClick={handleLogout} className="text-sm font-semibold text-brand-blue hover:underline">Logout</button>
                   </div>
              </div>
          </div>
      </header>
      
      <div className="flex-grow relative">
        {currentView === 'dashboard' && (
          <Dashboard user={currentUser} onNavigate={handleNavigate} />
        )}
        {currentView === 'planner' && (
          <RoutePlanner onBack={() => setCurrentView('dashboard')} />
        )}
        {currentView === 'vehicles' && (
          <VehicleManager user={currentUser} onBack={() => setCurrentView('dashboard')} />
        )}
        {currentView === 'logbook' && (
          <TripLogbook onBack={() => setCurrentView('dashboard')} />
        )}
      </div>
    </div>
  );
};

export default App;
