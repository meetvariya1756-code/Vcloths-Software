import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, ShieldCheck, AlertTriangle, HelpCircle, Shuffle, ChevronRight, Save, Layers, Lock, Unlock, Key } from 'lucide-react';
import api from '../api';
import Header from '../components/Header';

export default function MeeshoSync() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [meeshoId, setMeeshoId] = useState('');
  const [password, setPassword] = useState('');
  
  // Sync Simulation States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState(0); // 0: Idle, 1-5: real scraper phases, 6: Done
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorHint, setErrorHint] = useState('');

  // Imported catalog listings
  const [importedSkus, setImportedSkus] = useState([]);
  const [products, setProducts] = useState([]);

  // Mapping states
  const [selectedSkuId, setSelectedSkuId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sizeVariant, setSizeVariant] = useState('');
  const [mappingSuccess, setMappingSuccess] = useState(false);

  useEffect(() => {
    fetchMeeshoAccounts();
    fetchMasterProducts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      fetchImportedSkus(selectedAccountId);
      // Reset form and mapping context
      setMeeshoId('');
      setPassword('');
      setSelectedSkuId(null);
      setErrorMsg('');
      setErrorHint('');
    } else {
      setImportedSkus([]);
    }
  }, [selectedAccountId]);

  const fetchMeeshoAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      // Filter only Meesho accounts
      const meeshoAccounts = response.data.filter(acc => acc.platform.toLowerCase() === 'meesho');
      setAccounts(meeshoAccounts);
      if (meeshoAccounts.length > 0) {
        setSelectedAccountId(meeshoAccounts[0].id.toString());
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to load Meesho accounts');
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

  const fetchImportedSkus = async (accountId) => {
    try {
      const response = await api.get(`/accounts/${accountId}/imported-skus`);
      setImportedSkus(response.data);
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to fetch imported catalog SKUs');
    }
  };

  const startCatalogSync = async (e) => {
    e.preventDefault();
    if (!selectedAccountId) return;

    // If NOT configured (no credentials locked yet), we require the fields
    if (!isConfigured && (!meeshoId || !password)) {
      alert('Please enter your Meesho Account ID and Password');
      return;
    }

    const timeoutIds = [];

    setIsSyncing(true);
    setSyncStep(1);
    setSyncStatusMsg('Launching secure browser session...');
    setErrorMsg('');
    setErrorHint('');

    // Trigger API request immediately
    const syncPromise = api.post(`/accounts/${selectedAccountId}/meesho-sync`, {
      meesho_id: meeshoId ? meeshoId.trim() : undefined,
      password: password ? password.trim() : undefined
    });

    // Schedule stepper transitions
    const t1 = setTimeout(() => {
      setSyncStep(2);
      setSyncStatusMsg('Logging into Meesho Supplier Panel...');
    }, 1200);
    timeoutIds.push(t1);

    const t2 = setTimeout(() => {
      setSyncStep(3);
      setSyncStatusMsg('Navigating to My Catalogs page...');
    }, 2700);
    timeoutIds.push(t2);

    const t3 = setTimeout(() => {
      setSyncStep(4);
      setSyncStatusMsg('Extracting catalog SKU variants — this may take 30–60 seconds...');
    }, 4200);
    timeoutIds.push(t3);

    try {
      const response = await syncPromise;
      
      // Clear timeouts if request finishes earlier
      timeoutIds.forEach(clearTimeout);

      if (response.data.success) {
        setSyncStep(5);
        setSyncStatusMsg(`✅ Sync complete! Imported ${response.data.count} real SKUs from Meesho.`);
        fetchImportedSkus(selectedAccountId);

        // Reload accounts list to refresh the lock badge if credentials were newly locked
        fetchMeeshoAccounts();

        setTimeout(() => {
          setIsSyncing(false);
          setSyncStep(0);
          setSyncStatusMsg('');
          setMeeshoId('');
          setPassword('');
        }, 3000);
      } else {
        throw new Error('Unexpected sync failure');
      }
    } catch (err) {
      // Clear timeouts on failure
      timeoutIds.forEach(clearTimeout);

      console.error(err);
      setIsSyncing(false);
      setSyncStep(0);
      setSyncStatusMsg('');
      const errData = err.response?.data;
      setErrorMsg(errData?.error || 'Failed to connect to Meesho Supplier Panel. Check your credentials.');
      setErrorHint(errData?.hint || '');
    }
  };

  const selectedAccount = accounts.find(acc => acc.id.toString() === selectedAccountId);
  const isConfigured = !!(selectedAccount?.meesho_username && selectedAccount?.meesho_password);

  const handleResetCredentials = async () => {
    if (!selectedAccountId) return;
    if (!window.confirm('Are you sure you want to reset the saved credentials for this account? You will need to enter credentials on the next sync.')) return;
    
    try {
      await api.post(`/accounts/${selectedAccountId}/meesho-reset`);
      await fetchMeeshoAccounts();
      setMeeshoId('');
      setPassword('');
      setErrorMsg('');
    } catch (err) {
      alert('Failed to reset credentials: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSelectSkuForMapping = (skuItem) => {
    setSelectedSkuId(skuItem.id);
    setSelectedProductId(skuItem.product_id ? skuItem.product_id.toString() : '');
    setSizeVariant(skuItem.size_variant || '');
    setMappingSuccess(false);
  };

  const handleSaveMapping = async (e) => {
    e.preventDefault();
    if (!selectedSkuId || !selectedProductId) {
      alert('Please select a Master Product to link');
      return;
    }

    try {
      await api.put(`/accounts/${selectedAccountId}/imported-skus/${selectedSkuId}/map`, {
        product_id: parseInt(selectedProductId),
        size_variant: sizeVariant
      });

      setMappingSuccess(true);
      fetchImportedSkus(selectedAccountId);
      setTimeout(() => {
        setSelectedSkuId(null);
        setMappingSuccess(false);
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to map SKU');
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen pb-12">
      <Header title="Meesho Catalog & SKU Sync Engine" />

      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        
        {/* Top Account & Sync controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Account selection & Info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-blue-500" />
                  1. Choose Meesho Account
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Select the supplier account you want to sync catalogs for</p>
              </div>

              <div className="space-y-3">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white font-semibold focus:outline-none focus:border-blue-500"
                  disabled={isSyncing}
                >
                  {accounts.length === 0 ? (
                    <option value="">No Meesho accounts configured</option>
                  ) : (
                    accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (ID: {acc.id})</option>
                    ))
                  )}
                </select>
                {accounts.length === 0 && (
                  <p className="text-[10px] text-red-500 font-medium mt-1.5">
                    No Meesho accounts found in settings. Please register a Meesho account first on the Accounts page.
                  </p>
                )}

                {selectedAccountId && (
                  <div className={`p-3 rounded border flex items-center justify-between transition-all ${
                    isConfigured 
                      ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                      : 'bg-amber-50/50 border-amber-100 text-amber-800'
                  }`}>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {isConfigured ? <Lock size={14} className="text-emerald-500" /> : <Unlock size={14} className="text-amber-500" />}
                      <span>{isConfigured ? 'Original credentials locked' : 'No credentials locked'}</span>
                    </div>
                    {isConfigured && (
                      <button 
                        onClick={handleResetCredentials}
                        className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:underline transition-all"
                        disabled={isSyncing}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Meesho Credentials Form */}
            <div className="lg:col-span-2 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-8 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  2. Meesho Supplier Panel Credentials
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {isConfigured 
                    ? 'Saved credentials locked (leave blank to auto-sync)' 
                    : 'Enter your original Meesho ID and password. They will be locked to this account on successful sync.'}
                </p>
              </div>

              <form onSubmit={startCatalogSync} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1.5">Meesho User ID / Phone</label>
                  <input
                    type="text"
                    value={meeshoId}
                    onChange={(e) => setMeeshoId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
                    placeholder={isConfigured ? "Saved (leave blank)" : "e.g. supplier_vims"}
                    disabled={isSyncing || !selectedAccountId}
                    required={!isConfigured}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1.5">Meesho Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                    placeholder={isConfigured ? "•••••••• (locked)" : "Enter password"}
                    disabled={isSyncing || !selectedAccountId}
                    required={!isConfigured}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-xs font-bold transition-all shadow-sm h-[32px]"
                    disabled={isSyncing || !selectedAccountId || (!isConfigured && (!meeshoId || !password))}
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Syncing...' : 'Sync Catalog SKUs'}
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded text-xs text-red-600 flex items-start gap-2.5 font-medium space-y-1">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <div>{errorMsg}</div>
                {errorHint && (
                  <div className="mt-1.5 text-red-400 font-normal">{errorHint}</div>
                )}
              </div>
            </div>
          )}

          {/* Sync stepper visual */}
          {isSyncing && (
            <div className="mt-6 border-t border-slate-100 pt-6 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                  Live Sync Progress
                </span>
                <span className="font-mono text-blue-600 font-semibold text-[10px] max-w-[60%] text-right leading-tight">{syncStatusMsg}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${(syncStep / 5) * 100}%` }}
                ></div>
              </div>
              
              <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                <div className={syncStep >= 1 ? 'text-blue-600' : ''}>1. Browser</div>
                <div className={syncStep >= 2 ? 'text-blue-600' : ''}>2. Login</div>
                <div className={syncStep >= 3 ? 'text-blue-600' : ''}>3. Catalogs</div>
                <div className={syncStep >= 4 ? 'text-blue-600' : ''}>4. Extract SKUs</div>
                <div className={syncStep >= 5 ? 'text-emerald-600' : ''}>5. Complete</div>
              </div>

              <p className="text-[10px] text-slate-400 text-center font-medium">
                ⏳ Real Meesho login in progress — this may take up to 60 seconds. Please wait.
              </p>
            </div>
          )}
        </div>

        {/* Catalog and Mapping Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Synced SKUs List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-md font-bold text-slate-800">Synced Meesho Catalog Listings</h3>
              <p className="text-xs text-slate-400 font-medium">SKUs pulled from Meesho Supplier account (unique to this account)</p>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded">
              {importedSkus.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <th className="py-3 px-4">Marketplace SKU</th>
                      <th className="py-3 px-4">Listing Title</th>
                      <th className="py-3 px-4 text-center">Size</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedSkus.map(item => (
                      <tr 
                        key={item.id} 
                        className={`border-b border-slate-100 hover:bg-slate-50/50 transition-all cursor-pointer ${
                          selectedSkuId === item.id ? 'bg-blue-50/10' : ''
                        }`}
                        onClick={() => handleSelectSkuForMapping(item)}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className="sku-badge">{item.marketplace_sku}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 max-w-[200px] truncate" title={item.title}>
                          {item.title || <span className="text-slate-300 font-normal">Untitled Listing</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-slate-500">
                          {item.size_variant || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.product_id ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
                              Mapped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                              Unmapped
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            className="flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:text-blue-800 ml-auto border border-blue-100 hover:bg-blue-50 px-2.5 py-1 rounded"
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
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-400 font-medium">
                  {selectedAccountId 
                    ? 'No catalogs synced yet. Please authenticate above to download catalog listings.'
                    : 'Please choose a Meesho seller account to list synced SKUs.'}
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
                <div className="bg-slate-50 border border-slate-200 rounded p-4.5 space-y-2">
                  <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Active Selection</span>
                  <div className="font-mono text-xs font-bold text-blue-600">
                    {importedSkus.find(item => item.id === selectedSkuId)?.marketplace_sku}
                  </div>
                  <div className="text-xs text-slate-500 font-semibold leading-snug">
                    {importedSkus.find(item => item.id === selectedSkuId)?.title}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Map to Master SKU / Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white font-semibold focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">-- Choose Master Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Size Variant</label>
                  <input
                    type="text"
                    value={sizeVariant}
                    onChange={(e) => setSizeVariant(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none"
                    placeholder="e.g. XL"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold transition-all shadow-sm"
                >
                  <Save size={14} />
                  Link Master SKU Mapping
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
