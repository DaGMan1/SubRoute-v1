import React, { useState, useEffect, useCallback } from 'react';
import type { GroundingChunk, ScannedReceiptData, User, FavoritePlace, Vehicle, Trip, Expense, ExpenseCategory, SuggestedTrip } from './types';
import { GoogleGenAI, Type, Chat, FunctionDeclaration } from "@google/genai";
import { ReportViewerModal } from './components/ReportViewerModal';
import { RoutePlannerSandbox } from './components/RoutePlannerSandbox';
import { AuthSandbox } from './components/AuthSandbox';
import { VehicleManagerSandbox } from './components/VehicleManagerSandbox';
import { TripManagerSandbox } from './components/TripManagerSandbox';
import { ExpenseManagerSandbox } from './components/ExpenseManagerSandbox';
import { LogbookExporterSandbox } from './components/LogbookExporterSandbox';
import { FavoritePlacesSandbox } from './components/FavoritePlacesSandbox';
import { NaturalLanguageQuerySandbox } from './components/NaturalLanguageQuerySandbox';
import { AutomatedTripDetectorSandbox } from './components/AutomatedTripDetectorSandbox';


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);
  const [suggestedTrips, setSuggestedTrips] = useState<SuggestedTrip[]>([]);

  // State for Report Viewer Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalTitle, setReportModalTitle] = useState('');
  const [reportModalContent, setReportModalContent] = useState('');
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // State for Route Planner
  const [routeResult, setRouteResult] = useState<string>('');
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [isFindingRoute, setIsFindingRoute] = useState<boolean>(false);
  const [identifiedTolls, setIdentifiedTolls] = useState<string[]>([]);

  // State for Receipt Scanner
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [scanError, setScanError] = useState<string>('');

  // State for Natural Language Query
  interface ChatMessage {
    role: 'user' | 'model';
    content: string;
  }
  const [nlqMessages, setNlqMessages] = useState<ChatMessage[]>([]);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [nlqError, setNlqError] = useState<string>('');
  const [chat, setChat] = useState<Chat | null>(null);

  // --- DATA FETCHING ---
  const fetchVehicles = useCallback(async () => {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/vehicles', { headers: { 'x-user-id': currentUser.id } });
        if (!response.ok) throw new Error('Failed to fetch vehicles.');
        const data = await response.json();
        setVehicles(data);
    } catch (err: any) {
        console.error("Vehicle fetch error:", err.message);
    }
  }, [currentUser]);

  const fetchTrips = useCallback(async () => {
    if (!currentUser) return;
    try {
      const response = await fetch('/api/trips', { headers: { 'x-user-id': currentUser.id } });
      if (!response.ok) throw new Error('Failed to fetch trips.');
      const data = await response.json();
      const parsedTrips = data.map((trip: any) => ({
          ...trip,
          startTime: new Date(trip.startTime),
          endTime: trip.endTime ? new Date(trip.endTime) : undefined,
      }));
      setTrips(parsedTrips);
    } catch (err: any) {
      console.error("Trip fetch error:", err.message);
    }
  }, [currentUser]);

  const fetchExpenses = useCallback(async () => {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/expenses', { headers: { 'x-user-id': currentUser.id } });
        if (!response.ok) throw new Error('Failed to fetch expenses.');
        const data = await response.json();
        setExpenses(data);
    } catch (err: any) {
        console.error("Expense fetch error:", err.message);
    }
  }, [currentUser]);
  
  const fetchFavoritePlaces = useCallback(async () => {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/favorite-places', { headers: { 'x-user-id': currentUser.id } });
        if (!response.ok) throw new Error('Failed to fetch favorite places.');
        const data = await response.json();
        setFavoritePlaces(data);
    } catch (err: any) {
        console.error("Favorite places fetch error:", err.message);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchVehicles();
      fetchTrips();
      fetchExpenses();
      fetchFavoritePlaces();
    } else {
      setVehicles([]);
      setTrips([]);
      setExpenses([]);
      setFavoritePlaces([]);
      setSuggestedTrips([]);
    }
  }, [currentUser, fetchVehicles, fetchTrips, fetchExpenses, fetchFavoritePlaces]);

  // --- API HANDLERS ---
  const handleAddPlace = async (name: string, address: string) => {
    if (!currentUser) return;
    await fetch('/api/favorite-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ name, address }),
    });
    fetchFavoritePlaces();
  };

  const handleSetHomePlace = async (id: string) => {
    if (!currentUser) return;
    await fetch(`/api/favorite-places/${id}/home`, {
        method: 'PUT',
        headers: { 'x-user-id': currentUser.id },
    });
    fetchFavoritePlaces();
  };

  const handleDeletePlace = async (id: string) => {
    if (!currentUser) return;
    await fetch(`/api/favorite-places/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.id },
    });
    fetchFavoritePlaces();
  };

  const handleAddExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!currentUser) return;
    await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify(expense),
    });
    await fetchExpenses();
  };

  const handleDeleteExpense = async (id: string) => {
    if (!currentUser) return;
    await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.id },
    });
    await fetchExpenses();
  };
  
  const handleAddTollExpenses = async (tollNames: string[]) => {
      const today = new Date().toISOString().split('T')[0];
      const newTollExpenses: Omit<Expense, 'id'>[] = tollNames.map(tollName => ({
          description: `${tollName} Toll`,
          amount: 0,
          category: 'tolls',
          date: today,
      }));
      for (const exp of newTollExpenses) {
        await handleAddExpense(exp);
      }
  };
  
  const handleStartTrip = async (vehicleId: string, startOdometer: number) => {
      if (!currentUser) return;
      await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
          body: JSON.stringify({ vehicleId, startOdometer }),
      });
      await fetchTrips();
  };
  
  const handleEndTrip = async (tripId: string, endOdometer: number, purpose: 'business' | 'personal', notes: string) => {
      if (!currentUser) return;
      await fetch(`/api/trips/${tripId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
          body: JSON.stringify({ endOdometer, purpose, notes }),
      });
      await fetchTrips();
  };

  const handleTripDetected = (trip: SuggestedTrip) => {
      setSuggestedTrips(prev => [trip, ...prev]);
  };

  const handleDismissSuggestedTrip = (id: string) => {
      setSuggestedTrips(prev => prev.filter(t => t.id !== id));
  };
  
  // A new handler for logging a previously suggested trip.
  // This is a simplified version; in a real app, you'd create a new trip record.
  // For now, we'll just simulate it by fetching trips again to clear active state.
   const handleLogSuggestedTrip = async (trip: SuggestedTrip, vehicleId: string, startOdometer: number, endOdometer: number, purpose: 'business' | 'personal', notes: string) => {
    if (!currentUser) return;
    // In a real implementation, you would send the suggested trip data to the backend to create a completed trip record.
    // For this simulation, we'll just remove the suggestion and refresh the trip list.
    console.log('Logging suggested trip:', { trip, vehicleId, startOdometer, endOdometer, purpose, notes });
    // This is where you would make an API call like:
    /*
    await fetch('/api/trips/log-completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({
        vehicleId,
        startTime: trip.startTime.toISOString(),
        endTime: trip.endTime.toISOString(),
        startOdometer,
        endOdometer,
        purpose,
        notes
      }),
    });
    */
    handleDismissSuggestedTrip(trip.id);
    await fetchTrips();
    alert("Suggested trip has been logged!");
  };

  // Gemini Handlers
  const handleGenerateReport = async (startDate: string, endDate: string) => {
    setIsReportModalOpen(true);
    setReportModalTitle(`Generating Logbook Report (${startDate} to ${endDate})`);
    setIsLoadingReport(true);
    setReportModalContent('');

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredTrips = trips.filter(trip => {
        const tripDate = trip.endTime ? new Date(trip.endTime) : new Date(trip.startTime);
        return tripDate >= start && tripDate <= end;
    });
    const filteredExpenses = expenses.filter(expense => new Date(expense.date) >= start && new Date(expense.date) <= end);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `You are an expert accountant for an Australian courier driver. Your task is to generate a comprehensive, ATO-compliant logbook summary based on the provided JSON data.

**Date Range:** ${startDate} to ${endDate}
**Driver Name:** ${currentUser?.name || 'N/A'}

**Data Provided:**
**Trips:**
\`\`\`json
${JSON.stringify(filteredTrips, null, 2)}
\`\`\`
**Expenses:**
\`\`\`json
${JSON.stringify(filteredExpenses, null, 2)}
\`\`\`
---
**Required Output (in Markdown format):**
1.  **Header:** Create a clear title: "ATO Logbook & Expense Summary". Include the driver's name and the specified date range.
2.  **Summary Totals:** Calculate and display the following key metrics in a prominent section:
    - Total Kilometres Driven
    - Total Business Kilometres
    - Business Use Percentage ( (Business KM / Total KM) * 100 )
    - Total Vehicle Expenses (sum of all expense amounts)
3.  **Expense Breakdown:** Provide a clear breakdown of expenses by category (fuel, tolls, etc.).
4.  **Detailed Trip Log:** Create a markdown table with the following columns for all **business** trips:
    - Date (of trip end)
    - Start Time
    - End Time
    - Odometer Start
    - Odometer End
    - Distance (km)
    - Notes/Purpose
5.  **Closing Statement:** Add a brief, professional closing statement.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        setReportModalContent(response.text);
    } catch (error) {
        console.error("Error generating report:", error);
        setReportModalContent("Sorry, there was an error generating the report.");
    } finally {
        setIsLoadingReport(false);
        setReportModalTitle(`Logbook Report: ${startDate} to ${endDate}`);
    }
  };
  const handleCloseReportModal = () => setIsReportModalOpen(false);

  const parseTollsFromResult = (text: string): string[] => {
    const tollSectionMatch = text.match(/Toll Roads:([\s\S]*)/i);
    if (!tollSectionMatch) return [];
    const tollList = tollSectionMatch[1];
    const tolls = tollList.match(/-\s*(.*)/g) || [];
    return tolls.map(t => t.replace(/-\s*/, '').trim());
  };

  const handleFindRoute = async (stops: string[]) => {
    if (stops.length < 2) {
      setRouteResult("Please provide at least a start and end location.");
      return;
    }
    setIsFindingRoute(true);
    setRouteResult('');
    setGroundingChunks([]);
    setIdentifiedTolls([]);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const location: GeolocationPosition = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
      const { latitude, longitude } = location.coords;
      const startLocation = stops[0];
      const endLocation = stops[stops.length - 1];
      const waypoints = stops.slice(1, -1);
      
      let prompt = `As an expert route planner for an Australian courier driver, create the most efficient route for a delivery run.
**Start:** ${startLocation}
**End:** ${endLocation}
`;
      if (waypoints.length > 0) {
        prompt += `**Must visit waypoints (in any order):**\n${waypoints.map(w => `- ${w}`).join('\n')}\n`;
      }
      prompt += `
Please provide an optimized, step-by-step driving route that minimizes travel time.
- Provide a conversational guide, mentioning major highways.
- Provide an estimated total travel time and distance.
IMPORTANT: If the recommended route uses any major named toll roads (e.g., M5 Motorway, M7, CityLink), list them at the very end of your response under a separate heading like this:
Toll Roads:
- M5 Motorway
- Cross City Tunnel`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{googleMaps: {}}],
          toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
        }
      });
      
      setRouteResult(response.text);
      setIdentifiedTolls(parseTollsFromResult(response.text));
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setGroundingChunks(response.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[]);
      }
    } catch (error) {
       console.error("Error finding route:", error);
       setRouteResult(error instanceof GeolocationPositionError ? "Could not get your location. Please enable permissions." : "Sorry, there was an error finding the route.");
    } finally {
      setIsFindingRoute(false);
    }
  };
  
  const handleRefineRoute = async (stops: string[], excludedTolls: string[]) => {
      if (stops.length < 2) {
        setRouteResult("Please provide at least a start and end location.");
        return;
      }
      setIsFindingRoute(true);
      setRouteResult('');
      setGroundingChunks([]);
      setIdentifiedTolls([]);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const location: GeolocationPosition = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
        const { latitude, longitude } = location.coords;
        const startLocation = stops[0];
        const endLocation = stops[stops.length - 1];
        const waypoints = stops.slice(1, -1);
        
        let prompt = `As an expert route planner for an Australian courier driver, create the most efficient route for a delivery run.
**Start:** ${startLocation}
**End:** ${endLocation}
`;
        if (waypoints.length > 0) {
          prompt += `**Must visit waypoints (in any order):**\n${waypoints.map(w => `- ${w}`).join('\n')}\n`;
        }
        prompt += `\n**Constraint:** The route MUST avoid the following specific toll roads: ${excludedTolls.join(', ')}.\n`;
        prompt += `
Please provide an updated, step-by-step driving route that adheres to this constraint.
- Provide a conversational guide, mentioning major highways.
- Provide an estimated total travel time and distance.`;
        
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            tools: [{googleMaps: {}}],
            toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
          }
        });
        setRouteResult(response.text);
         if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
           setGroundingChunks(response.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[]);
         }
      } catch (error) {
         console.error("Error refining route:", error);
         setRouteResult("Sorry, there was an error refining the route.");
      } finally {
        setIsFindingRoute(false);
      }
  };

  const handleScanReceipt = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setScannedData(null);
    setScanError('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: `Analyze this receipt image and extract the following information. If a value is not found, return null for that field. - The primary vendor or store name. - The final total amount. - The transaction date.` }
        ] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendor: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
            },
          },
        },
      });
      const jsonResponse = JSON.parse(response.text);
      setScannedData(jsonResponse as ScannedReceiptData);
    } catch (error) {
      console.error("Error scanning receipt:", error);
      setScanError("Sorry, Gemini couldn't read that receipt.");
    } finally {
      setIsScanning(false);
    }
  };
  
  const addExpenseFunction: FunctionDeclaration = {
      name: 'addExpense',
      description: 'Adds a new expense to the user\'s logbook. Use today\'s date if not specified by the user.',
      parameters: {
          type: Type.OBJECT,
          properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING, enum: ['fuel', 'tolls', 'parking', 'maintenance', 'other'] },
              date: { type: Type.STRING }
          },
          required: ['description', 'amount', 'category']
      }
  };

  useEffect(() => {
    if (currentUser) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const systemInstruction = `You are an expert data analyst and assistant for an app called "SubRoute", which helps courier drivers manage their trips and expenses. 
- Your task is to answer questions from the user based ONLY on the contextual JSON data provided in their message. 
- You can also perform actions, like adding an expense, by using the available tools.
- Today's date is ${new Date().toLocaleDateString('en-CA')}.
- When asked about "last month" or "this month", calculate based on today's date.
- Present your answers in a clear, friendly, and concise manner.
- If you cannot answer the question with the provided data, politely state that the information is not available in the logbook.
- When you call a function, the system will execute it and provide the result. Your final response to the user should confirm the action was completed successfully.`;
        
        const newChat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                tools: [{ functionDeclarations: [addExpenseFunction] }],
            },
        });
        setChat(newChat);
    } else {
        setChat(null);
        setNlqMessages([]);
    }
  }, [currentUser]);

  const handleNaturalLanguageQuery = async (query: string) => {
    if (!chat || !currentUser) {
      setNlqError("Please log in to use the assistant.");
      return;
    }
    setIsQuerying(true);
    setNlqError('');
    const newMessages: ChatMessage[] = [...nlqMessages, { role: 'user', content: query }];
    setNlqMessages(newMessages);
    try {
      const promptWithData = `
Contextual Data to answer the user's request:
**Trips:**
\`\`\`json
${JSON.stringify(trips, null, 2)}
\`\`\`
**Expenses:**
\`\`\`json
${JSON.stringify(expenses, null, 2)}
\`\`\`
---
User's Request: "${query}"`;
      
      let response = await chat.sendMessage({ message: promptWithData });
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionCalls = response.functionCalls;
        const toolResponses = [];
        for (const fc of functionCalls) {
          if (fc.name === 'addExpense') {
            const { description, amount, category, date } = fc.args;
            await handleAddExpense({
              description,
              amount,
              category: category as ExpenseCategory,
              date: date || new Date().toISOString().split('T')[0]
            });
            toolResponses.push({
              functionResponse: { id: fc.id, name: fc.name, response: { result: `Successfully added expense: ${description} for $${amount}` } }
            });
          }
        }
        response = await chat.sendMessage({ toolResponses });
      }
      setNlqMessages([...newMessages, { role: 'model', content: response.text }]);
    } catch (error) {
      console.error("Error with natural language query:", error);
      setNlqError("Sorry, there was an error processing your request.");
    } finally {
      setIsQuerying(false);
    }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setNlqMessages([]);
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
                  <AuthSandbox onLoginSuccess={setCurrentUser} currentUser={currentUser} onLogout={handleLogout} />
              </div>
          </div>
      );
  }

  return (
    <div className="bg-brand-gray-100 min-h-screen">
      <ReportViewerModal 
        isOpen={isReportModalOpen} 
        onClose={handleCloseReportModal} 
        title={reportModalTitle}
        content={reportModalContent}
        isLoading={isLoadingReport}
      />
      <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3">
                   <div className="flex items-center space-x-3">
                     <svg className="w-8 h-8 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                     <h1 className="text-2xl font-bold text-brand-gray-900">SubRoute</h1>
                   </div>
                   <div className="flex items-center space-x-4">
                       <span className="text-sm text-brand-gray-700">Welcome, <span className="font-semibold">{currentUser.name}</span></span>
                       <button onClick={handleLogout} className="text-sm font-semibold text-brand-blue hover:underline">Logout</button>
                   </div>
              </div>
          </div>
      </header>
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
           <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Main Column */}
                <div className="xl:col-span-2 space-y-6">
                    <TripManagerSandbox 
                        currentUser={currentUser}
                        vehicles={vehicles}
                        trips={trips}
                        suggestedTrips={suggestedTrips}
                        onStartTrip={handleStartTrip}
                        onEndTrip={handleEndTrip}
                        onLogSuggestedTrip={handleLogSuggestedTrip}
                        onDismissSuggestedTrip={handleDismissSuggestedTrip}
                    />
                    <ExpenseManagerSandbox 
                        trips={trips}
                        expenses={expenses}
                        onAddExpense={handleAddExpense}
                        onDeleteExpense={handleDeleteExpense}
                        onScanReceipt={handleScanReceipt}
                        scannedData={scannedData}
                        isScanning={isScanning}
                        scanError={scanError}
                    />
                    <RoutePlannerSandbox 
                        onFindRoute={handleFindRoute}
                        onRefineRoute={handleRefineRoute}
                        result={routeResult}
                        groundingChunks={groundingChunks}
                        isLoading={isFindingRoute}
                        identifiedTolls={identifiedTolls}
                        favoritePlaces={favoritePlaces}
                        onAddTollExpenses={handleAddTollExpenses}
                    />
                </div>
                
                {/* Side Column */}
                <div className="space-y-6">
                    <VehicleManagerSandbox 
                        currentUser={currentUser}
                        vehicles={vehicles}
                        onVehicleUpdate={fetchVehicles}
                    />
                     <NaturalLanguageQuerySandbox 
                        onQuery={handleNaturalLanguageQuery}
                        messages={nlqMessages}
                        isLoading={isQuerying}
                        error={nlqError}
                        currentUser={currentUser}
                    />
                    <AutomatedTripDetectorSandbox
                        onTripDetected={handleTripDetected}
                    />
                     <FavoritePlacesSandbox
                        places={favoritePlaces}
                        onAddPlace={handleAddPlace}
                        onSetHome={handleSetHomePlace}
                        onDelete={handleDeletePlace}
                    />
                    <LogbookExporterSandbox 
                        onGenerateReport={handleGenerateReport} 
                        currentUser={currentUser}
                    />
                </div>

           </div>
        </div>
      </main>
    </div>
  );
};

export default App;