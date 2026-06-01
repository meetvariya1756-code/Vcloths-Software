import React, { useState, useEffect } from 'react';
import { Landmark, Plus, Search, ChevronDown, ChevronUp, Edit3, Settings2 } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';
import { formatIndianCurrency, getPlatformBadge } from './Dashboard';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modals / Forms
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('meesho');
  const [notes, setNotes] = useState('');

  // Editing Overrides
  const [editingProductId, setEditingProductId] = useState(null);
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExpandAccount = async (id) => {
    if (expandedAccountId === id) {
      setExpandedAccountId(null);
      setExpandedDetails(null);
      return;
    }

    setExpandedAccountId(id);
    setLoadingDetails(true);
    try {
      const response = await api.get(`/accounts/${id}/summary`);
      setExpandedDetails(response.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddAccountSubmit = async (e) => {
    e.preventDefault();
    if (!name || !platform) {
      alert('Please fill out all required fields');
      return;
    }

    try {
      await api.post('/accounts', {
        name,
        platform,
        notes
      });
      setIsAddModalOpen(false);
      setName('');
      setPlatform('meesho');
      setNotes('');
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create account');
    }
  };

  const handleSavePriceOverride = async (productId) => {
    if (customPrice === '') return;
    try {
      const pricePaisa = Math.round(parseFloat(customPrice) * 100);
      await api.put(`/accounts/${expandedAccountId}/prices`, {
        product_id: productId,
        price: pricePaisa
      });
      
      // Reload expanded details
      const response = await api.get(`/accounts/${expandedAccountId}/summary`);
      setExpandedDetails(response.data);
      setEditingProductId(null);
      setCustomPrice('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save price override');
    }
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 min-h-screen">
      <Header title="Seller Account Manager" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md bg-white border border-slate-200 rounded-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search account name or platform..."
              className="w-full pl-10 pr-4 py-2 border-0 bg-transparent text-sm focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition-all"
          >
            <Plus size={16} />
            Add New Account
          </button>
        </div>

        {/* Accounts Table list */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <th className="py-3.5 px-6">Account Name</th>
                <th className="py-3.5 px-4">Sales Platform</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc) => (
                <React.Fragment key={acc.id}>
                  
                  {/* Standard Row */}
                  <tr
                    onClick={() => handleExpandAccount(acc.id)}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-all ${
                      expandedAccountId === acc.id ? 'bg-blue-50/10' : ''
                    }`}
                  >
                    <td className="py-4 px-6 font-bold text-slate-850 text-sm">
                      <div className="flex items-center gap-3">
                        {expandedAccountId === acc.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        {acc.name}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getPlatformBadge(acc.platform)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        acc.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {acc.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-450 italic font-medium">
                      {acc.notes || <span className="text-slate-300 font-normal">No notes written</span>}
                    </td>
                  </tr>

                  {/* Expand Row */}
                  {expandedAccountId === acc.id && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50/50 p-6 border-b border-slate-200">
                        {loadingDetails ? (
                          <div className="py-6 text-center text-xs text-slate-400 font-semibold animate-pulse">
                            Loading Account pricing overrides & statistics...
                          </div>
                        ) : expandedDetails ? (
                          <div className="space-y-6">
                            
                            {/* Performance Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              
                              {/* Account metrics */}
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Account Sales Performance</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Today's Qty</span>
                                    <p className="text-lg font-extrabold text-slate-800">{expandedDetails.stats.today.pieces} pcs</p>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Today's Revenue</span>
                                    <p className="text-lg font-extrabold text-emerald-600">{formatIndianCurrency(expandedDetails.stats.today.revenue)}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">This Month's Qty</span>
                                    <p className="text-lg font-extrabold text-slate-800">{expandedDetails.stats.month.pieces} pcs</p>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">This Month's Revenue</span>
                                    <p className="text-lg font-extrabold text-emerald-600">{formatIndianCurrency(expandedDetails.stats.month.revenue)}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Product-wise Sales breakdown */}
                              <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col justify-between">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight mb-2">Product-wise Sales</h4>
                                <div className="overflow-y-auto max-h-36 border border-slate-100 rounded text-xs">
                                  {expandedDetails.sales_breakdown.length > 0 ? (
                                    <table className="w-full text-left">
                                      <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                                          <th className="py-2 px-3">Product Model</th>
                                          <th className="py-2 px-3 text-center">Qty</th>
                                          <th className="py-2 px-3 text-right">Revenue</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {expandedDetails.sales_breakdown.map((item, index) => (
                                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                                            <td className="py-2 px-3 font-semibold text-slate-700">{item.product_name}</td>
                                            <td className="py-2 px-3 text-center text-slate-600">{item.quantity}</td>
                                            <td className="py-2 px-3 text-right text-emerald-600 font-bold">{formatIndianCurrency(item.revenue)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="py-6 text-center text-slate-400">No sales recorded yet</div>
                                  )}
                                </div>
                              </div>

                            </div>

                            {/* Pricing overrides Table */}
                            <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-4">
                              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                                <Settings2 size={14} className="text-slate-400" />
                                Product Pricing Rules & Overrides
                              </h4>
                              
                              <div className="overflow-x-auto border border-slate-100 rounded text-xs">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                                      <th className="py-3 px-4">Product Name</th>
                                      <th className="py-3 px-4">Category</th>
                                      <th className="py-3 px-4 text-right">Base Product Price</th>
                                      <th className="py-3 px-4 text-right">Account Specific Price</th>
                                      <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedDetails.products.map(p => (
                                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="py-3 px-4 font-bold text-slate-800">{p.name}</td>
                                        <td className="py-3 px-4 text-slate-500 font-medium">{p.category}</td>
                                        <td className="py-3 px-4 text-right font-medium text-slate-500">
                                          {formatIndianCurrency(p.base_price)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          {editingProductId === p.id ? (
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={customPrice}
                                              onChange={(e) => setCustomPrice(e.target.value)}
                                              className="w-24 px-2 py-1 border border-slate-200 rounded text-right focus:outline-none focus:border-blue-500 font-bold"
                                              placeholder={(p.custom_price ? p.custom_price / 100 : p.base_price / 100).toString()}
                                            />
                                          ) : (
                                            p.custom_price ? (
                                              <span className="font-extrabold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                                                {formatIndianCurrency(p.custom_price)}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 italic">Inheriting Base Price</span>
                                            )
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          {editingProductId === p.id ? (
                                            <div className="space-x-2">
                                              <button
                                                onClick={() => handleSavePriceOverride(p.id)}
                                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold"
                                              >
                                                Save
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingProductId(null);
                                                  setCustomPrice('');
                                                }}
                                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                setEditingProductId(p.id);
                                                setCustomPrice(p.custom_price ? (p.custom_price / 100).toString() : (p.base_price / 100).toString());
                                              }}
                                              className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200 rounded text-[10px] font-bold transition-all ml-auto"
                                            >
                                              <Edit3 size={11} />
                                              Override
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                          </div>
                        ) : (
                          <div className="py-6 text-center text-xs text-red-400">Failed to load statistics</div>
                        )}
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-6 shadow-xl">
            <div>
              <h3 className="text-md font-bold text-slate-800">Add Account</h3>
              <p className="text-xs text-slate-400 font-medium">Add a sales account to start parsing platform PDFs and reports</p>
            </div>

            <form onSubmit={handleAddAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Account Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Lakhela, Means Ketla"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sales Channel Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white"
                  required
                >
                  <option value="meesho">Meesho (Blue)</option>
                  <option value="flipkart">Flipkart (Orange)</option>
                  <option value="amazon">Amazon (Green)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notes / Description</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Primary Meesho store"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
