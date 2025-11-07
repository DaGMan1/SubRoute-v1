
import React, { useState } from 'react';
import type { FavoritePlace } from '../types';

export const FavoritePlacesSandbox: React.FC = () => {
    const [places, setPlaces] = useState<FavoritePlace[]>([
        { id: '1', name: 'Home', address: '42 Wallaby Way, Sydney, NSW', isHome: true },
        { id: '2', name: 'Main Depot', address: '123 Industrial Ave, Botany, NSW', isHome: false },
        { id: '3', name: 'Client Warehouse', address: '456 Distribution Rd, Huntingwood, NSW', isHome: false },
    ]);
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');

    const handleAddPlace = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !address) return;
        
        const newPlace: FavoritePlace = {
            id: Date.now().toString(),
            name,
            address,
            isHome: places.length === 0,
        };
        setPlaces([...places, newPlace]);
        setName('');
        setAddress('');
    };
    
    const handleSetHome = (id: string) => {
        setPlaces(places.map(p => ({
            ...p,
            isHome: p.id === id,
        })));
    };

    const handleDelete = (id: string) => {
        setPlaces(places.filter(p => p.id !== id));
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Component: Favorite Places</h2>
                    <p className="text-sm text-brand-gray-600">A new feature to save and manage frequently visited locations.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Add Place Form */}
                <div className="md:col-span-1">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Add a New Place</h3>
                    <form onSubmit={handleAddPlace} className="space-y-4">
                        <div>
                            <label htmlFor="place-name" className="block text-sm font-medium text-brand-gray-700 mb-1">Name</label>
                            <input type="text" id="place-name" value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., Home, Main Depot"/>
                        </div>
                         <div>
                            <label htmlFor="place-address" className="block text-sm font-medium text-brand-gray-700 mb-1">Address</label>
                            <input type="text" id="place-address" value={address} onChange={e => setAddress(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., 123 Example St, Sydney"/>
                        </div>
                        <button type="submit" className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue">
                           Save Place
                        </button>
                    </form>
                </div>

                {/* Places List */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Your Saved Places</h3>
                    <div className="space-y-3">
                        {places.length > 0 ? (
                            places.map(place => (
                                <div key={place.id} className="bg-brand-gray-50 p-4 rounded-lg border border-brand-gray-200 flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center space-x-3">
                                            {place.isHome && 
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                                    <title>Home</title>
                                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                                </svg>
                                            }
                                            <p className="font-semibold text-brand-gray-800">{place.name}</p>
                                        </div>
                                        <p className="text-sm text-brand-gray-600 pl-8">{place.address}</p>
                                    </div>
                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                        {!place.isHome && (
                                             <button onClick={() => handleSetHome(place.id)} className="text-xs font-medium text-brand-gray-600 hover:text-brand-blue" title="Set as Home">Set Home</button>
                                        )}
                                        <button className="text-xs font-medium text-brand-gray-600 hover:text-brand-blue">Edit</button>
                                        <button onClick={() => handleDelete(place.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-brand-gray-500 text-center py-8">You haven't saved any places yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};