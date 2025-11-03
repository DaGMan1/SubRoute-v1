
import React from 'react';
import type { Components } from 'react-markdown';

// Assume these are globally available from the CDN scripts in index.html
declare const ReactMarkdown: any;
declare const remarkGfm: any;
declare const rehypeRaw: any;

interface MarkdownViewerProps {
  content: string;
}

const headingToId = (text: string) => {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
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
    // FIX: Add h4, h5, and h6 to ensure they get IDs for the table of contents.
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
    li: (props) => <li className="pl-2" {...props} />,
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
