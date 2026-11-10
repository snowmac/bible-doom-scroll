import { createContext, useContext } from 'react';

// Shared services handed down from <App>: { provider, bg, audio, setRef, toast, applyMusic }
export const EngineContext = createContext(null);
export const useEngine = () => useContext(EngineContext);
