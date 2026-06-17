import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, CheckCircle, HelpCircle, Shuffle, ChevronRight, Save,
  Layers, Search, X, Trash2, PlusCircle, CheckSquare, Square,
  LinkIcon, Package, AlertCircle, Zap
} from 'lucide-react';
import api from '../api';
import Header from '../components/Header';

export default function MeeshoSync() {
  const [accounts, setAccounts] = useState([]);
  const [importedSkus, setImportedSkus] = useState([]);
  const [products, setProducts] = useState([]);

  // Filter & Search
  const [accountIdFilter, setAccountIdFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sync
  const [syncingAccountId, setSyncingAccountId] = useState(null);

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

  useEffect(() => {
    fetchMeeshoAccounts();
    fetchMasterProducts();
    fetchAllImportedSkus();
  }, []);

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

  const fetchAllImportedSkus = async () => {
    try {
      const response = await api.get('/accounts/all/imported-skus');
      setImportedSkus(response.data);
    } catch (e) { console.error(e); }
  };

  const handleManualSync = async (accountId) => {
    setSyncingAccountId(accountId);
    try {
      await api.post(`/accounts/${accountId}/sync`);
      alert('Sync triggered in the background. It will automatically update SKUs shortly.');
      setTimeout(() => {
        fetchMeeshoAccounts();
        fetchAllImportedSkus();
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to trigger sync');
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

  // ── FILTER ────────────────────────────────────────────────────────────────

  const filteredSkus = importedSkus.filter(sku => {
    if (accountIdFilter && sku.account_id.toString() !== accountIdFilter) return false;
    if (statusFilter === 'mapped' && !sku.product_id) return false;
    if (statusFilter === 'unmapped' && sku.product_id) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (sku.marketplace_sku || '').toLowerCase().includes(q) ||
        (sku.title || '').toLowerCase().includes(q) ||
        (sku.account?.meesho_supplier_id || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allVisibleSelected = filteredSkus.length > 0 && filteredSkus.every(s => isInQueue(s.id));
  const someVisibleSelected = filteredSkus.some(s => isInQueue(s.id));

  const filteredProducts = products.filter(p => {
    if (!productSearch) return true;
    return (p.name + p.category).toLowerCase().includes(productSearch.toLowerCase());
  });

  const selectedProduct = products.find(p => p.id.toString() === bulkProductId);

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-12">
      <Header title="Meesho Catalog Sync & Master SKU Hub" />

      <div className="p-8 space-y-8 max-w-[1600px] mx-auto">

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
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search listings..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs focus:outline-none text-slate-700 font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Filter by Account</label>
                <select
                  value={accountIdFilter}
                  onChange={e => setAccountIdFilter(e.target.value)}
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
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="all">All listings</option>
                  <option value="mapped">Mapped only</option>
                  <option value="unmapped">Unmapped only</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {filteredSkus.length > 0 ? (
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
                                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-blue-50 border border-blue-200 text-blue-700 max-w-[90px] truncate" title={item.product?.name}>
                                  ✓ {item.product?.name}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 border border-slate-200 text-slate-500">
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
          </div>

          {/* ── RIGHT: Master SKU Linker (Bulk Queue) ────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden sticky top-6">

            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-br from-slate-900 to-slate-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shuffle size={16} className="text-blue-400" />
                Master SKU Linker
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Select multiple SKUs from the left, then link them all to one Master Product
              </p>
            </div>

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
          </div>
        </div>

      </div>
    </div>
  );
}
