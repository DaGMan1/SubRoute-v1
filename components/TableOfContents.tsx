
import React from 'react';
import type { Heading } from '../types';

interface TableOfContentsProps {
  headings: Heading[];
  activeId: string | null;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ headings, activeId }) => {
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-brand-gray-200">
      <h2 className="text-lg font-semibold text-brand-gray-800 mb-4 border-b pb-2">On this page</h2>
      <nav>
        <ul className="space-y-2">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            const linkClasses = `
              block text-sm
              ${heading.level === 2 ? 'pl-2' : ''}
              ${heading.level === 3 ? 'pl-5' : ''}
              ${heading.level > 3 ? 'pl-8 text-xs' : ''}
              ${isActive
                ? 'text-brand-blue font-semibold border-l-2 border-brand-blue pl-3.5'
                : 'text-brand-gray-600 hover:text-brand-gray-900 border-l-2 border-transparent hover:border-brand-gray-300 pl-3.5'
              }
              transition-all duration-200
            `;
            return (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToHeading(heading.id);
                  }}
                  className={linkClasses}
                >
                  {heading.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
