import React, { useState, useEffect } from 'react';
import type { Expense, ExpenseCategory, ScannedReceiptData, Trip } from '../types';
import { CameraModal } from './CameraModal';

interface ExpenseManagerSandboxProps {
    trips: Trip[];
    expenses: Expense[];
    onAddExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
    onDeleteExpense: (id: string) => Promise<void>;
    onScanReceipt: (base64Image: string, mimeType: string) => void;
    scannedData: ScannedReceiptData | null;
    isScanning: boolean;
    scanError: string;
}

export const ExpenseManagerSandbox: React.FC<ExpenseManagerSandboxProps> = ({ 
    trips,
    expenses,
    onAddExpense,
    onDeleteExpense,
    onScanReceipt, 
    scannedData, 
    isScanning, 
    scanError 
}) => {
    const today = new Date().toISOString().split('T')[0];

    // Form state
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('fuel');
    const [date, setDate] = useState(today);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [tripId, setTripId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Camera Modal state
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    useEffect(() => {
        if (scannedData) {
            setDescription(scannedData.vendor || '');
            setAmount(scannedData.amount?.toString() || '');
            // Ensure date format is YYYY-MM-DD for the input field
            const scannedDate = scannedData.date ? new Date(scannedData.date).toISOString().split('T')[0] : today;
            setDate(scannedDate);
        }
    }, [scannedData, today]);


    const resetForm = () => {
        setDescription('');
        setAmount('');
        setCategory('fuel');
        setDate(today);
        setReceiptPreview(null);
        setTripId('');
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount) {
            return;
        }
        setIsSubmitting(true);
        const newExpenseData = {
            description,
            amount: parseFloat(amount),
            category,
            date,
            receiptDataUrl: receiptPreview || undefined,
            tripId: tripId || undefined,
        };
        await onAddExpense(newExpenseData);
        resetForm();
        setIsSubmitting(false);
    };
    
    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            await onDeleteExpense(id);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                setReceiptPreview(dataUrl);
                const base64String = dataUrl.split(',')[1];
                onScanReceipt(base64String, file.type);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCapture = (dataUrl: string) => {
        setReceiptPreview(dataUrl);
        const base64String = dataUrl.split(',')[1];
        onScanReceipt(base64String, 'image/jpeg');
        setIsCameraOpen(false);
    };

    const categories: { value: ExpenseCategory, label: string }[] = [
        { value: 'fuel', label: 'Fuel' },
        { value: 'tolls', label: 'Tolls' },
        { value: 'parking', label: 'Parking' },
        { value: 'maintenance', label: 'Maintenance' },
        { value: 'other', label: 'Other' },
    ];
    
    const completedTrips = trips.filter(t => t.status === 'completed');
    const getTripForExpense = (tripId?: string) => trips.find(t => t.id === tripId);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            {isCameraOpen && <CameraModal onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />}
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Expense Tracking</h2>
                    <p className="text-sm text-brand-gray-600">Log expenses and scan receipts with Gemini.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Add Expense Form */}
                <div className="md:col-span-1">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Add an Expense</h3>
                    <form onSubmit={handleAddExpense} className="space-y-4">
                        {receiptPreview && (
                            <div className="relative">
                                <img src={receiptPreview} alt="Receipt preview" className="rounded-md object-cover w-full h-32" />
                                {isScanning && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center rounded-md">
                                        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <p className="text-white text-sm mt-2">Gemini is scanning...</p>
                                    </div>
                                )}
                                <button type="button" onClick={() => setReceiptPreview(null)} className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full p-0.5">&times;</button>
                            </div>
                        )}
                         {scanError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">{scanError}</p>}
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-brand-gray-700 mb-1">Description</label>
                            <input type="text" id="description" value={description} onChange={e => setDescription(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., Fuel at Ampol"/>
                        </div>
                         <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-brand-gray-700 mb-1">Amount ($)</label>
                            <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} required min="0.01" step="0.01" className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue" placeholder="e.g., 75.50"/>
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-brand-gray-700 mb-1">Category</label>
                            <select id="category" value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue">
                                {categories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="date" className="block text-sm font-medium text-brand-gray-700 mb-1">Date</label>
                            <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"/>
                        </div>
                         <div>
                            <label htmlFor="tripId" className="block text-sm font-medium text-brand-gray-700 mb-1">Associate with Trip (Optional)</label>
                            <select id="tripId" value={tripId} onChange={e => setTripId(e.target.value)} className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue">
                                <option value="">None</option>
                                {completedTrips.map(trip => (
                                    <option key={trip.id} value={trip.id}>
                                        {trip.distance}km ({trip.purpose}) on {new Date(trip.endTime!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                                        {trip.notes && ` - "${trip.notes.substring(0, 25)}..."`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex space-x-2">
                             <button type="button" onClick={() => setIsCameraOpen(true)} className="w-full flex items-center justify-center bg-white border-2 border-dashed border-brand-gray-300 text-brand-gray-600 font-semibold px-4 py-2 rounded-md shadow-sm hover:border-brand-blue hover:text-brand-blue">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H4zm10 5a3 3 0 11-6 0 3 3 0 016 0z" clipRule="evenodd" /></svg>
                                Camera
                            </button>
                             <label htmlFor="receipt-upload" className="w-full cursor-pointer flex items-center justify-center bg-white border-2 border-dashed border-brand-gray-300 text-brand-gray-600 font-semibold px-4 py-2 rounded-md shadow-sm hover:border-brand-blue hover:text-brand-blue">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                Upload
                            </label>
                             <input id="receipt-upload" type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                        </div>
                        <button type="submit" disabled={isSubmitting} className="w-full bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400">
                           {isSubmitting ? 'Adding...' : 'Add Expense'}
                        </button>
                    </form>
                </div>

                {/* Expense List */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-semibold text-brand-gray-700 mb-3">Your Expenses</h3>
                    <div className="space-y-3">
                        {expenses.length > 0 ? (
                            expenses.map(exp => {
                                const linkedTrip = getTripForExpense(exp.tripId);
                                return (
                                    <div key={exp.id} className="bg-brand-gray-50 p-4 rounded-lg border border-brand-gray-200 flex justify-between items-center">
                                        <div className="flex items-center space-x-4">
                                            {exp.receiptDataUrl && <img src={exp.receiptDataUrl} alt="Receipt thumbnail" className="w-12 h-12 rounded-md object-cover" />}
                                            <div className="text-center w-16 flex-shrink-0">
                                                <p className="font-bold text-brand-gray-800 text-lg">${parseFloat(exp.amount as any).toFixed(2)}</p>
                                                <p className="text-xs text-brand-gray-500">{new Date(exp.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-brand-gray-800">{exp.description}</p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className="capitalize px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-brand-gray-700">{exp.category}</span>
                                                    {(exp.receiptUrl || exp.receiptDataUrl) && 
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                                        <title>Receipt attached</title>
                                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                    </svg>
                                                    }
                                                    {linkedTrip && linkedTrip.distance && linkedTrip.purpose && linkedTrip.endTime &&
                                                        <span title={linkedTrip.notes || `Trip on ${new Date(linkedTrip.endTime).toLocaleDateString()}`} className="flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
                                                            Linked: {linkedTrip.distance}km ({linkedTrip.purpose})
                                                        </span>
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button onClick={() => handleDelete(exp.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <p className="text-sm text-brand-gray-500 text-center py-8">You haven't logged any expenses yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};