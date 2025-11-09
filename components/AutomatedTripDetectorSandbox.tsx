import React, { useState, useRef } from 'react';
import type { SuggestedTrip } from '../types';

interface AutomatedTripDetectorSandboxProps {
    onTripDetected: (trip: SuggestedTrip) => void;
}

export const AutomatedTripDetectorSandbox: React.FC<AutomatedTripDetectorSandboxProps> = ({ onTripDetected }) => {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Ready to monitor your drives.');
    const monitorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getAddressFromCoords = async (lat: number, lon: number): Promise<string> => {
        // In a real app, you would use a Geocoding API. Here we simulate it.
        // For this example, we'll just return a placeholder.
        if (lat > -33.9) return "Sydney CBD";
        return "Botany Bay";
    };

    const handleToggleMonitoring = () => {
        if (isMonitoring) {
            // Stop monitoring
            if (monitorTimeoutRef.current) {
                clearTimeout(monitorTimeoutRef.current);
            }
            setIsMonitoring(false);
            setStatusMessage('Monitoring stopped.');
        } else {
            // Start monitoring
            setIsMonitoring(true);
            setStatusMessage('Monitoring for drives... Simulating a trip in 10 seconds.');

            monitorTimeoutRef.current = setTimeout(async () => {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 5000,
                            maximumAge: 0
                        });
                    });
                    
                    const startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago
                    const endTime = new Date();
                    const distance = Math.random() * 20 + 5; // 5-25 km
                    const startAddress = await getAddressFromCoords(position.coords.latitude, position.coords.longitude);
                    const endAddress = "Simulated Destination";

                    const newSuggestedTrip: SuggestedTrip = {
                        id: `sugg-${Date.now()}`,
                        startTime,
                        endTime,
                        distance,
                        startAddress,
                        endAddress,
                    };

                    onTripDetected(newSuggestedTrip);
                    setStatusMessage(`Detected a ${distance.toFixed(1)} km trip! Check Trip Manager.`);
                
                } catch (error) {
                    console.error("Geolocation error:", error);
                    setStatusMessage("Could not get location. Please enable permissions.");
                } finally {
                    setIsMonitoring(false); // Reset after simulation
                }
            }, 10000);
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 21l-4.95-6.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Automated Trip Detector</h2>
                    <p className="text-sm text-brand-gray-600">Proactively suggests trips to log.</p>
                </div>
            </div>

            <div className="mt-6 text-center">
                <button
                    onClick={handleToggleMonitoring}
                    className={`px-6 py-2 font-semibold rounded-md shadow-sm transition-colors w-full ${
                        isMonitoring 
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                >
                    {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring (Simulated)'}
                </button>
                <p className={`text-sm mt-3 ${isMonitoring ? 'text-brand-blue animate-pulse' : 'text-brand-gray-600'}`}>
                    {statusMessage}
                </p>
                 <p className="text-xs text-brand-gray-500 mt-2">
                    Note: This is a prototype. Clicking "Start" will simulate a detected trip after a 10-second delay.
                </p>
            </div>
        </div>
    );
};
