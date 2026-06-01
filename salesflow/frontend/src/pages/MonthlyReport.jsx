import React, { useState, useEffect } from 'react';
import { Calendar, FileSpreadsheet, Package, FileText, IndianRupee, LineChart as ChartIcon, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../api';
import Header from '../components/Header';
import { formatIndianCurrency } from './Dashboard';

export default function MonthlyReport() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedMonth, selectedYear]);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/monthly', {
        params: {
          month: selectedMonth,
          year: selectedYear
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
      const response = await api.get('/reports/monthly/export', {
        params: {
          month: selectedMonth,
          year: selectedYear
        },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Monthly_Report_${selectedYear}_${selectedMonth}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export Monthly Excel Report');
    } finally {
      setExporting(false);
    }
  };

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' }
  ];

  const years = ['2024', '2025', '2026', '2027', '2028'];

  const { metrics, topProducts, accountRevenue, dayWise, productTable } = reportData || {
    metrics: { totalPieces: 0, totalLabels: 0, totalRevenue: 0 },
    topProducts: [],
    accountRevenue: [],
    dayWise: [],
    productTable: []
  };

  const cards = [
    { title: 'Total Pieces Sold', value: metrics.totalPieces, icon: <Package size={20} className="text-blue-500" />, bg: 'bg-blue-50' },
    { title: 'Labels Required', value: metrics.totalLabels, icon: <FileText size={20} className="text-orange-500" />, bg: 'bg-orange-50' },
    { title: 'Monthly Revenue', value: formatIndianCurrency(metrics.totalRevenue), icon: <IndianRupee size={20} className="text-emerald-500" />, bg: 'bg-emerald-50', textClass: 'text-emerald-600 font-extrabold' }
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="Monthly Analytics & Summaries" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Filter controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
          <div className="flex flex-wrap items-center gap-6">
            
            {/* Month select */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-semibold"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Year select */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-semibold"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || productTable.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-xs font-bold transition-all justify-center"
          >
            <FileSpreadsheet size={16} />
            {exporting ? 'Generating Excel...' : 'Export Monthly Summary (.xlsx)'}
          </button>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* Charts and distributions */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-xs animate-pulse bg-white border border-slate-200 rounded-lg shadow-sm">
            Generating Monthly Report & Charts...
          </div>
        ) : (
          <>
            {/* Top Products & Channel Revenue Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Product graph */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <BarChart2 size={18} className="text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-850">Top Selling Products by Quantity</h3>
                </div>
                <div className="h-56 w-full">
                  {topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Bar dataKey="quantity" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-450 text-xs">No product sales data</div>
                  )}
                </div>
              </div>

              {/* Account Revenue graph */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <BarChart2 size={18} className="text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-850">Seller Account Revenue Share</h3>
                </div>
                <div className="h-56 w-full">
                  {accountRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={accountRevenue} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <YAxis tickFormatter={(val) => `₹${val / 100000}L`} tick={{ fontSize: 9 }} />
                        <Tooltip formatter={(value) => formatIndianCurrency(value)} />
                        <Bar dataKey="revenue" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-450 text-xs">No revenue distribution history</div>
                  )}
                </div>
              </div>

            </div>

            {/* Daily Trend Line Chart */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ChartIcon size={18} className="text-slate-400" />
                <h3 className="text-sm font-bold text-slate-850">Daily Sales Velocity (Pieces Sold per Day)</h3>
              </div>
              <div className="h-56 w-full">
                {dayWise.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dayWise}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="pieces" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-455 text-xs">No daily transactions found</div>
                )}
              </div>
            </div>

            {/* Product wise Monthly Summary table */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-md font-bold text-slate-800">Product Model Monthly Performance Table</h3>
                <p className="text-xs text-slate-400 font-medium">Aggregated metrics detailing items, required labels, and invoice value</p>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded">
                {productTable.length > 0 ? (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                        <th className="py-3 px-4">Product Model</th>
                        <th className="py-3 px-4 text-center">Total Qty Sold</th>
                        <th className="py-3 px-4 text-center">Total Labels Required</th>
                        <th className="py-3 px-4 text-right">Total Revenue (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productTable.map((row, index) => (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-bold text-slate-800">{row.name}</td>
                          <td className="py-3.5 px-4 text-center font-medium text-slate-600">{row.quantity}</td>
                          <td className="py-3.5 px-4 text-center font-semibold text-blue-600">{row.total_labels}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                            {formatIndianCurrency(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-8 text-center text-slate-400">No monthly summaries generated</div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
