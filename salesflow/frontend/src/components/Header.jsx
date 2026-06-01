import React from 'react';

export default function Header({ title }) {
  const formatTodayDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-IN', options);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <h1 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-500">{formatTodayDate()}</span>
        <div className="h-4 w-px bg-slate-200"></div>
        <span className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
          IST Timezone
        </span>
      </div>
    </header>
  );
}
