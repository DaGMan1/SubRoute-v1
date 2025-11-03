
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MarkdownViewer } from './components/MarkdownViewer';
import { TableOfContents } from './components/TableOfContents';
import { markdownContent } from './constants/markdownContent';
import type { Heading } from './types';
import { useHeadingsObserver } from './hooks/useHeadingsObserver';

const App: React.FC = () => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const { activeId } = useHeadingsObserver();

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
            <div className="sticky top-24">
              <TableOfContents headings={headings} activeId={activeId} />
            </div>
          </aside>
          
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-brand-gray-200 overflow-hidden">
             <div className="p-8 md:p-12">
                <MarkdownViewer content={markdownContent} />
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
