import React, { useState, useRef, useEffect } from 'react';
import { MarkdownViewer } from './MarkdownViewer';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface NaturalLanguageQuerySandboxProps {
    onQuery: (query: string) => void;
    messages: ChatMessage[];
    isLoading: boolean;
    error: string;
}

export const NaturalLanguageQuerySandbox: React.FC<NaturalLanguageQuerySandboxProps> = ({ onQuery, messages, isLoading, error }) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onQuery(inputValue);
            setInputValue('');
        }
    };
    
    const exampleQueries = [
        "How many kilometers did I drive for business last month?",
        "Show me all my expenses for 'fuel' in October.",
        "What was my longest trip?",
    ];

    const handleExampleClick = (query: string) => {
        if (!isLoading) {
            onQuery(query);
            setInputValue('');
        }
    };


    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <div className="flex items-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-brand-blue mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                    <h2 className="text-xl font-bold text-brand-gray-800">Feature Prototype: Natural Language Query</h2>
                    <p className="text-sm text-brand-gray-600">Implements **Story 4.2**: Ask questions about your logbook data in plain English.</p>
                </div>
            </div>

            <div className="mt-6 flex flex-col h-[500px] border border-brand-gray-200 rounded-lg">
                <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl px-4 py-2 rounded-lg shadow ${msg.role === 'user' ? 'bg-brand-blue text-white' : 'bg-brand-gray-100 text-brand-gray-800'}`}>
                                <MarkdownViewer content={msg.content} />
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-xl px-4 py-2 rounded-lg shadow bg-brand-gray-100 text-brand-gray-800">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-brand-gray-500 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-brand-gray-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                    <div className="w-2 h-2 bg-brand-gray-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {error && (
                         <div className="flex justify-start">
                            <div className="max-w-xl px-4 py-2 rounded-lg shadow bg-red-100 text-red-800 border border-red-200">
                                <p>{error}</p>
                            </div>
                        </div>
                    )}
                    {messages.length === 0 && !isLoading && (
                        <div className="text-center text-brand-gray-500 pt-10">
                            <p className="mb-4">Ask a question about your trips and expenses.</p>
                             <div className="flex flex-wrap justify-center gap-2">
                                {exampleQueries.map(q => (
                                     <button key={q} onClick={() => handleExampleClick(q)} className="px-3 py-1.5 text-sm bg-brand-gray-100 hover:bg-brand-gray-200 text-brand-gray-700 rounded-full transition-colors">
                                        "{q}"
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-brand-gray-200 bg-white">
                    <form onSubmit={handleSubmit} className="flex space-x-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="e.g., How much did I spend on fuel in October?"
                            className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !inputValue.trim()}
                            className="bg-brand-blue text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400 disabled:cursor-not-allowed"
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
