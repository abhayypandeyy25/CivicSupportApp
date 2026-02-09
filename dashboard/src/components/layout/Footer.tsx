import { Shield } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Shield className="w-4 h-4" />
            <span className="text-sm">CivicSense — Empowering citizens to improve their city</span>
          </div>
          <div className="text-xs text-gray-400">
            Real-time civic issues dashboard for Delhi
          </div>
        </div>
      </div>
    </footer>
  );
}
