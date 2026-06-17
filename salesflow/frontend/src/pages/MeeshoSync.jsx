import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, HelpCircle, Shuffle, ChevronRight, Save, Layers, Search } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';

export default function MeeshoSync() {
  const [accounts, setAccounts] = useState([]);
  const [importedSkus, setImportedSkus] = useState([]);
  const [products, setProducts] = useState([]);

  // Filter & Search states
  const [accountIdFilter, setAccountIdFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, mapped, unmapped

  // Manual trigger sync states
  const [syncingAccountId, setSyncingAccountId] = useState(null);

  // Mapping states
  const [selectedSkuId, setSelectedSkuId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sizeVariant, setSizeVariant] = useState('');
  const [colorVariant, setColorVariant] = useState('');
  const [mappingSuccess, setMappingSuccess] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  useEffect(() => {
    fetchMeeshoAccounts();
    fetchMasterProducts();
    fetchAllImportedSkus();
  }, []);

  const fetchMeeshoAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      const meeshoAccounts = response.data.filter(acc => acc.platform.toLowerCase() === 'meesho');
      setAccounts(meeshoAccounts);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMasterProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllImportedSkus = async () => {
    try {
      const response = await api.get('/accounts/all/imported-skus');
      setImportedSkus(response.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSync = async (accountId) => {
    setSyncingAccountId(accountId);
    try {
      await api.post(`/accounts/${accountId}/sync`);
      alert('Sync triggered in the background. It will automatically update SKUs shortly.');

      // Refresh statuses and SKUs after a small delay
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

  const handleSelectSkuForMapping = (skuItem) => {
    setSelectedSkuId(skuItem.id);
    setSelectedProductId(skuItem.product_id ? skuItem.product_id.toString() : '');
    setSizeVariant(skuItem.size_variant || '');
    setColorVariant(skuItem.color_variant || '');
    setMappingSuccess(false);
  };

  const handleSaveMapping = async (e) => {
    e.preventDefault();
    if (!selectedSkuId || !selectedProductId) {
      alert('Please select a Master Product to link');
      return;
    }

    const activeSku = importedSkus.find(item => item.id === selectedSkuId);
    if (!activeSku) return;

    setIsSavingMapping(true);
    try {
      await api.put(`/accounts/${activeSku.account_id}/imported-skus/${selectedSkuId}/map`, {
        product_id: parseInt(selectedProductId),
        size_variant: sizeVariant,
        color_variant: colorVariant
      });

      setMappingSuccess(true);
      fetchAllImportedSkus();
      setTimeout(() => {
        setSelectedSkuId(null);
        setMappingSuccess(false);
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to map SKU');
    } finally {
      setIsSavingMapping(false);
    }
  };

  // Filter SKUs based on search and filters
  const filteredSkus = importedSkus.filter(sku => {
    // 1. Account filter
    if (accountIdFilter && sku.account_id.toString() !== accountIdFilter) {
      return false;
    }
    // 2. Mapping status filter
    if (statusFilter === 'mapped' && !sku.product_id) return false;
    if (statusFilter === 'unmapped' && sku.product_id) return false;

    // 3. Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const skuMatch = (sku.marketplace_sku || '').toLowerCase().includes(q);
      const titleMatch = (sku.title || '').toLowerCase().includes(q);
      const supplierMatch = (sku.account?.meesho_supplier_id || '').toLowerCase().includes(q);
      return skuMatch || titleMatch || supplierMatch;
    }

    return true;
  });

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-12">
      <Header title="Meesho Catalog Sync & Master SKU Hub" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Connected Meesho Accounts Section */}
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
              onClick={() => {
                fetchMeeshoAccounts();
                fetchAllImportedSkus();
              }}
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
                Please visit the <a href="/accounts" className="text-blue-600 underline font-bold">Accounts</a> page to add a Meesho account with Supplier ID, Login ID, and Password.
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
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${acc.meesho_sync_status === 'syncing'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                          : acc.meesho_sync_status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : acc.meesho_sync_status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                          {acc.meesho_sync_status === 'syncing'
                            ? 'Syncing'
                            : acc.meesho_sync_status === 'success'
                              ? 'Synced'
                              : acc.meesho_sync_status === 'failed'
                                ? 'Sync Failed'
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

        {/* Catalog and Mapping Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Synced SKUs List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-md font-bold text-slate-800">Synced Meesho Catalog Listings</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Filter, search, and manage synced SKU variants across accounts</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Search SKU / Title</label>
                <div className="relative bg-white border border-slate-200 rounded">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search listings..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs focus:outline-none text-slate-700 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Filter by Account</label>
                <select
                  value={accountIdFilter}
                  onChange={(e) => setAccountIdFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="">All Accounts</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (Supplier ID: {acc.meesho_supplier_id || 'N/A'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Mapping Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs bg-white font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="all">All listings</option>
                  <option value="mapped">Mapped only</option>
                  <option value="unmapped">Unmapped only</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded">
              {filteredSkus.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                        <th className="py-3 px-4">Account & Supplier</th>
                        <th className="py-3 px-4">Product Info</th>
                        <th className="py-3 px-4">SKU & Style ID</th>
                        <th className="py-3 px-4">Price & Stock</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSkus.map(item => {
                        const formattedPrice = item.price !== null ? `₹${(item.price / 100).toFixed(2)}` : '—';
                        return (
                          <tr
                            key={item.id}
                            className={`border-b border-slate-100 hover:bg-slate-50/50 transition-all cursor-pointer ${
                              selectedSkuId === item.id ? 'bg-blue-50/20 font-medium' : ''
                            }`}
                            onClick={() => handleSelectSkuForMapping(item)}
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{item.account?.name}</div>
                              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Supplier ID: {item.account?.meesho_supplier_id || 'N/A'}</div>
                            </td>
                            <td className="py-3 px-4 max-w-[280px]">
                              <div className="flex items-center gap-3">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt="Product"
                                    className="w-10 h-10 object-cover rounded border border-slate-200 bg-white flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 text-[9px] font-bold flex-shrink-0">
                                    No Img
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-700 truncate" title={item.title}>
                                    {item.title || <span className="text-slate-300 font-normal">Untitled Listing</span>}
                                  </div>
                                  {item.catalog_name && (
                                    <div className="text-[10px] text-slate-400 font-normal truncate" title={item.catalog_name}>
                                      Catalog: {item.catalog_name}
                                    </div>
                                  )}
                                  {item.catalog_id && (
                                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                      Catalog ID: {item.catalog_id}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="sku-badge font-mono font-bold">{item.marketplace_sku}</span>
                                {item.style_id && (
                                  <span className="text-[9px] text-slate-400 font-mono">Style: {item.style_id}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">{formattedPrice}</div>
                              <div className="mt-0.5">
                                {item.inventory !== null ? (
                                  item.inventory === 0 ? (
                                    <span className="text-rose-600 font-bold text-[10px]">Out of Stock</span>
                                  ) : (
                                    <span className="text-slate-500 text-[10px] font-medium">{item.inventory} available</span>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-[10px]">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col gap-1.5 items-center justify-center">
                                {/* Meesho Status Badge */}
                                {item.status && (
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                                    item.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : item.status === 'paused'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {item.status}
                                  </span>
                                )}
                                
                                {/* Mapping Status Badge */}
                                {item.product_id ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                                    Mapped to: {item.product?.name}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-500">
                                    Unmapped
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                className="flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:text-blue-800 ml-auto border border-blue-100 hover:bg-blue-50 px-2.5 py-1 rounded cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectSkuForMapping(item);
                                }}
                              >
                                Map
                                <ChevronRight size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 font-medium">
                  No catalog SKUs found matching your filters.
                </div>
              )}
            </div>
          </div>

          {/* Master SKU Mapping Tool Panel */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-1.5">
                <Shuffle size={16} className="text-blue-500" />
                Master SKU Linker
              </h3>
              <p className="text-xs text-slate-400 font-medium">Link imported listing SKU to internal Master Product model</p>
            </div>

            {selectedSkuId ? (
              <form onSubmit={handleSaveMapping} className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block">Active Selection</span>
                  <div className="flex gap-3">
                    {importedSkus.find(item => item.id === selectedSkuId)?.image_url ? (
                      <img
                        src={importedSkus.find(item => item.id === selectedSkuId)?.image_url}
                        alt="Product"
                        className="w-14 h-14 object-cover rounded border border-slate-200 bg-white"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-slate-200 rounded border border-slate-350 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                        No Image
                      </div>
                    )}
                    <div className="space-y-1 min-w-0">
                      <div className="font-mono text-xs font-bold text-blue-600 truncate">
                        {importedSkus.find(item => item.id === selectedSkuId)?.marketplace_sku}
                      </div>
                      <div className="text-xs text-slate-700 font-bold leading-snug truncate" title={importedSkus.find(item => item.id === selectedSkuId)?.title}>
                        {importedSkus.find(item => item.id === selectedSkuId)?.title}
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        Account: {importedSkus.find(item => item.id === selectedSkuId)?.account?.name}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium border-t border-slate-200 pt-2 text-slate-500">
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400 font-bold">Meesho Price</span>
                      <span className="font-bold text-slate-755">
                        {importedSkus.find(item => item.id === selectedSkuId)?.price 
                          ? `₹${(importedSkus.find(item => item.id === selectedSkuId).price / 100).toFixed(2)}` 
                          : '₹-'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] uppercase text-slate-400 font-bold">Inventory / Stock</span>
                      <span className={`font-bold ${importedSkus.find(item => item.id === selectedSkuId)?.inventory === 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {importedSkus.find(item => item.id === selectedSkuId)?.inventory !== null && importedSkus.find(item => item.id === selectedSkuId)?.inventory !== undefined
                          ? `${importedSkus.find(item => item.id === selectedSkuId).inventory} pcs`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Map to Master SKU / Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white font-semibold focus:outline-none focus:border-blue-500 text-slate-700"
                    required
                  >
                    <option value="">-- Choose Master Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Color Variant</label>
                  <input
                    type="text"
                    value={colorVariant}
                    onChange={(e) => setColorVariant(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 text-slate-700 font-semibold"
                    placeholder="e.g. Assorted, Blue"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Size Variant</label>
                  <input
                    type="text"
                    value={sizeVariant}
                    onChange={(e) => setSizeVariant(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 text-slate-700 font-semibold"
                    placeholder="e.g. XL, Free"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingMapping}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Save size={14} />
                  {isSavingMapping ? 'Linking...' : 'Link Master SKU Mapping'}
                </button>

                {mappingSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-700 flex items-center gap-2 font-bold justify-center transition-all animate-pulse">
                    <CheckCircle size={15} />
                    Mapping Linked Successfully!
                  </div>
                )}
              </form>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs font-medium space-y-2">
                <HelpCircle size={32} className="mx-auto text-slate-300" />
                <p>Select an imported SKU from the list on the left to set its Master Product linkage.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
