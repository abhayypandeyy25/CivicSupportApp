import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className={`${sizeClass} animate-spin text-indigo-600`} />
    </div>
  );
}
