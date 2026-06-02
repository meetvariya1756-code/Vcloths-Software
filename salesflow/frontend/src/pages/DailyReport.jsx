import React, { useState, useEffect } from 'react';
import { Calendar, Filter, FileSpreadsheet, Package, FileText, IndianRupee, Landmark } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';
import { formatIndianCurrency, getPlatformBadge } from './Dashboard';

export default function DailyReport() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate, selectedAccount, selectedPlatform, selectedCategory]);

  const fetchFilters = async () => {
    try {
      const accs = await api.get('/accounts');
      setAccounts(accs.data);

      const prods = await api.get('/products');
      const uniqueCats = Array.from(new Set(prods.data.map(p => p.category)));
      setCategories(uniqueCats);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/daily', {
        params: {
          date: selectedDate,
          accountId: selectedAccount || undefined,
          platform: selectedPlatform || undefined,
          category: selectedCategory || undefined
        }
      });
      setReportData(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const response = await api.get('/reports/daily/export', {
        params: {
          date: selectedDate,
          accountId: selectedAccount || undefined,
          platform: selectedPlatform || undefined,
          category: selectedCategory || undefined
        },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Daily_Report_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel report');
    } finally {
      setExporting(false);
    }
  };

  const metrics = reportData?.metrics || { totalPieces: 0, totalLabels: 0, totalRevenue: 0, activeAccounts: 0 };
  const tableRows = reportData?.table || [];

  const cards = [
    { title: 'Pieces Sold', value: metrics.totalPieces, icon: <Package size={20} className="text-blue-500" />, bg: 'bg-blue-50' },
    { title: 'Labels Required', value: metrics.totalLabels, icon: <FileText size={20} className="text-orange-500" />, bg: 'bg-orange-50' },
    { title: 'Daily Revenue', value: formatIndianCurrency(metrics.totalRevenue), icon: <IndianRupee size={20} className="text-emerald-500" />, bg: 'bg-emerald-50', textClass: 'text-emerald-600' },
    { title: 'Total Accounts', value: metrics.activeAccounts, icon: <Landmark size={20} className="text-violet-500" />, bg: 'bg-violet-50' },
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="Daily Sales & Packing Labels Report" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Date & Filter controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              Report Customization Filters
            </h3>

            <button
              onClick={handleExportExcel}
              disabled={exporting || tableRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-xs font-bold transition-all self-stretch md:self-auto justify-center"
            >
              <FileSpreadsheet size={16} />
              {exporting ? 'Generating Excel...' : 'Export to Excel (.xlsx)'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Date selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Select Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Platform Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
              >
                <option value="">All Channels</option>
                <option value="meesho">Meesho</option>
                <option value="flipkart">Flipkart</option>
                <option value="amazon">Amazon</option>
              </select>
            </div>

            {/* Account Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Seller Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
              >
                <option value="">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.platform.toUpperCase()})</option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Product Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Dynamic Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {cards.map((card, idx) => (
            <div key={idx} className="p-6 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.title}</span>
                <h3 className={`text-xl font-extrabold tracking-tight ${card.textClass || 'text-slate-800'}`}>{card.value}</h3>
              </div>
              <div className={`p-3 rounded-full ${card.bg}`}>
                {card.icon}
              </div>
            </div>
          ))}
        </div>



        {/* Detailed Grid Table */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-md font-bold text-slate-800">SKU-Wise Sales Details & Packed Labels</h3>
            <p className="text-xs text-slate-400 font-medium">Mapped entries grouped by marketplace SKU code</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded">
            {loading ? (
              <div className="py-12 text-center text-slate-400 font-medium animate-pulse text-xs">
                Generating Sales Report...
              </div>
            ) : tableRows.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 font-mono">SKU Code</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Color</th>
                    <th className="py-3 px-4 text-center">Qty Sold</th>
                    <th className="py-3 px-4 text-center">Total Labels</th>
                    <th className="py-3 px-4 text-right">Price / Label (₹)</th>
                    <th className="py-3 px-4 text-right">Total Revenue (₹)</th>
                    <th className="py-3 px-4">Account Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-800">{row.product_name}</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{row.sku}</td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{row.category}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">{row.color || 'Assorted'}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">{row.quantity}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600">{row.total_labels}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {formatIndianCurrency(row.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatIndianCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col sm:flex-row gap-1.5 items-start sm:items-center">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] max-w-[120px] truncate">
                            {row.account_name}
                          </span>
                          {getPlatformBadge(row.platform)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-400">
                No transactions met your filter criteria for this date. Go to PDF Import page to upload reports.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
