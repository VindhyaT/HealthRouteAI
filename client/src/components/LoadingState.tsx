import { LoaderCircle } from 'lucide-react';
export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <div className="loading" role="status"><LoaderCircle className="loading-spinner" size={20} aria-hidden="true"/><span>{label}</span></div>;
}
