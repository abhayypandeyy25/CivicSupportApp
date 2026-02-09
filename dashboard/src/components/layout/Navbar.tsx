import { NavLink } from 'react-router-dom';
import { Shield, BarChart3, List } from 'lucide-react';

export default function Navbar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`;

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900">CivicSense</span>
          </div>

          <div className="flex items-center gap-2">
            <NavLink to="/" className={linkClass} end>
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </NavLink>
            <NavLink to="/issues" className={linkClass}>
              <List className="w-4 h-4" />
              Issues
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
