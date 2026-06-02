import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, FileText, IndianRupee, Landmark } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';

export const formatIndianCurrency = (value) => {
  const rupees = value / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(rupees);
};

export const getPlatformBadge = (platform) => {
  const plat = platform ? platform.toLowerCase() : '';
  if (plat === 'meesho') return <span className="platform-badge-meesho">Meesho</span>;
  if (plat === 'flipkart') return <span className="platform-badge-flipkart">Flipkart</span>;
  if (plat === 'amazon') return <span className="platform-badge-amazon">Amazon</span>;
  return <span className="bg-slate-100 border border-slate-200 text-slate-800 rounded px-2.5 py-0.5 text-xs font-semibold uppercase">{platform}</span>;
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardSummary();
  }, []);

  const fetchDashboardSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/dashboard/summary`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load dashboard summary', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="text-sm font-semibold text-slate-500">Loading Dashboard...</span>
      </div>
    );
  }

  const { metrics, topProducts, accountSummary, labelsSummary } = data || {
    metrics: { totalPieces: 0, totalLabels: 0, totalRevenue: 0, activeAccounts: 0 },
    topProducts: [],
    accountSummary: [],
    labelsSummary: []
  };

  const metricCards = [
    { title: 'Total Pieces Sold', value: metrics.totalPieces, icon: <Package size={22} className="text-blue-500" />, bg: 'bg-blue-50 border-blue-100' },
    { title: 'Total Labels Required', value: metrics.totalLabels, icon: <FileText size={22} className="text-orange-500" />, bg: 'bg-orange-50 border-orange-100' },
    { title: 'Total Revenue', value: formatIndianCurrency(metrics.totalRevenue), icon: <IndianRupee size={22} className="text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-100', textClass: 'text-emerald-600' },
    { title: 'Active Accounts', value: metrics.activeAccounts, icon: <Landmark size={22} className="text-violet-500" />, bg: 'bg-violet-50 border-violet-100' },
  ];

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="Dashboard" />
      
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {metricCards.map((card, idx) => (
            <div key={idx} className={`p-6 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-sm`}>
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.title}</span>
                <h3 className={`text-2xl font-bold tracking-tight ${card.textClass || 'text-slate-900'}`}>{card.value}</h3>
              </div>
              <div className={`p-3 rounded-full ${card.bg}`}>
                {card.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Chart & Accounts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Top Products Bar Chart */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 lg:col-span-2 shadow-sm flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-md font-bold text-slate-800">Top 6 Products</h3>
              <p className="text-xs text-slate-400 font-medium">Pieces sold by product model</p>
            </div>
            
            <div className="h-64 w-full">
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                    <Bar dataKey="pieces" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No sales recorded today
                </div>
              )}
            </div>
          </div>

          {/* Account Revenue Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold text-slate-800">Account-wise Sales</h3>
              <p className="text-xs text-slate-400 font-medium mb-4">Total performance across channels</p>
            </div>

            <div className="overflow-y-auto flex-1 h-64 border border-slate-100 rounded">
              {accountSummary.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-2.5 px-3">Account</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountSummary.map((acc, index) => (
                      <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-800">{acc.name}</span>
                            <div className="flex">{getPlatformBadge(acc.platform)}</div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-600">{acc.pieces}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{formatIndianCurrency(acc.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  No account activity found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Labels Calculation Summary Table */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-md font-bold text-slate-800">Label & Price Calculation Summary</h3>
            <p className="text-xs text-slate-400 font-medium">Automatic billing breakdown for all transactions</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded">
            {labelsSummary.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-3 px-4">Marketplace SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-center">Qty Sold</th>
                    <th className="py-3 px-4 text-center">Labels/Unit</th>
                    <th className="py-3 px-4 text-center">Total Labels</th>
                    <th className="py-3 px-4 text-right">Price per Label</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {labelsSummary.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-medium">
                        <span className="sku-badge">{item.sku}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-semibold">{item.productName}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">{item.qtySold}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">{item.labelsPerUnit}</td>
                      <td className="py-3 px-4 text-center font-bold text-blue-600">{item.totalLabels}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        {formatIndianCurrency(item.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatIndianCurrency(item.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-slate-400">
                No orders processed yet. Upload PDF reports to calculate labels.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
