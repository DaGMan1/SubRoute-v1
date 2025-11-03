
import { useState, useEffect, useRef } from 'react';

export const useHeadingsObserver = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (visibleEntries.length > 0) {
        // Find the topmost visible heading
        visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveId(visibleEntries[0].target.id);
      }
    };

    observer.current = new IntersectionObserver(handleObserver, {
      rootMargin: '-20% 0px -80% 0px', // Trigger when heading is in the top 20% of the viewport
      threshold: 0,
    });
    
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    elements.forEach((elem) => observer.current?.observe(elem));

    return () => observer.current?.disconnect();
  }, []);

  return { activeId };
};
