import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Products from './pages/Products';
import SKUMapping from './pages/SKUMapping';
import Accounts from './pages/Accounts';
import DailyReport from './pages/DailyReport';
import MonthlyReport from './pages/MonthlyReport';
import Login from './pages/Login';

// Protected layout wrapper
const ProtectedLayout = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar fixed 200px width */}
      <Sidebar />
      
      {/* Main Content Area pushed left by 200px */}
      <main className="flex-1 pl-[200px]">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public login */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard and inner pages */}
        <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
        <Route path="/import" element={<ProtectedLayout><Import /></ProtectedLayout>} />
        <Route path="/products" element={<ProtectedLayout><Products /></ProtectedLayout>} />
        <Route path="/sku-mappings" element={<ProtectedLayout><SKUMapping /></ProtectedLayout>} />
        <Route path="/accounts" element={<ProtectedLayout><Accounts /></ProtectedLayout>} />
        <Route path="/daily-report" element={<ProtectedLayout><DailyReport /></ProtectedLayout>} />
        <Route path="/monthly-report" element={<ProtectedLayout><MonthlyReport /></ProtectedLayout>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
