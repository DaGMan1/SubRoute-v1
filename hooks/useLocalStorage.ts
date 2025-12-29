import { useState, useEffect } from 'react';

/**
 * Custom hook for syncing state with localStorage
 *
 * Automatically reads from localStorage on mount and writes on every state change.
 * Handles JSON parsing/stringify and error cases gracefully.
 *
 * @param key - localStorage key
 * @param initialValue - Default value if key doesn't exist or parsing fails
 * @returns [value, setValue] tuple (same API as useState)
 *
 * @example
 * ```typescript
 * const [vehicles, setVehicles] = useLocalStorage<Vehicle[]>('subroute_vehicles', []);
 *
 * // Use just like useState:
 * setVehicles([...vehicles, newVehicle]);
 * setVehicles(prev => prev.filter(v => v.id !== id));
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get initial value from localStorage or use initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage whenever storedValue changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
