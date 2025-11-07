
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownViewerProps {
  content: string;
  onGenerateTasks?: (title: string) => void;
}

const headingToId = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, onGenerateTasks }) => {
  const customComponents: { [key: string]: React.ElementType } = {
    h1: ({ node, ...props }) => {
        const id = headingToId(node.children.map((c: any) => c.value).join(''));
        return <h1 id={id} className="text-4xl font-extrabold text-brand-gray-900 mb-6 pb-2 border-b-2 border-brand-blue" {...props} />;
    },
    h2: ({ node, ...props }) => {
        const id = headingToId(node.children.map((c: any) => c.value).join(''));
        return <h2 id={id} className="text-3xl font-bold text-brand-gray-800 mt-12 mb-5 pb-2 border-b border-brand-gray-200" {...props} />;
    },
    h3: ({ node, ...props }) => {
        const id = headingToId(node.children.map((c: any) => c.value).join(''));
        return <h3 id={id} className="text-2xl font-semibold text-brand-gray-800 mt-8 mb-4" {...props} />;
    },
    h4: ({ node, ...props }) => {
        const id = headingToId(node.children.map((c: any) => c.value).join(''));
        return <h4 id={id} className="text-xl font-semibold text-brand-gray-800 mt-6 mb-3" {...props} />;
    },
    h5: ({ node, ...props }) => {
        const id = headingToId(node.children.map((c: any) => c.value).join(''));
        return <h5 id={id} className="text-lg font-semibold text-brand-gray-800 mt-6 mb-3" {...props} />;
    },
    h6: ({ node, ...props }) => {
        const id = headingToId(node.children.map((c: any) => c.value).join(''));
        return <h6 id={id} className="text-base font-semibold text-brand-gray-800 mt-6 mb-3" {...props} />;
    },
    p: (props) => <p className="text-base text-brand-gray-700 mb-4 leading-relaxed" {...props} />,
    ul: (props) => <ul className="list-disc list-outside pl-6 mb-4 space-y-2 text-brand-gray-700" {...props} />,
    ol: (props) => <ol className="list-decimal list-outside pl-6 mb-4 space-y-2 text-brand-gray-700" {...props} />,
    li: ({ node, ...props }) => {
      const firstChild = node.children[0];
      if (firstChild?.type === 'element' && firstChild.tagName === 'p' && onGenerateTasks) {
          const strongChild = firstChild.children[0];
          if (strongChild?.type === 'element' && strongChild.tagName === 'strong') {
              const textChild = strongChild.children[0];
              if (textChild?.type === 'text' && textChild.value.startsWith('Story')) {
                  const storyTitle = textChild.value;
                  return (
                      <li className="pl-2 relative group" {...props}>
                          <div className="flex justify-between items-center">
                              <span>{props.children}</span>
                              <button
                                  onClick={() => onGenerateTasks(storyTitle)}
                                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-blue-100 text-brand-blue px-2 py-1 text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-blue-200"
                                  aria-label={`Generate tasks for ${storyTitle}`}
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  Generate Tasks
                              </button>
                          </div>
                      </li>
                  );
              }
          }
      }
      return <li className="pl-2" {...props} />;
    },
    a: (props) => <a className="text-brand-blue hover:underline" {...props} />,
    blockquote: (props) => <blockquote className="border-l-4 border-brand-blue bg-blue-50 p-4 my-4 text-brand-gray-800 italic" {...props} />,
    code: ({ node, inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <div className="bg-brand-gray-900 text-white p-4 rounded-md my-4 overflow-x-auto text-sm">
           <pre><code className={className} {...props}>{children}</code></pre>
        </div>
      ) : (
        <code className="bg-brand-gray-200 text-brand-gray-800 px-1 py-0.5 rounded-md text-sm" {...props}>
          {children}
        </code>
      );
    },
    table: (props) => <div className="overflow-x-auto my-6"><table className="w-full text-sm text-left text-brand-gray-600" {...props} /></div>,
    thead: (props) => <thead className="text-xs text-brand-gray-700 uppercase bg-brand-gray-100" {...props} />,
    th: (props) => <th scope="col" className="px-6 py-3" {...props} />,
    tbody: (props) => <tbody className="bg-white" {...props} />,
    tr: (props) => <tr className="border-b border-brand-gray-200 hover:bg-brand-gray-50" {...props} />,
    td: (props) => <td className="px-6 py-4" {...props} />,
  };
    
  return (
    <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          children={content}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={customComponents}
        />
    </div>
  );
};