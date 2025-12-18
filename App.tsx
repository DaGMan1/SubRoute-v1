
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import type { User } from './types';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { SimpleRoutePlanner } from './components/SimpleRoutePlanner';
import { VehicleManager } from './components/VehicleManager';
import { TripLogbook } from './components/TripLogbook';
import { OdometerTracker } from './components/OdometerTracker';

type AppView = 'dashboard' | 'planner' | 'vehicles' | 'logbook' | 'odometer';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<AppView>('planner');
  const [showMenu, setShowMenu] = useState(false);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();

          const user: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: userData?.name || firebaseUser.displayName || 'User'
          };

          setCurrentUser(user);
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Fallback to basic user data
          setCurrentUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User'
          });
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (user: User) => {
      setCurrentUser(user);
  };

  const handleLogout = async () => {
      try {
        await signOut(auth);
        setCurrentUser(null);
        setCurrentView('planner');
      } catch (error) {
        console.error('Error signing out:', error);
      }
  };

  const handleNavigate = (view: AppView) => {
      setCurrentView(view);
  };

  if (loading) {
      return (
          <div className="bg-brand-gray-50 min-h-screen flex items-center justify-center p-4">
              <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto"></div>
                  <p className="mt-4 text-brand-gray-600">Loading...</p>
              </div>
          </div>
      );
  }

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

  const getViewTitle = () => {
    switch(currentView) {
      case 'planner': return 'Route Planner';
      case 'vehicles': return 'My Vehicles';
      case 'logbook': return 'Trip Info';
      case 'odometer': return 'Odometer Tracker';
      case 'dashboard': return 'Dashboard';
      default: return 'SubRoute';
    }
  };

  return (
    <div className="bg-brand-gray-100 min-h-screen flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-40 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3">
                   <div className="flex items-center space-x-3">
                     <div
                       className="flex items-center space-x-2 cursor-pointer"
                       onClick={() => setCurrentView('planner')}
                     >
                       <svg className="w-8 h-8 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                       <h1 className="text-2xl font-bold text-brand-gray-900">SubRoute</h1>
                     </div>
                     <span className="text-brand-gray-300 hidden sm:inline">|</span>
                     <div className="relative">
                       <button
                         onClick={() => setShowMenu(!showMenu)}
                         className="flex items-center space-x-2 text-brand-gray-700 hover:text-brand-blue font-medium transition-colors"
                       >
                         <span className="text-lg">{getViewTitle()}</span>
                         <svg className={`w-5 h-5 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                         </svg>
                       </button>

                       {showMenu && (
                         <>
                           <div
                             className="fixed inset-0 z-10"
                             onClick={() => setShowMenu(false)}
                           ></div>
                           <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-brand-gray-200 py-2 z-20">
                             <button
                               onClick={() => { setCurrentView('planner'); setShowMenu(false); }}
                               className={`w-full text-left px-4 py-2 hover:bg-brand-gray-50 transition-colors ${currentView === 'planner' ? 'bg-brand-gray-100 font-semibold text-brand-blue' : 'text-brand-gray-700'}`}
                             >
                               <div className="flex items-center space-x-3">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                                 <span>Route Planner</span>
                               </div>
                             </button>
                             <button
                               onClick={() => { setCurrentView('vehicles'); setShowMenu(false); }}
                               className={`w-full text-left px-4 py-2 hover:bg-brand-gray-50 transition-colors ${currentView === 'vehicles' ? 'bg-brand-gray-100 font-semibold text-brand-blue' : 'text-brand-gray-700'}`}
                             >
                               <div className="flex items-center space-x-3">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                                 <span>My Vehicles</span>
                               </div>
                             </button>
                             <button
                               onClick={() => { setCurrentView('logbook'); setShowMenu(false); }}
                               className={`w-full text-left px-4 py-2 hover:bg-brand-gray-50 transition-colors ${currentView === 'logbook' ? 'bg-brand-gray-100 font-semibold text-brand-blue' : 'text-brand-gray-700'}`}
                             >
                               <div className="flex items-center space-x-3">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                 <span>Trip Info</span>
                               </div>
                             </button>
                             <button
                               onClick={() => { setCurrentView('odometer'); setShowMenu(false); }}
                               className={`w-full text-left px-4 py-2 hover:bg-brand-gray-50 transition-colors ${currentView === 'odometer' ? 'bg-brand-gray-100 font-semibold text-brand-blue' : 'text-brand-gray-700'}`}
                             >
                               <div className="flex items-center space-x-3">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                 <span>Odometer Tracker</span>
                               </div>
                             </button>
                             <div className="border-t border-brand-gray-200 my-2"></div>
                             <button
                               className="w-full text-left px-4 py-2 text-brand-gray-400 cursor-not-allowed"
                               disabled
                             >
                               <div className="flex items-center space-x-3">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                 <span>Fuel & Expenses <span className="text-xs">(Coming Soon)</span></span>
                               </div>
                             </button>
                           </div>
                         </>
                       )}
                     </div>
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
          <SimpleRoutePlanner user={currentUser} />
        )}
        {currentView === 'vehicles' && (
          <VehicleManager user={currentUser} />
        )}
        {currentView === 'logbook' && (
          <TripLogbook user={currentUser} />
        )}
        {currentView === 'odometer' && (
          <OdometerTracker />
        )}
      </div>
    </div>
  );
};

export default App;
