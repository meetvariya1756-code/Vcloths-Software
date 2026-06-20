import React, { useState, useEffect } from 'react';
import { Landmark, Plus, Search, ChevronDown, ChevronUp, Edit3, Settings2, Trash2 } from 'lucide-react';
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
  const [meeshoSupplierId, setMeeshoSupplierId] = useState('');
  const [meeshoUsername, setMeeshoUsername] = useState('');
  const [meeshoPassword, setMeeshoPassword] = useState('');
  const [flipkartSupplierId, setFlipkartSupplierId] = useState('');
  const [flipkartUsername, setFlipkartUsername] = useState('');
  const [flipkartPassword, setFlipkartPassword] = useState('');

  // Edit Account Modal / Form
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPlatform, setEditPlatform] = useState('meesho');
  const [editNotes, setEditNotes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editMeeshoSupplierId, setEditMeeshoSupplierId] = useState('');
  const [editMeeshoUsername, setEditMeeshoUsername] = useState('');
  const [editMeeshoPassword, setEditMeeshoPassword] = useState('');
  const [editFlipkartSupplierId, setEditFlipkartSupplierId] = useState('');
  const [editFlipkartUsername, setEditFlipkartUsername] = useState('');
  const [editFlipkartPassword, setEditFlipkartPassword] = useState('');

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
      const payload = {
        name,
        platform,
        notes,
        is_active: true
      };

      if (platform === 'meesho') {
        payload.meesho_supplier_id = meeshoSupplierId.trim() || null;
        payload.meesho_username = meeshoUsername.trim() || null;
        payload.meesho_password = meeshoPassword.trim() || null;
      } else if (platform === 'flipkart') {
        payload.flipkart_supplier_id = flipkartSupplierId.trim() || null;
        payload.flipkart_username = flipkartUsername.trim() || null;
        payload.flipkart_password = flipkartPassword.trim() || null;
      }

      await api.post('/accounts', payload);
      setIsAddModalOpen(false);
      setName('');
      setPlatform('meesho');
      setNotes('');
      setMeeshoSupplierId('');
      setMeeshoUsername('');
      setMeeshoPassword('');
      setFlipkartSupplierId('');
      setFlipkartUsername('');
      setFlipkartPassword('');
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create account');
    }
  };

  const handleOpenEditModal = (acc) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditPlatform(acc.platform);
    setEditNotes(acc.notes || '');
    setEditIsActive(acc.is_active);
    setEditMeeshoSupplierId(acc.meesho_supplier_id || '');
    setEditMeeshoUsername(acc.meesho_username || '');
    setEditMeeshoPassword(acc.meesho_password || '');
    setEditFlipkartSupplierId(acc.flipkart_supplier_id || '');
    setEditFlipkartUsername(acc.flipkart_username || '');
    setEditFlipkartPassword(acc.flipkart_password || '');
    setIsEditModalOpen(true);
  };

  const handleEditAccountSubmit = async (e) => {
    e.preventDefault();
    if (!editName || !editPlatform) {
      alert('Please fill out all required fields');
      return;
    }

    try {
      const payload = {
        name: editName,
        platform: editPlatform,
        notes: editNotes,
        is_active: editIsActive
      };

      if (editPlatform === 'meesho') {
        payload.meesho_supplier_id = editMeeshoSupplierId.trim() || null;
        payload.meesho_username = editMeeshoUsername.trim() || null;
        payload.meesho_password = editMeeshoPassword.trim() || null;
      } else if (editPlatform === 'flipkart') {
        payload.flipkart_supplier_id = editFlipkartSupplierId.trim() || null;
        payload.flipkart_username = editFlipkartUsername.trim() || null;
        payload.flipkart_password = editFlipkartPassword.trim() || null;
      }

      await api.put(`/accounts/${editingAccount.id}`, payload);
      setIsEditModalOpen(false);
      setEditingAccount(null);
      fetchAccounts();
      if (expandedAccountId === editingAccount.id) {
        // Refresh expanded details too
        handleExpandAccount(editingAccount.id);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update account');
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

  const handleDeleteAccount = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete account "${name}"? This will permanently delete all associated sales records, price overrides, and PDF imports.`)) {
      try {
        await api.delete(`/accounts/${id}`);
        fetchAccounts();
        if (expandedAccountId === id) {
          setExpandedAccountId(null);
          setExpandedDetails(null);
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete account');
      }
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
                <th className="py-3.5 px-6 text-right">Actions</th>
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
                    <td className="py-4 px-4 space-y-1">
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {acc.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      {acc.platform === 'meesho' && (
                        <div>
                          {acc.meesho_sync_status === 'syncing' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                              Syncing...
                            </span>
                          ) : acc.meesho_sync_status === 'success' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={acc.meesho_last_sync ? `Last Synced: ${new Date(acc.meesho_last_sync).toLocaleString()}` : ''}>
                              Synced
                            </span>
                          ) : acc.meesho_sync_status === 'failed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Sync temporarily unavailable. Please try again in a few minutes.">
                              Sync Failed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              No Sync
                            </span>
                          )}
                        </div>
                      )}
                      {acc.platform === 'flipkart' && (
                        <div>
                          {acc.flipkart_sync_status === 'syncing' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 animate-pulse">
                              Syncing...
                            </span>
                          ) : acc.flipkart_sync_status === 'success' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={acc.flipkart_last_sync ? `Last Synced: ${new Date(acc.flipkart_last_sync).toLocaleString()}` : ''}>
                              Synced
                            </span>
                          ) : acc.flipkart_sync_status === 'failed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Sync temporarily unavailable. Please try again in a few minutes.">
                              Sync Failed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              No Sync
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-450 italic font-medium">
                      {acc.notes || <span className="text-slate-300 font-normal">No notes written</span>}
                    </td>
                    <td className="py-4 px-6 text-right space-x-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(acc);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-all inline-block"
                        title="Edit Account Details"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAccount(acc.id, acc.name);
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all inline-block"
                        title="Delete Account"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>

                  {/* Expand Row */}
                  {expandedAccountId === acc.id && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50/50 p-6 border-b border-slate-200">
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
                                <div className="flex justify-between items-start">
                                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Account Info & Metrics</h4>
                                  {acc.platform === 'meesho' && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await api.post(`/accounts/${acc.id}/sync`);
                                          alert('Sync triggered in background.');
                                          // Refresh expand view
                                          handleExpandAccount(acc.id);
                                        } catch (err) {
                                          alert('Failed to trigger sync: ' + (err.response?.data?.error || err.message));
                                        }
                                      }}
                                      disabled={acc.meesho_sync_status === 'syncing'}
                                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-[10px] font-bold transition-all shadow-sm"
                                    >
                                      {acc.meesho_sync_status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                                    </button>
                                  )}
                                  {acc.platform === 'flipkart' && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          await api.post(`/accounts/${acc.id}/sync`);
                                          alert('Sync triggered in background.');
                                          // Refresh expand view
                                          handleExpandAccount(acc.id);
                                        } catch (err) {
                                          alert('Failed to trigger sync: ' + (err.response?.data?.error || err.message));
                                        }
                                      }}
                                      disabled={acc.flipkart_sync_status === 'syncing'}
                                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-[10px] font-bold transition-all shadow-sm"
                                    >
                                      {acc.flipkart_sync_status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                                    </button>
                                  )}
                                </div>

                                {acc.platform === 'meesho' && (
                                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5 font-medium">
                                    <div className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Meesho Connection Details</div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Supplier ID:</span>
                                      <span className="font-mono font-bold text-slate-700">{acc.meesho_supplier_id || <span className="text-slate-350 italic font-normal">Not configured</span>}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Login ID / Username:</span>
                                      <span className="font-mono font-bold text-slate-700">{acc.meesho_username || <span className="text-slate-350 italic font-normal">Not configured</span>}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Last Synced:</span>
                                      <span className="text-slate-700">{acc.meesho_last_sync ? new Date(acc.meesho_last_sync).toLocaleString() : <span className="text-slate-350 italic font-normal">Never synced</span>}</span>
                                    </div>
                                    {acc.meesho_sync_error && (
                                      <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 p-2 rounded mt-1.5 leading-snug">
                                        <span className="font-extrabold uppercase text-[8px] tracking-wider block text-red-500 mb-0.5">Sync Status</span>
                                        Sync temporarily unavailable. Please try again in a few minutes.
                                      </div>
                                    )}
                                  </div>
                                )}
 
                                {acc.platform === 'flipkart' && (
                                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5 font-medium">
                                    <div className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Flipkart Connection Details</div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Supplier ID:</span>
                                      <span className="font-mono font-bold text-slate-700">{acc.flipkart_supplier_id || <span className="text-slate-350 italic font-normal">Not configured</span>}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Login ID / Username:</span>
                                      <span className="font-mono font-bold text-slate-700">{acc.flipkart_username || <span className="text-slate-350 italic font-normal">Not configured</span>}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Last Synced:</span>
                                      <span className="text-slate-700">{acc.flipkart_last_sync ? new Date(acc.flipkart_last_sync).toLocaleString() : <span className="text-slate-350 italic font-normal">Never synced</span>}</span>
                                    </div>
                                    {acc.flipkart_sync_error && (
                                      <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 p-2 rounded mt-1.5 leading-snug">
                                        <span className="font-extrabold uppercase text-[8px] tracking-wider block text-red-500 mb-0.5">Sync Status</span>
                                        Sync temporarily unavailable. Please try again in a few minutes.
                                      </div>
                                    )}
                                  </div>
                                )}

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
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full flex flex-col max-h-[90vh] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Add Account</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">Add a sales account to start parsing platform PDFs and reports</p>
            </div>

            <form onSubmit={handleAddAccountSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Account Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 font-semibold"
                    placeholder="e.g. AHANA, BALAPARI"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Sales Channel Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm bg-white font-semibold"
                    required
                  >
                    <option value="meesho">Meesho (Blue)</option>
                    <option value="flipkart">Flipkart (Orange)</option>
                  </select>
                </div>

                {platform === 'meesho' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                    <span className="text-[10px] uppercase font-extrabold text-blue-600 tracking-wider block">Meesho Credentials</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier ID</label>
                        <input
                          type="text"
                          value={meeshoSupplierId}
                          onChange={(e) => setMeeshoSupplierId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. 774827"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username / Phone</label>
                        <input
                          type="text"
                          value={meeshoUsername}
                          onChange={(e) => setMeeshoUsername(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. 9876543210"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                      <input
                        type="password"
                        value={meeshoPassword}
                        onChange={(e) => setMeeshoPassword(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                        placeholder="Enter password"
                        required
                      />
                    </div>
                  </div>
                )}

                {platform === 'flipkart' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                    <span className="text-[10px] uppercase font-extrabold text-orange-600 tracking-wider block">Flipkart Credentials</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier ID</label>
                        <input
                          type="text"
                          value={flipkartSupplierId}
                          onChange={(e) => setFlipkartSupplierId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. FK-BALAPARI"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username / Email</label>
                        <input
                          type="text"
                          value={flipkartUsername}
                          onChange={(e) => setFlipkartUsername(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. admin@vcloths.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                      <input
                        type="password"
                        value={flipkartPassword}
                        onChange={(e) => setFlipkartPassword(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                        placeholder="Enter password"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Notes / Description</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 font-medium resize-none"
                    placeholder="e.g. Primary Meesho store"
                  ></textarea>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded transition-colors"
                >
                  Register Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full flex flex-col max-h-[90vh] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Edit Account Details</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">Modify credentials or details for this sales channel</p>
            </div>

            <form onSubmit={handleEditAccountSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Account Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Sales Channel Platform</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm bg-white font-semibold"
                    required
                  >
                    <option value="meesho">Meesho (Blue)</option>
                    <option value="flipkart">Flipkart (Orange)</option>
                  </select>
                </div>

                {editPlatform === 'meesho' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                    <span className="text-[10px] uppercase font-extrabold text-blue-600 tracking-wider block">Meesho Credentials</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier ID</label>
                        <input
                          type="text"
                          value={editMeeshoSupplierId}
                          onChange={(e) => setEditMeeshoSupplierId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. 774827"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username / Phone</label>
                        <input
                          type="text"
                          value={editMeeshoUsername}
                          onChange={(e) => setEditMeeshoUsername(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. 9876543210"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                      <input
                        type="password"
                        value={editMeeshoPassword}
                        onChange={(e) => setEditMeeshoPassword(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                        placeholder="Enter password"
                        required
                      />
                    </div>
                  </div>
                )}

                {editPlatform === 'flipkart' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                    <span className="text-[10px] uppercase font-extrabold text-orange-600 tracking-wider block">Flipkart Credentials</span>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier ID</label>
                        <input
                          type="text"
                          value={editFlipkartSupplierId}
                          onChange={(e) => setEditFlipkartSupplierId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. FK-BALAPARI"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username / Email</label>
                        <input
                          type="text"
                          value={editFlipkartUsername}
                          onChange={(e) => setEditFlipkartUsername(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                          placeholder="e.g. admin@vcloths.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                      <input
                        type="password"
                        value={editFlipkartPassword}
                        onChange={(e) => setEditFlipkartPassword(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-medium"
                        placeholder="Enter password"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="editIsActive" className="text-xs font-bold text-slate-500 uppercase select-none cursor-pointer">Account Active</label>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">Notes / Description</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 font-medium resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
