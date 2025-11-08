

import React, { useState, useEffect, useCallback } from 'react';
import { MarkdownViewer } from './components/MarkdownViewer';
import { TableOfContents } from './components/TableOfContents';
import { markdownContent } from './constants/markdownContent';
import type { GroundingChunk, Heading, ScannedReceiptData, User } from './types';
import { useHeadingsObserver } from './hooks/useHeadingsObserver';
import { GoogleGenAI, Type } from "@google/genai";
import { TaskGeneratorModal } from './components/TaskGeneratorModal';
import { RoutePlannerSandbox } from './components/RoutePlannerSandbox';
import { AuthSandbox } from './components/AuthSandbox';
import { VehicleManagerSandbox } from './components/VehicleManagerSandbox';
import { TripManagerSandbox } from './components/TripManagerSandbox';
import { ExpenseManagerSandbox } from './components/ExpenseManagerSandbox';
import { LogbookExporterSandbox } from './components/LogbookExporterSandbox';
import { FavoritePlacesSandbox } from './components/FavoritePlacesSandbox';
import { NaturalLanguageQuerySandbox } from './components/NaturalLanguageQuerySandbox';
import { mockTrips, mockExpenses } from './constants/mockData';

const App: React.FC = () => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const { activeId } = useHeadingsObserver();
  const [currentUser, setCurrentUser] = useState<User | null>(null);


  // State for Task Generator Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // State for Route Planner Sandbox
  const [routeResult, setRouteResult] = useState<string>('');
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [isFindingRoute, setIsFindingRoute] = useState<boolean>(false);
  const [identifiedTolls, setIdentifiedTolls] = useState<string[]>([]);

  // State for Receipt Scanner
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [scanError, setScanError] = useState<string>('');

  // State for Natural Language Query Sandbox
  interface ChatMessage {
    role: 'user' | 'model';
    content: string;
  }
  const [nlqMessages, setNlqMessages] = useState<ChatMessage[]>([]);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [nlqError, setNlqError] = useState<string>('');


  const parseHeadings = useCallback((markdown: string): Heading[] => {
    const headingLines = markdown.match(/^(#+)\s+(.*)/gm) || [];
    return headingLines.map((line) => {
      const level = (line.match(/#/g) || []).length;
      const text = line.replace(/#+\s*/, '').trim();
      const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
      return { id, text, level };
    });
  }, []);

  useEffect(() => {
    setHeadings(parseHeadings(markdownContent));
  }, [parseHeadings]);

  const handleGenerateTasks = async (storyTitle: string) => {
    setIsModalOpen(true);
    setModalTitle(`Generating tasks for: ${storyTitle}`);
    setIsLoadingTasks(true);
    setModalContent('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are an expert engineering manager creating tickets for a sprint. Based on the following user story, break it down into a list of actionable development sub-tasks for a development team.
      
User Story: "${storyTitle}"

Provide a list of tasks covering:
- Frontend (React Native)
- Backend (Node.js/Express)
- Database (PostgreSQL)
- Testing (Unit, Integration, E2E)

Format the output as a clean markdown list.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      setModalContent(response.text);
    } catch (error) {
      console.error("Error generating tasks:", error);
      setModalContent("Sorry, there was an error generating the tasks. Please check the console and try again.");
    } finally {
      setIsLoadingTasks(false);
      setModalTitle(`Suggested Tasks for: ${storyTitle}`);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  const parseTollsFromResult = (text: string): string[] => {
    const tollSectionMatch = text.match(/Toll Roads:([\s\S]*)/i);
    if (!tollSectionMatch) {
      return [];
    }
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

      const location: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
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
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude, longitude }
            }
          }
        }
      });
      
      setRouteResult(response.text);
      setIdentifiedTolls(parseTollsFromResult(response.text));
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setGroundingChunks(response.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[]);
      }

    } catch (error) {
       console.error("Error finding route:", error);
       if (error instanceof GeolocationPositionError) {
         setRouteResult("Could not get your location. Please ensure location permissions are enabled for this site and try again.");
       } else {
         setRouteResult("Sorry, there was an error finding the route. Please check the console and try again.");
       }
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
      setIdentifiedTolls([]); // Clear old tolls as the new route will be different

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const location: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
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
            toolConfig: {
              retrievalConfig: {
                latLng: { latitude, longitude }
              }
            }
          }
        });
        
        setRouteResult(response.text);
         if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
           setGroundingChunks(response.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[]);
         }
      } catch (error) {
         console.error("Error refining route:", error);
         setRouteResult("Sorry, there was an error refining the route. Please check the console and try again.");
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
      
      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: base64Image,
        },
      };

      const textPart = {
        text: `Analyze this receipt image and extract the following information. If a value is not found, return null for that field.
        - The primary vendor or store name.
        - The final total amount.
        - The transaction date.`
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendor: { type: Type.STRING, description: 'The name of the vendor or store.' },
              amount: { type: Type.NUMBER, description: 'The total amount of the transaction.' },
              date: { type: Type.STRING, description: 'The transaction date in YYYY-MM-DD format.' },
            },
          },
        },
      });
      
      const jsonResponse = JSON.parse(response.text);
      setScannedData(jsonResponse as ScannedReceiptData);

    } catch (error) {
      console.error("Error scanning receipt:", error);
      setScanError("Sorry, Gemini couldn't read that receipt. Please try another image or enter the details manually.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleNaturalLanguageQuery = async (query: string) => {
    setIsQuerying(true);
    setNlqError('');
    const newMessages: ChatMessage[] = [...nlqMessages, { role: 'user', content: query }];
    setNlqMessages(newMessages);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `You are an expert data analyst for an app called "SubRoute", which helps courier drivers manage their trips and expenses. Your task is to answer questions from the user based *only* on the JSON data provided below. Do not make up any information.
      
- Today's date is ${new Date().toLocaleDateString('en-CA')}.
- When asked about "last month" or "this month", calculate based on today's date.
- Present your answers in a clear, friendly, and concise manner.
- If the user asks for a list of items (like all fuel expenses), format it as a markdown list.
- If you cannot answer the question with the provided data, politely state that the information is not available in the logbook.

Here is the user's data:

**Trips:**
\`\`\`json
${JSON.stringify(mockTrips, null, 2)}
\`\`\`

**Expenses:**
\`\`\`json
${JSON.stringify(mockExpenses, null, 2)}
\`\`\`

---

**User's Question:** "${query}"

**Your Answer:**
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      
      setNlqMessages([...newMessages, { role: 'model', content: response.text }]);

    } catch (error) {
      console.error("Error with natural language query:", error);
      setNlqError("Sorry, there was an error processing your question. Please try again.");
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="bg-brand-gray-100 min-h-screen font-sans">
      <header className="bg-white border-b border-brand-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
           <div className="flex items-center space-x-3">
             <svg className="w-8 h-8 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V7.618a1 1 0 011.447-.894L9 9m0 11l6-3m-6 3V9m6 8l5.447 2.724A1 1 0 0021 16.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
             <h1 className="text-2xl font-bold text-brand-gray-900">SubRoute Project Planner</h1>
           </div>
           <span className="text-sm font-medium text-brand-gray-600">Architectural Review & Actionable Roadmap</span>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-8">
              <TableOfContents headings={headings.filter(h => h.level > 1)} activeId={activeId} />
               <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
                <h3 className="text-lg font-semibold text-brand-gray-800 mb-4 border-b pb-2">Application Build</h3>
                 <p className="text-sm text-brand-gray-600">
                   As we build the SubRoute app, components and prototypes will appear here. This section serves as a living preview of the application's progress.
                 </p>
               </div>
            </div>
          </aside>
          
          <div className="lg:col-span-3 space-y-8">
             <section id="app-prototypes">
               <h2 className="text-2xl font-bold text-brand-gray-800 mb-4">Application Prototypes & Components</h2>
               <div className="space-y-8">
                  <AuthSandbox onLoginSuccess={setCurrentUser} currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
                  <VehicleManagerSandbox currentUser={currentUser} />
                  <FavoritePlacesSandbox />
                  <TripManagerSandbox />
                  <ExpenseManagerSandbox 
                    onScanReceipt={handleScanReceipt}
                    scannedData={scannedData}
                    isScanning={isScanning}
                    scanError={scanError}
                  />
                  <NaturalLanguageQuerySandbox
                    onQuery={handleNaturalLanguageQuery}
                    messages={nlqMessages}
                    isLoading={isQuerying}
                    error={nlqError}
                  />
                  <LogbookExporterSandbox />
                  <RoutePlannerSandbox 
                      onFindRoute={handleFindRoute}
                      onRefineRoute={handleRefineRoute}
                      result={routeResult}
                      groundingChunks={groundingChunks}
                      isLoading={isFindingRoute}
                      identifiedTolls={identifiedTolls}
                    />
               </div>
             </section>
             
            <section id="project-documentation" className="pt-8">
              <div className="bg-white rounded-lg shadow-sm border border-brand-gray-200 overflow-hidden">
                 <div className="p-8 md:p-12">
                    <MarkdownViewer content={markdownContent} onGenerateTasks={handleGenerateTasks} />
                 </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      <TaskGeneratorModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        content={modalContent}
        isLoading={isLoadingTasks}
      />
    </div>
  );
};

export default App;
