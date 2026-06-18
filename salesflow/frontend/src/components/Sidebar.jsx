import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileSpreadsheet,
  FileUp, 
  Package, 
  Shuffle, 
  Users, 
  CalendarDays, 
  BarChart3, 
  LogOut,
  RefreshCw
} from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const navItems = [
    { to: '/', name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/import', name: 'PDF Import', icon: <FileUp size={18} /> },
    { to: '/products', name: 'Products', icon: <Package size={18} /> },
    { to: '/sku-mappings', name: 'SKU Mappings', icon: <Shuffle size={18} /> },
    { to: '/meesho-sync', name: 'Meesho Sync', icon: <RefreshCw size={18} /> },
    { to: '/flipkart-sync', name: 'Flipkart Sync', icon: <RefreshCw size={18} /> },
    { to: '/accounts', name: 'Accounts', icon: <Users size={18} /> },
    { to: '/daily-report', name: 'Daily Report', icon: <CalendarDays size={18} /> },
    { to: '/monthly-report', name: 'Monthly Report', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="w-[200px] h-screen bg-slate-900 text-slate-300 flex flex-col justify-between fixed left-0 top-0 z-20 border-r border-slate-800">
      <div>
        {/* Brand/AppName */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <span className="text-xl font-bold tracking-tight text-white font-serif">SalesFlow</span>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-slate-800/50">
          <p className="text-xs text-slate-500 uppercase font-semibold">Welcome</p>
          <p className="text-sm font-medium text-white truncate">{username}</p>
        </div>

        {/* Nav Links */}
        <nav className="mt-4 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Logout Row */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
