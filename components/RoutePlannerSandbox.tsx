


import React, { useState, useEffect, useRef } from 'react';
import type { GroundingChunk } from '../types';
import { MarkdownViewer } from './MarkdownViewer';
import { GoogleGenAI, Type, Modality, Blob, LiveServerMessage } from "@google/genai";

// Audio processing functions for Gemini Live
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface RoutePlannerSandboxProps {
    onFindRoute: (stops: string[]) => void;
    onRefineRoute: (stops: string[], excludedTolls: string[]) => void;
    result: string;
    groundingChunks: GroundingChunk[];
    isLoading: boolean;
    identifiedTolls: string[];
}

export const RoutePlannerSandbox: React.FC<RoutePlannerSandboxProps> = ({ 
    onFindRoute, 
    onRefineRoute,
    result, 
    groundingChunks, 
    isLoading,
    identifiedTolls 
}) => {
    const [stops, setStops] = useState<string[]>(['Sydney Airport, NSW', 'Chatswood, NSW', 'Parramatta, NSW', 'Bondi Beach, NSW']);
    const [tollsToInclude, setTollsToInclude] = useState<Set<string>>(new Set());
    
    // State for voice commands
    const [isListening, setIsListening] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>('');
    const [voiceError, setVoiceError] = useState<string>('');
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);


    // When new tolls are identified, initialize the 'include' set to all of them.
    useEffect(() => {
        setTollsToInclude(new Set(identifiedTolls));
    }, [identifiedTolls]);

    const handleStopChange = (index: number, value: string) => {
        const newStops = [...stops];
        newStops[index] = value;
        setStops(newStops);
    };

    const handleAddStop = () => {
        if (stops.length < 6) {
            setStops([...stops, '']);
        }
    };

    const handleRemoveStop = (index: number) => {
        const newStops = stops.filter((_, i) => i !== index);
        setStops(newStops);
    };

    const handleTollSelectionChange = (tollName: string, isChecked: boolean) => {
        setTollsToInclude(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(tollName);
            } else {
                newSet.delete(tollName);
            }
            return newSet;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onFindRoute(stops.filter(stop => stop.trim() !== ''));
    }

    const handleRefineSubmit = () => {
        const excludedTolls = identifiedTolls.filter(toll => !tollsToInclude.has(toll));
        onRefineRoute(stops.filter(stop => stop.trim() !== ''), excludedTolls);
    }
    
    const extractAddressesFromTranscript = async (text: string) => {
        if (!text.trim()) return;
        setIsExtracting(true);
        setVoiceError('');
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `From the following voice command, extract the destination addresses into a JSON array. The user might say "go to", "direct me to", or "then". Focus only on extracting the locations.
            
Command: "${text}"

Example 1:
Command: "I need to go to Sydney Airport, then Chatswood, then Parramatta."
Output:
{
  "stops": ["Sydney Airport, NSW", "Chatswood, NSW", "Parramatta, NSW"]
}

Example 2:
Command: "Direct me to Bondi Beach."
Output:
{
  "stops": ["Bondi Beach, NSW"]
}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            stops: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: 'A list of extracted location addresses.'
                            }
                        }
                    }
                }
            });
            
            const jsonResponse = JSON.parse(response.text);
            const extractedStops = jsonResponse.stops || [];

            if (extractedStops.length > 0) {
                 // Ensure there are enough stop fields
                let newStops = [...extractedStops];
                if (newStops.length < 2) {
                    newStops.push(''); // Ensure at least start and end fields are visible
                }
                while (newStops.length > 6) {
                    newStops.pop(); // Max 6 stops
                }
                setStops(newStops);
            } else {
                setVoiceError("Sorry, I couldn't identify any addresses in your command. Please try again.");
            }

        } catch (error) {
            console.error("Error extracting addresses:", error);
            setVoiceError("There was an error processing your voice command.");
        } finally {
            setIsExtracting(false);
        }
    };

    const handleStartListening = async () => {
        setIsListening(true);
        setTranscript('');
        setVoiceError('');
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        // Fix(2024-07-26): Cast window to `any` to allow access to the vendor-prefixed `webkitAudioContext` for older browser compatibility.
                        inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        sourceNodeRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current!);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                             sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        sourceNodeRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            setTranscript(prev => prev + text);
                        }
                        if (message.serverContent?.turnComplete) {
                           // In this implementation, we wait for the user to stop manually.
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Gemini Live error:', e);
                        setVoiceError('An error occurred with the voice session.');
                        handleStopListening(false);
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Gemini Live session closed');
                    },
                },
                config: {
                    inputAudioTranscription: {},
                }
            });

        } catch (error) {
            console.error("Error starting voice session:", error);
            setVoiceError("Could not start listening. Please ensure microphone permissions are enabled.");
            setIsListening(false);
        }
    };
    
    const handleStopListening = async (shouldExtract = true) => {
        setIsListening(false);
        
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (scriptProcessorRef.current && sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            scriptProcessorRef.current.disconnect();
        }

        if (inputAudioContextRef.current?.state !== 'closed') {
            await inputAudioContextRef.current?.close();
        }
        
        if (shouldExtract) {
           await extractAddressesFromTranscript(transcript);
           setTranscript('');
        }
    };

    const selectionHasChanged = identifiedTolls.length !== tollsToInclude.size || 
                                identifiedTolls.some(toll => !tollsToInclude.has(toll));

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
            <h2 className="text-xl font-bold text-brand-gray-800 mb-1">Feature Prototype Sandbox</h2>
            <p className="text-sm text-brand-gray-600 mb-4 border-b pb-4">Test multi-stop routing (**Story 2.4**) and toll avoidance (**Story 3.4**). Add stops manually or use the new voice command feature.</p>
            
            <div className="bg-brand-gray-50 p-4 rounded-lg border border-brand-gray-200 mb-4">
                 <div className="flex items-center justify-between">
                    <div>
                         <h3 className="text-md font-semibold text-brand-gray-800">Voice Command</h3>
                         <p className="text-sm text-brand-gray-600">Click the mic and say where you want to go.</p>
                    </div>
                    <button
                        onClick={isListening ? () => handleStopListening() : handleStartListening}
                        className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isListening ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500' : 'bg-brand-blue hover:bg-blue-700 text-white focus:ring-brand-blue'}`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice command'}
                    >
                        {isListening ? (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        )}
                    </button>
                 </div>
                 {(isListening || transcript || voiceError || isExtracting) && (
                    <div className="mt-3 pt-3 border-t border-brand-gray-200">
                        {isListening && <p className="text-sm text-brand-gray-600 animate-pulse">Listening...</p>}
                        {transcript && <p className="text-sm text-brand-gray-800 italic">"{transcript}"</p>}
                        {isExtracting && <p className="text-sm text-brand-blue animate-pulse">Processing your command...</p>}
                        {voiceError && <p className="text-sm text-red-600">{voiceError}</p>}
                    </div>
                 )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                    {stops.map((stop, index) => (
                        <div key={index} className="flex items-center space-x-2">
                             <label htmlFor={`stop-${index}`} className="text-sm font-medium text-brand-gray-700 w-24 flex-shrink-0 text-right pr-2">
                                {index === 0 ? 'Start' : (index === stops.length - 1 ? 'End' : `Stop ${index + 1}`)}
                            </label>
                            <input 
                                type="text" 
                                id={`stop-${index}`}
                                value={stop}
                                onChange={(e) => handleStopChange(index, e.target.value)}
                                className="w-full px-3 py-2 border border-brand-gray-300 rounded-md shadow-sm focus:ring-brand-blue focus:border-brand-blue"
                                placeholder={index === 0 ? "Start location" : (index === stops.length - 1 ? "End location" : "Waypoint")}
                            />
                            {stops.length > 2 ? (
                                <button type="button" onClick={() => handleRemoveStop(index)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100" title="Remove stop">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            ) : <div className="w-7"></div>}
                        </div>
                    ))}
                </div>

                 <div className="flex justify-between items-center pt-2">
                    <button 
                        type="button" 
                        onClick={handleAddStop} 
                        disabled={stops.length >= 6}
                        className="text-sm font-semibold text-brand-blue hover:bg-blue-50 px-3 py-1.5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                        Add Stop
                    </button>
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="bg-brand-blue text-white font-semibold px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue disabled:bg-brand-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading && !result ? (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        )}
                        Find Route
                    </button>
                </div>
            </form>

            {(isLoading || result) && (
                <div className="mt-6 border-t pt-6">
                    <h3 className="text-lg font-semibold text-brand-gray-800 mb-2">Optimized Route</h3>
                    {isLoading && !result && (
                         <div className="flex items-center text-brand-gray-600">
                            <svg className="animate-spin h-5 w-5 mr-3 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Calculating optimized multi-stop route with Gemini...</span>
                        </div>
                    )}
                    {result && <MarkdownViewer content={result} />}

                    {!isLoading && identifiedTolls.length > 0 && (
                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h4 className="text-md font-semibold text-yellow-900 mb-3">Toll Road Customization</h4>
                            <p className="text-sm text-yellow-800 mb-3">The suggested route includes these toll roads. Uncheck any you wish to exclude from the route.</p>
                            <div className="space-y-2">
                                {identifiedTolls.map(toll => (
                                    <label key={toll} className="flex items-center text-sm text-brand-gray-800">
                                        <input
                                            type="checkbox"
                                            checked={tollsToInclude.has(toll)}
                                            onChange={(e) => handleTollSelectionChange(toll, e.target.checked)}
                                            className="h-4 w-4 rounded border-brand-gray-300 text-brand-blue focus:ring-brand-blue"
                                        />
                                        <span className="ml-2">{toll}</span>
                                    </label>
                                ))}
                            </div>
                            <button 
                                onClick={handleRefineSubmit}
                                disabled={isLoading || !selectionHasChanged}
                                className="mt-4 bg-yellow-500 text-white font-semibold px-4 py-1.5 text-sm rounded-md shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:bg-brand-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoading ? 'Updating...' : 'Update Route with Selected Tolls'}
                            </button>
                        </div>
                    )}

                    {groundingChunks.length > 0 && (
                        <div className="mt-4">
                            <h4 className="text-sm font-semibold text-brand-gray-700">Sources from Google Maps:</h4>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                {groundingChunks.map((chunk, index) => (
                                    <li key={index} className="text-sm">
                                        <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">
                                            {chunk.maps.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}