
import React, { useState } from 'react';
import type { User } from '../types';

type ExportFormat = 'csv' | 'pdf';

interface LogbookExporterSandboxProps {
    onGenerateReport: (startDate: string, endDate: string) => void;
    currentUser: User | null;
}

export const LogbookExporterSandbox: React.FC<LogbookExporterSandboxProps> = ({ onGenerateReport, currentUser }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
    const [format, setFormat] = useState<ExportFormat>('csv');
    const [isExporting, setIsExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState('');

    const handleExport = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (format === 'pdf') {
            onGenerateReport(startDate, endDate);
            return;
        }

        // Handle CSV export simulation
        setIsExporting(true);
        setExportMessage('');
        setTimeout(() => {
            setIsExporting(false);
            setExportMessage(`Success! Your CSV logbook export for ${startDate} to ${endDate} has been generated and sent to your registered email.`);
        }, 1500);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Logbook Export</h2>
                    <p className="text-sm text-brand-gray-600">Generate an ATO-compliant report.</p>
                </div>
            </div>

            {!currentUser ? (
                <div className="text-center py-8 bg-brand-gray-50 rounded-md mt-6">
                    <p className="text-brand-gray-600">Please log in to export your logbook.</p>
                </div>
            ) : (
                <form onSubmit={handleExport} className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="start-date" className="block text-sm font-medium text-brand-gray-700 mb-1">Start Date</label>
                            <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"/>
                        </div>
                         <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-brand-gray-700 mb-1">End Date</label>
                            <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"/>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-brand-gray-700 mb-2">Format</label>
                        <div className="flex space-x-4 bg-brand-gray-100 p-2 rounded-md">
                           <label className={`flex-1 text-center cursor-pointer px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${format === 'csv' ? 'bg-brand-blue text-white shadow' : 'text-brand-gray-600 hover:bg-white'}`}>
                               <input type="radio" name="format" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} className="sr-only"/>
                               CSV
                           </label>
                           <label className={`flex-1 text-center cursor-pointer px-4 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${format === 'pdf' ? 'bg-brand-blue text-white shadow' : 'text-brand-gray-600 hover:bg-white'}`}>
                               <input type="radio" name="format" value="pdf" checked={format === 'pdf'} onChange={() => setFormat('pdf')} className="sr-only"/>
                               PDF Report (via Gemini)
                           </label>
                        </div>
                    </div>
                    
                    <button 
                        type="submit"
                        disabled={isExporting}
                        className="w-full bg-brand-blue text-white font-semibold px-4 py-2.5 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Exporting CSV...
                            </>
                        ) : (
                            'Generate Report'
                        )}
                    </button>
                </form>
            )}

            {exportMessage && format === 'csv' && (
                <div className="mt-4 p-3 border text-sm rounded-md bg-green-100 border-green-200 text-green-800">
                    {exportMessage}
                </div>
            )}
        </div>
    );
};
