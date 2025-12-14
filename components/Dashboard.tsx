
import React from 'react';
import type { User } from '../types';

interface DashboardProps {
    user: User;
    onNavigate: (view: 'dashboard' | 'planner' | 'vehicles' | 'logbook' | 'odometer') => void;
}

// FIX: Changed JSX.Element to React.ReactNode to resolve typescript error "Cannot find namespace 'JSX'".
const FeatureCard: React.FC<{ 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    comingSoon?: boolean;
    onClick?: () => void;
    actionLabel?: string;
}> = ({ title, description, icon, comingSoon, onClick, actionLabel = "Launch" }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200 flex flex-col justify-between relative hover:shadow-md transition-shadow duration-200">
        {comingSoon && <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">COMING SOON</div>}
        <div>
            <div className="flex items-center space-x-4 mb-3">
                <div className="bg-brand-blue/10 p-3 rounded-full">
                    {icon}
                </div>
                <h3 className="text-lg font-bold text-brand-gray-800">{title}</h3>
            </div>
            <p className="text-brand-gray-600 text-sm">{description}</p>
        </div>
        <button 
            onClick={onClick}
            disabled={comingSoon}
            className={`mt-6 w-full font-semibold px-4 py-2 rounded-md transition-colors ${
                comingSoon 
                ? 'bg-brand-gray-200 text-brand-gray-500 cursor-not-allowed' 
                : 'bg-brand-blue text-white hover:bg-blue-700 shadow-sm'
            }`}
        >
            {actionLabel}
        </button>
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
    const features = [
        { 
            title: 'Route Planner', 
            description: 'Optimize your daily routes and save time on the road.', 
            icon: <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>,
            comingSoon: false,
            onClick: () => onNavigate('planner'),
            actionLabel: "Open Planner"
        },
        { 
            title: 'My Vehicles', 
            description: 'Manage your vehicle details, maintenance, and records.', 
            icon: <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6"></path></svg>,
            comingSoon: false,
            onClick: () => onNavigate('vehicles'),
            actionLabel: "Manage Fleet"
        },
        { 
            title: 'Trip Logbook', 
            description: 'Automatically track your trips for ATO compliance.', 
            icon: <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>,
            comingSoon: false,
            onClick: () => onNavigate('logbook'),
            actionLabel: "View Logbook"
        },
        {
            title: 'Odometer & Fuel',
            description: 'Track odometer readings, fuel economy, and service reminders.',
            icon: <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>,
            comingSoon: false,
            onClick: () => onNavigate('odometer'),
            actionLabel: "Track Odometer"
        },
        {
            title: 'Expense Tracker',
            description: 'Log fuel, maintenance, and other business expenses.',
            icon: <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>,
            comingSoon: true
        },
    ];

    return (
        <main className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8 border-b border-brand-gray-200 pb-5">
                    <h2 className="text-3xl font-bold text-brand-gray-800">Dashboard</h2>
                    <p className="mt-1 text-brand-gray-600">Welcome back, {user.name}. Here's your toolkit.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {features.map((feature) => (
                        <FeatureCard key={feature.title} {...feature} />
                    ))}
                </div>
            </div>
      </main>
    );
};
