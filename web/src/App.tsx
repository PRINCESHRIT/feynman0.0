import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { bootWorker, setSolveCallbacks } from './solver/solveController';
import { useStore } from './state/store';

export default function App() {
  useEffect(() => {
    // F0.1: Boot worker at app load — idle, ready to accept jobs
    bootWorker();

    // Wire SolveController callbacks to Zustand store
    const store = useStore.getState;
    setSolveCallbacks({
      onStatus: (status) => {
        if (status === 'inline_fallback') {
          useStore.setState({ inlineFallback: true, solverStatus: 'idle' });
        } else {
          useStore.setState({ solverStatus: status });
        }
      },
      onProgress: (progress) => {
        useStore.setState({ solverProgress: progress });
      },
      onResult: (result) => {
        useStore.setState({ solveResult: result });
      },
    });
  }, []);

  return <Layout />;
}
