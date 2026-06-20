import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, CheckCircle, HelpCircle, Shuffle, ChevronRight, Save,
  Layers, Search, X, Trash2, PlusCircle, CheckSquare, Square,
  LinkIcon, Package, AlertCircle, Zap, Monitor, Wifi
} from 'lucide-react';
import api from '../api';
import Header from '../components/Header';

export default function MeeshoSync() {
  const [accounts, setAccounts] = useState([]);
  const [importedSkus, setImportedSkus] = useState([]);
  const [importedSkusTotal, setImportedSkusTotal] = useState(0);
  const [importedSkusPage, setImportedSkusPage] = useState(1);
  const [importedSkusLoading, setImportedSkusLoading] = useState(false);
  const [products, setProducts] = useState([]);

  // Filter & Search
  const [accountIdFilter, setAccountIdFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounce ref for search
  const searchDebounceRef = useRef(null);

  // Sync
  const [syncingAccountId, setSyncingAccountId] = useState(null);
  const [syncError, setSyncError] = useState(''); // global sync error banner

  // ── BULK SELECTION STATE ──────────────────────────────────────────────────
  const [bulkQueue, setBulkQueue] = useState([]); // array of ImportedSku objects
  const [bulkProductId, setBulkProductId] = useState('');
  const [bulkColorVariant, setBulkColorVariant] = useState('Assorted');
  const [bulkSizeVariant, setBulkSizeVariant] = useState('Free');
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // Product search in linker panel
  const [productSearch, setProductSearch] = useState('');

  // Remapping individual SKU
  const [isRemapModalOpen, setIsRemapModalOpen] = useState(false);
  const [remapItem, setRemapItem] = useState(null);
  const [remapProductId, setRemapProductId] = useState('');
  const [remapColorVariant, setRemapColorVariant] = useState('');
  const [remapSizeVariant, setRemapSizeVariant] = useState('');
  const [isRemapSaving, setIsRemapSaving] = useState(false);
  const [remapError, setRemapError] = useState('');
  const [remapSuccess, setRemapSuccess] = useState(false);

  const handleOpenRemapModal = (item) => {
    setRemapItem(item);
    setRemapProductId(item.product_id ? item.product_id.toString() : '');
    setRemapColorVariant(item.color_variant || 'Assorted');
    setRemapSizeVariant(item.size_variant || 'Free');
    setRemapError('');
    setRemapSuccess(false);
    setIsRemapModalOpen(true);
  };

  const handleRemapSubmit = async (e) => {
    e.preventDefault();
    if (!remapProductId) {
      setRemapError('Please select a Master Product.');
      return;
    }
    setIsRemapSaving(true);
    setRemapError('');
    setRemapSuccess(false);

    try {
      await api.put(`/accounts/${remapItem.account_id}/imported-skus/${remapItem.id}/map`, {
        product_id: parseInt(remapProductId),
        color_variant: remapColorVariant || null,
        size_variant: remapSizeVariant || null
      });

      setRemapSuccess(true);
      await fetchAllImportedSkus();
      setTimeout(() => {
        setIsRemapModalOpen(false);
        setRemapItem(null);
      }, 1000);
    } catch (err) {
      setRemapError(err.response?.data?.error || 'Failed to update mapping.');
    } finally {
      setIsRemapSaving(false);
    }
  };

  // Re-fetch whenever filters or page change
  useEffect(() => {
    fetchMeeshoAccounts();
    fetchMasterProducts();
  }, []);

  useEffect(() => {
    fetchAllImportedSkus(importedSkusPage);
  }, [accountIdFilter, statusFilter, importedSkusPage]);

  const fetchMeeshoAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      setAccounts(response.data.filter(acc => acc.platform.toLowerCase() === 'meesho'));
    } catch (e) { console.error(e); }
  };

  const fetchMasterProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (e) { console.error(e); }
  };

  const fetchAllImportedSkus = useCallback(async (page = 1, overrideSearch) => {
    setImportedSkusLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('page', page.toString());
      if (accountIdFilter) params.set('account_id', accountIdFilter);
      const q = overrideSearch !== undefined ? overrideSearch : searchQuery;
      if (q && q.trim()) params.set('search', q.trim());
      if (statusFilter === 'mapped') params.set('mapped', 'true');
      if (statusFilter === 'unmapped') params.set('mapped', 'false');
      const response = await api.get(`/accounts/all/imported-skus?${params.toString()}`);
      // Response is now { skus, total, page, limit }
      const data = response.data;
      if (data && Array.isArray(data.skus)) {
        setImportedSkus(data.skus.filter(s => s.account?.platform?.toLowerCase() === 'meesho'));
        setImportedSkusTotal(data.total || 0);
      } else if (Array.isArray(data)) {
        // Fallback for old API shape
        setImportedSkus(data.filter(s => s.account?.platform?.toLowerCase() === 'meesho'));
        setImportedSkusTotal(data.length);
      }
    } catch (e) { console.error(e); }
    finally { setImportedSkusLoading(false); }
  }, [accountIdFilter, statusFilter, searchQuery]);

  // Debounced search handler
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setImportedSkusPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchAllImportedSkus(1, val);
    }, 350);
  };

  const handleManualSync = async (accountId) => {
    setSyncingAccountId(accountId);
    setSyncError('');
    try {
      await api.post(`/accounts/${accountId}/sync`);
      // Sync started — poll for status updates
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchMeeshoAccounts();
        await fetchAllImportedSkus();
        if (attempts >= 6) clearInterval(poll); // stop after ~12s
      }, 2000);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to trigger sync';
      setSyncError(errMsg);
    } finally {
      setSyncingAccountId(null);
    }
  };

  // ── BULK QUEUE HANDLERS ───────────────────────────────────────────────────

  const isInQueue = useCallback(
    (skuId) => bulkQueue.some(s => s.id === skuId),
    [bulkQueue]
  );

  const toggleSkuInQueue = useCallback((item) => {
    setBulkQueue(prev => {
      if (prev.some(s => s.id === item.id)) {
        return prev.filter(s => s.id !== item.id);
      }
      return [...prev, item];
    });
    setBulkSuccess(false);
    setBulkError('');
  }, []);

  const removeFromQueue = useCallback((skuId) => {
    setBulkQueue(prev => prev.filter(s => s.id !== skuId));
  }, []);

  const clearQueue = () => {
    setBulkQueue([]);
    setBulkProductId('');
    setBulkColorVariant('Assorted');
    setBulkSizeVariant('Free');
    setBulkSuccess(false);
    setBulkError('');
  };

  // Select-all visible filtered rows
  const handleSelectAllVisible = () => {
    const allAlreadySelected = filteredSkus.every(s => isInQueue(s.id));
    if (allAlreadySelected) {
      // Deselect all visible
      const visibleIds = new Set(filteredSkus.map(s => s.id));
      setBulkQueue(prev => prev.filter(s => !visibleIds.has(s.id)));
    } else {
      // Add all visible that aren't already in queue
      setBulkQueue(prev => {
        const existing = new Set(prev.map(s => s.id));
        const newOnes = filteredSkus.filter(s => !existing.has(s.id));
        return [...prev, ...newOnes];
      });
    }
  };

  // ── BULK SAVE ─────────────────────────────────────────────────────────────

  const handleBulkSave = async () => {
    if (!bulkProductId) {
      setBulkError('Please choose a Master Product first.');
      return;
    }
    if (bulkQueue.length === 0) {
      setBulkError('No SKUs in queue.');
      return;
    }

    setIsBulkSaving(true);
    setBulkError('');
    setBulkSuccess(false);

    try {
      await api.post('/accounts/bulk-map-skus', {
        product_id: parseInt(bulkProductId),
        color_variant: bulkColorVariant || null,
        size_variant: bulkSizeVariant || null,
        sku_ids: bulkQueue.map(s => s.id)
      });

      setBulkSuccess(true);
      await fetchAllImportedSkus();
      setTimeout(() => {
        clearQueue();
      }, 2000);
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Bulk mapping failed. Please try again.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // filteredSkus is now just what the server returned (already filtered server-side)
  const filteredSkus = importedSkus;
  const totalPages = Math.max(1, Math.ceil(importedSkusTotal / 100));

  const allVisibleSelected = filteredSkus.length > 0 && filteredSkus.every(s => isInQueue(s.id));
  const someVisibleSelected = filteredSkus.some(s => isInQueue(s.id));

  const filteredProducts = products.filter(p => {
    if (!productSearch) return true;
    return (p.name + p.category).toLowerCase().includes(productSearch.toLowerCase());
  });

  const selectedProduct = products.find(p => p.id.toString() === bulkProductId);
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-12">
      <Header title="Meesho Catalog Sync & Master SKU Hub" />

      <div className="p-8 space-y-8 max-w-[1600px] mx-auto">

        {/* ── Local Sync Required Notice ────────────────────────────────────── */}
        {syncError && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start shadow-sm">
            <Monitor size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 mb-1">Sync Must Be Done From Your Local Computer</p>
              <p className="text-xs text-amber-700 leading-relaxed mb-2">{syncError}</p>
              <div className="flex items-center gap-2 mt-2">
                <Wifi size={12} className="text-amber-600" />
                <span className="text-[11px] font-bold text-amber-700">Steps to sync:</span>
              </div>
              <ol className="text-[11px] text-amber-700 mt-1 ml-4 space-y-0.5 list-decimal">
                <li>Make sure the backend is running on your computer (npm run dev in the backend folder)</li>
                <li>Open <a href="http://localhost:5173/meesho-sync" className="underline font-bold" target="_blank" rel="noreferrer">http://localhost:5173/meesho-sync</a> in your browser</li>
                <li>Click "Sync Account Listings" — your data saves to the shared cloud database automatically</li>
              </ol>
            </div>
            <button onClick={() => setSyncError('')} className="text-amber-400 hover:text-amber-700 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── Cloud Sync Info Banner ────────────────────────────────────────── */}
        {!isLocalhost && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2.5 items-center shadow-sm">
            <Monitor size={16} className="text-blue-500 flex-shrink-0" />
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              <strong>How syncing works:</strong> Meesho blocks automated logins from cloud servers. To sync your listings, 
              open the app on your local computer (<span className="font-mono font-bold">http://localhost:5173</span>) and click 
              "Sync Account Listings". Your SKUs will save directly to the shared database — no extra steps needed.
            </p>
          </div>
        )}

        {/* ── Connected Accounts ──────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-blue-500" />
                Connected Meesho Accounts
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Manage credentials and synchronization states for all active Meesho panels
              </p>
            </div>
            <button
              onClick={() => { fetchMeeshoAccounts(); fetchAllImportedSkus(); }}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 rounded transition-all font-bold text-xs flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              Refresh Statuses
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded text-center">
              <p className="text-xs text-slate-500 font-medium">No Meesho accounts configured yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Please visit the <a href="/accounts" className="text-blue-600 underline font-bold">Accounts</a> page to add a Meesho account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts.map(acc => {
                const hasCreds = acc.meesho_username && acc.meesho_password;
                return (
                  <div key={acc.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-sm text-slate-800">{acc.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          acc.meesho_sync_status === 'syncing'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                            : acc.meesho_sync_status === 'success'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : acc.meesho_sync_status === 'failed'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {acc.meesho_sync_status === 'syncing' ? 'Syncing'
                            : acc.meesho_sync_status === 'success' ? 'Synced'
                              : acc.meesho_sync_status === 'failed' ? 'Sync Failed'
                                : 'Pending Credentials'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-3 space-y-1.5 font-medium">
                        <div className="flex justify-between">
                          <span>Supplier ID:</span>
                          <span className="font-mono font-bold text-slate-700">{acc.meesho_supplier_id || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Login ID:</span>
                          <span className="font-mono font-bold text-slate-700">{acc.meesho_username || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Sync:</span>
                          <span className="text-slate-700">{acc.meesho_last_sync ? new Date(acc.meesho_last_sync).toLocaleString() : 'Never'}</span>
                        </div>
                      </div>
                      {acc.meesho_sync_status === 'failed' && acc.meesho_sync_error && (
                        <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded text-[10px] font-semibold text-rose-700 leading-relaxed max-h-[80px] overflow-y-auto" title={acc.meesho_sync_error}>
                          {acc.meesho_sync_error}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleManualSync(acc.id)}
                      disabled={!hasCreds || acc.meesho_sync_status === 'syncing' || syncingAccountId === acc.id}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <RefreshCw size={12} className={acc.meesho_sync_status === 'syncing' ? 'animate-spin' : ''} />
                      Sync Account Listings
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Main Panel: Left + Right ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">

          {/* ── LEFT: Synced SKU Table ──────────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-md font-bold text-slate-800">Synced Meesho Catalog Listings</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Click rows to add SKUs to the bulk queue · {filteredSkus.length} listings shown
                </p>
              </div>
              {someVisibleSelected && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                    {bulkQueue.length} selected
                  </span>
                  <button
                    onClick={clearQueue}
                    className="text-xs text-slate-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                  >
                    <X size={12} /> Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Search SKU / Title</label>
                <div className="relative bg-white border border-slate-200 rounded">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search listings..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs focus:outline-none text-slate-700 font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Filter by Account</label>
                <select
                  value={accountIdFilter}
                  onChange={e => { setAccountIdFilter(e.target.value); setImportedSkusPage(1); }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="">All Accounts</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.meesho_supplier_id || 'N/A'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Mapping Status</label>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setImportedSkusPage(1); }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="all">All listings</option>
                  <option value="mapped">Mapped only</option>
                  <option value="unmapped">Unmapped only</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              {importedSkusLoading ? (
                <div className="py-16 text-center text-slate-400 font-medium text-sm">
                  <RefreshCw size={28} className="mx-auto text-slate-300 mb-3 animate-spin" />
                  Loading catalog listings...
                </div>
              ) : filteredSkus.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      {/* Checkbox All */}
                      <th className="py-3 px-4 w-10">
                        <button
                          onClick={handleSelectAllVisible}
                          className="flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                          title={allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                        >
                          {allVisibleSelected
                            ? <CheckSquare size={15} className="text-blue-600" />
                            : someVisibleSelected
                              ? <CheckSquare size={15} className="text-blue-400" />
                              : <Square size={15} />}
                        </button>
                      </th>
                      <th className="py-3 px-4">Account</th>
                      <th className="py-3 px-4">Product Info</th>
                      <th className="py-3 px-4">SKU & Style</th>
                      <th className="py-3 px-4">Price & Stock</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Add</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSkus.map(item => {
                      const inQueue = isInQueue(item.id);
                      const formattedPrice = item.price !== null ? `₹${(item.price / 100).toFixed(0)}` : '—';
                      return (
                        <tr
                          key={item.id}
                          onClick={() => toggleSkuInQueue(item)}
                          className={`border-b border-slate-100 transition-all cursor-pointer select-none ${
                            inQueue
                              ? 'bg-blue-50/60 hover:bg-blue-50'
                              : 'hover:bg-slate-50/60'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center">
                              {inQueue
                                ? <CheckSquare size={15} className="text-blue-600" />
                                : <Square size={15} className="text-slate-300" />}
                            </div>
                          </td>

                          {/* Account */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 text-[11px]">{item.account?.name}</div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                              {item.account?.meesho_supplier_id || 'N/A'}
                            </div>
                          </td>

                          {/* Product info */}
                          <td className="py-3 px-4 max-w-[240px]">
                            <div className="flex items-center gap-2.5">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt="Product"
                                  className="w-9 h-9 object-cover rounded border border-slate-200 bg-white flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-[8px] font-bold flex-shrink-0">
                                  IMG
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-700 truncate text-[11px]" title={item.title}>
                                  {item.title || <span className="text-slate-300 font-normal">Untitled</span>}
                                </div>
                                {item.catalog_name && (
                                  <div className="text-[9px] text-slate-400 truncate">{item.catalog_name}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* SKU & Style */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{item.marketplace_sku}</span>
                            {item.style_id && (
                              <div className="text-[9px] text-slate-400 font-mono mt-0.5">Style: {item.style_id}</div>
                            )}
                          </td>

                          {/* Price & Stock */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 text-[11px]">{formattedPrice}</div>
                            {item.inventory !== null ? (
                              item.inventory === 0 ? (
                                <span className="text-rose-600 font-bold text-[9px]">Out of Stock</span>
                              ) : (
                                <span className="text-slate-500 text-[9px] font-medium">{item.inventory} avail.</span>
                              )
                            ) : <span className="text-[9px] text-slate-300">—</span>}
                          </td>

                          {/* Status badges */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col gap-1 items-center">
                              {item.status && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold border uppercase ${
                                  item.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : item.status === 'paused'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {item.status}
                                </span>
                              )}
                              {item.product_id ? (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRemapModal(item);
                                  }}
                                  className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-50 border border-blue-200 text-blue-700 max-w-[90px] truncate cursor-pointer hover:bg-blue-100 transition-colors"
                                  title="Click to Remap / Edit SKU"
                                >
                                  ✓ {item.product?.name}
                                </span>
                              ) : (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRemapModal(item);
                                  }}
                                  className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 border border-slate-200 text-slate-500 cursor-pointer hover:bg-slate-200 transition-colors"
                                  title="Click to Map SKU"
                                >
                                  Unmapped
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Add to queue */}
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={e => { e.stopPropagation(); toggleSkuInQueue(item); }}
                              className={`flex items-center gap-1 text-[10px] font-extrabold ml-auto px-2.5 py-1 rounded cursor-pointer transition-all border ${
                                inQueue
                                  ? 'text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100'
                                  : 'text-blue-600 border-blue-100 hover:bg-blue-50'
                              }`}
                            >
                              {inQueue ? (
                                <><X size={11} />Remove</>
                              ) : (
                                <><PlusCircle size={11} />Add</>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 text-center text-slate-400 font-medium text-sm">
                  <Search size={32} className="mx-auto text-slate-200 mb-3" />
                  No catalog SKUs found matching your filters.
                </div>
              )}
            </div>

            {/* Pagination */}
            {!importedSkusLoading && importedSkusTotal > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-semibold">
                  Showing {filteredSkus.length} of {importedSkusTotal} listings
                  {totalPages > 1 ? ` · Page ${importedSkusPage} of ${totalPages}` : ''}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setImportedSkusPage(p => Math.max(1, p - 1))}
                      disabled={importedSkusPage === 1}
                      className="px-3 py-1 text-[10px] font-bold border border-slate-200 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setImportedSkusPage(p => Math.min(totalPages, p + 1))}
                      disabled={importedSkusPage === totalPages}
                      className="px-3 py-1 text-[10px] font-bold border border-slate-200 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Master SKU Linker (Bulk Queue) ────────────────────────── */}

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden sticky top-6 flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>

            {/* Panel Header — fixed, never scrolls */}
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-br from-slate-900 to-slate-700 flex-shrink-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shuffle size={16} className="text-blue-400" />
                Master SKU Linker
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Select multiple SKUs from the left, then link them all to one Master Product
              </p>
            </div>

            {/* Scrollable body — everything below the header scrolls */}
            <div className="flex-1 overflow-y-auto">

            {bulkQueue.length === 0 ? (
              /* Empty state */
              <div className="px-5 py-12 text-center space-y-3">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                  <LinkIcon size={22} className="text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500">No SKUs selected</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Click any row on the left (or use the <strong>Add</strong> button) to add SKUs to the bulk mapping queue.
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded p-3 text-left">
                  <span className="flex items-center gap-1.5"><CheckSquare size={11} className="text-blue-500" /> Click multiple rows to select</span>
                  <span className="flex items-center gap-1.5"><Shuffle size={11} className="text-blue-500" /> Choose one Master Product</span>
                  <span className="flex items-center gap-1.5"><Zap size={11} className="text-blue-500" /> Link all in a single click</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">

                {/* SKU Queue List */}
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                      Selected SKUs ({bulkQueue.length})
                    </span>
                    <button
                      onClick={clearQueue}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-0.5"
                    >
                      <Trash2 size={10} /> Clear all
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
                    {bulkQueue.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 group"
                      >
                        {/* Thumbnail */}
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt="Product"
                            className="w-8 h-8 object-cover rounded border border-blue-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-blue-100 rounded flex-shrink-0 flex items-center justify-center">
                            <Package size={12} className="text-blue-400" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold text-[10px] text-blue-700 truncate">{item.marketplace_sku}</div>
                          <div className="text-[9px] text-slate-500 truncate">{item.account?.name}</div>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all flex-shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-5 border-t border-slate-100 my-3" />

                {/* Master Product Selection */}
                <div className="px-5 space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">
                      Map to Master Product
                    </label>

                    {/* Product search */}
                    <div className="relative mb-1.5">
                      <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="Filter products..."
                        className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none text-slate-700 font-medium"
                      />
                    </div>

                    <select
                      value={bulkProductId}
                      onChange={e => setBulkProductId(e.target.value)}
                      size={Math.min(filteredProducts.length + 1, 6)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white font-semibold focus:outline-none focus:border-blue-500 text-slate-700"
                    >
                      <option value="">-- Choose Master Product --</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                      ))}
                    </select>

                    {selectedProduct && (
                      <div className="mt-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-1.5">
                        <CheckCircle size={11} className="text-emerald-600 flex-shrink-0" />
                        <span className="text-[10px] font-bold text-emerald-700 truncate">{selectedProduct.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Variants */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Color</label>
                      <input
                        type="text"
                        value={bulkColorVariant}
                        onChange={e => setBulkColorVariant(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs focus:outline-none text-slate-700 font-semibold"
                        placeholder="e.g. Assorted"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Size</label>
                      <input
                        type="text"
                        value={bulkSizeVariant}
                        onChange={e => setBulkSizeVariant(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs focus:outline-none text-slate-700 font-semibold"
                        placeholder="e.g. Free"
                      />
                    </div>
                  </div>

                  {/* Error / Success messages */}
                  {bulkError && (
                    <div className="flex items-center gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 font-semibold">
                      <AlertCircle size={13} className="flex-shrink-0" />
                      {bulkError}
                    </div>
                  )}

                  {bulkSuccess && (
                    <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 font-bold animate-pulse">
                      <CheckCircle size={13} className="flex-shrink-0" />
                      All {bulkQueue.length} SKUs linked successfully!
                    </div>
                  )}

                  {/* CTA Button */}
                  <button
                    onClick={handleBulkSave}
                    disabled={isBulkSaving || !bulkProductId || bulkQueue.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    {isBulkSaving ? (
                      <><RefreshCw size={14} className="animate-spin" />Linking {bulkQueue.length} SKUs...</>
                    ) : (
                      <><Zap size={14} />Link All {bulkQueue.length} SKU{bulkQueue.length !== 1 ? 's' : ''} to Master Product</>
                    )}
                  </button>

                  <p className="text-[10px] text-slate-400 text-center pb-4">
                    This also updates the PDF parsing engine's SKU routing table.
                  </p>
                </div>

              </div>
            )}

            </div>{/* end scrollable body */}
          </div>
        </div>

      </div>

      {/* Remap SKU Modal */}
      {isRemapModalOpen && remapItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-6 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-md font-bold text-slate-800">Map Marketplace SKU</h3>
                <p className="text-xs text-slate-400 font-medium">Link this catalog item to a master product definition</p>
              </div>
              <button
                onClick={() => setIsRemapModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
              {remapItem.image_url ? (
                <img
                  src={remapItem.image_url}
                  alt="Product"
                  className="w-12 h-12 object-cover rounded border border-slate-200 bg-white"
                />
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                  IMG
                </div>
              )}
              <div className="min-w-0">
                <div className="font-mono font-bold text-xs text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded inline-block mb-1">
                  {remapItem.marketplace_sku}
                </div>
                <div className="font-semibold text-slate-700 truncate text-[11px]" title={remapItem.title}>
                  {remapItem.title || <span className="text-slate-300 font-normal">Untitled</span>}
                </div>
              </div>
            </div>

            <form onSubmit={handleRemapSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Connect to Product Model</label>
                <select
                  value={remapProductId}
                  onChange={(e) => setRemapProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{(p.base_price / 100).toFixed(0)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Color Variant</label>
                  <input
                    type="text"
                    value={remapColorVariant}
                    onChange={(e) => setRemapColorVariant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Assorted"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Size Variant</label>
                  <input
                    type="text"
                    value={remapSizeVariant}
                    onChange={(e) => setRemapSizeVariant(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Free"
                  />
                </div>
              </div>

              {remapError && (
                <div className="flex items-center gap-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 font-semibold">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {remapError}
                </div>
              )}

              {remapSuccess && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 font-bold animate-pulse">
                  <CheckCircle size={13} className="flex-shrink-0" />
                  SKU mapped successfully!
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRemapModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRemapSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-all shadow-sm"
                >
                  {isRemapSaving ? (
                    <><RefreshCw size={13} className="animate-spin" /> Saving...</>
                  ) : (
                    'Update Link'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
