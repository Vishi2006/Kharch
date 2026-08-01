'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  Activity, 
  TrendingUp, 
  ListOrdered, 
  FlameKindling,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { formatDateDMY } from '../../utils/date';

export default function AnalyticsPage() {
  const { activeSpace, apiFetch, isOffline } = useApp();
  const [period, setPeriod] = useState('month'); // 'day' | 'week' | 'month' | 'year'
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [expandedTxIds, setExpandedTxIds] = useState([]);

  const toggleExpandTx = (id) => {
    setExpandedTxIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Prevention of hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!activeSpace) return;
      setLoading(true);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      
      // Calculate startDate based on selected period
      const now = new Date();
      const start = new Date();
      if (period === 'day') {
        start.setDate(now.getDate() - 7);
      } else if (period === 'week') {
        start.setDate(now.getDate() - 56); // 8 weeks
      } else if (period === 'month') {
        start.setMonth(now.getMonth() - 1); // 1 month
      } else {
        start.setFullYear(now.getFullYear() - 1); // 12 months
      }

      // Fetch chart analytics
      const data = await apiFetch(`/api/transactions/analytics?spaceId=${activeSpace._id}&period=${period}&timezone=${tz}`);
      
      // Fetch transaction log for the period (limit 100 to show full logs/build comparisons)
      const limitVal = 100;
      const txData = await apiFetch(`/api/transactions?spaceId=${activeSpace._id}&startDate=${start.toISOString()}&limit=${limitVal}`);

      if (data && !data.error) {
        setAnalyticsData({
          ...data,
          periodTransactions: (txData && !txData.error) ? txData.transactions : []
        });
      }
      setLoading(false);
    };

    if (activeSpace) {
      fetchAnalytics();
    }
  }, [activeSpace, period, apiFetch]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse mt-4">
        <div className="h-8 bg-slate-800 rounded-lg w-1/3"></div>
        <div className="h-10 bg-slate-800 rounded-xl"></div>
        <div className="h-64 bg-slate-800 rounded-3xl"></div>
        <div className="h-64 bg-slate-800 rounded-3xl"></div>
      </div>
    );
  }

  const {
    trends = [],
    importance = [],
    topSpendingTitles = [],
    repeatedWasteful = [],
    periodTransactions = []
  } = analyticsData || {};

  // Map dates in trends to requested formats (DD-MM-YYYY and MM-YYYY)
  const formattedTrends = (trends || []).map(item => {
    let formattedLabel = item.label;
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.label)) {
      const [y, m, d] = item.label.split('-');
      formattedLabel = `${d}-${m}-${y}`;
    } else if (/^\d{4}-\d{2}$/.test(item.label)) {
      const [y, m] = item.label.split('-');
      formattedLabel = `${m}-${y}`;
    }
    return { ...item, label: formattedLabel };
  });

  const getWeeklyBreakdown = (transactions) => {
    const weeks = [
      { label: 'Week 1 (Recent)', startDay: 0, endDay: 7, earned: 0, spent: 0, investments: 0, savings: 0 },
      { label: 'Week 2', startDay: 8, endDay: 14, earned: 0, spent: 0, investments: 0, savings: 0 },
      { label: 'Week 3', startDay: 15, endDay: 21, earned: 0, spent: 0, investments: 0, savings: 0 },
      { label: 'Week 4 (Oldest)', startDay: 22, endDay: 30, earned: 0, spent: 0, investments: 0, savings: 0 },
    ];

    const today = new Date();
    const todayMs = today.getTime();

    (transactions || []).forEach(tx => {
      const txDate = new Date(tx.date);
      const diffTime = Math.abs(todayMs - txDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const match = weeks.find(w => diffDays >= w.startDay && diffDays <= w.endDay);
      if (match) {
        if (tx.type === 'income') match.earned += tx.amount;
        if (tx.type === 'expense') match.spent += tx.amount;
        if (tx.type === 'investment') match.investments += tx.amount;
        if (tx.type === 'savings') match.savings += tx.amount;
      }
    });

    return weeks;
  };

  const weeklyBreakdown = getWeeklyBreakdown(periodTransactions);

  const getDailyBreakdown = (transactions) => {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = formatDateDMY(d);
      
      days.push({
        label: dateStr,
        dateKey: d.toLocaleDateString('en-CA'),
        earned: 0,
        spent: 0,
        investments: 0,
        savings: 0
      });
    }

    (transactions || []).forEach(tx => {
      const txDate = new Date(tx.date);
      const txLocalDateStr = txDate.toLocaleDateString('en-CA');
      
      const match = days.find(d => d.dateKey === txLocalDateStr);
      if (match) {
        if (tx.type === 'income') match.earned += tx.amount;
        if (tx.type === 'expense') match.spent += tx.amount;
        if (tx.type === 'investment') match.investments += tx.amount;
        if (tx.type === 'savings') match.savings += tx.amount;
      }
    });

    return [...days].reverse();
  };

  const dailyBreakdown = getDailyBreakdown(periodTransactions);

  const COLORS = {
    Essential: '#10b981', // emerald-500
    Moderate: '#6366f1', // indigo-500
    'Low Value': '#f43f5e', // rose-500
  };

  return (
    <div className="flex flex-col gap-6 mt-1 pb-10">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-extrabold tracking-tight font-display text-white">
          Financial Analytics
        </h1>
        <span className="text-xs text-slate-400 font-semibold mt-0.5 block">
          Analyze spending behavior, asset tracking, and leakages.
        </span>
      </div>

      {/* Period Tabs Selector */}
      <div className="grid grid-cols-4 bg-slate-900 p-1.5 rounded-2xl border border-slate-800/80">
        {[
          { key: 'day', label: 'Day' },
          { key: 'week', label: 'Week' },
          { key: 'month', label: 'Month' },
          { key: 'year', label: 'Year' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPeriod(t.key)}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              period === t.key 
                ? 'bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/10 scale-102' 
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isOffline && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex gap-2 text-xs text-slate-400 italic">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>Showing cached history. Analytics might not reflect un-synced local edits.</span>
        </div>
      )}

      {/* Trend Area Chart (Earned vs Spent) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-5">
          <Activity className="w-4 h-4 text-indigo-400" /> Cashflow: Earned vs Spent
        </h3>

        {formattedTrends.length > 0 ? (
          <div className="h-64 w-full text-[10px] font-semibold text-slate-400">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEarned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#475569" strokeWidth={0.5} tickLine={false} />
                <YAxis stroke="#475569" strokeWidth={0.5} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" name="Earned" dataKey="earned" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorEarned)" />
                <Area type="monotone" name="Spent" dataKey="spent" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-10 text-center">No trend details compiled for this period.</p>
        )}
      </div>

      {/* Importance Distribution Chart */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-5">
            <PieIcon className="w-4 h-4 text-indigo-400" /> Expense Priority Distribution
          </h3>

          {importance.length > 0 ? (
            <div className="flex flex-col items-center justify-center">
              <div className="h-44 w-full text-[10px] font-bold text-slate-400">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={importance}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {importance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#6366f1'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Custom Legend */}
              <div className="flex justify-center gap-4 mt-2 text-xs font-semibold text-slate-400">
                {importance.map(item => (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[item.name] }} />
                    {item.name}: ₹{item.value.toLocaleString('en-IN')}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-10 text-center">No expense logs recorded.</p>
          )}
        </div>
      </div>

      {/* Assets / Savings Chart */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-5">
          <TrendingUp className="w-4 h-4 text-indigo-400" /> Investments & Savings Trend
        </h3>

        {formattedTrends.length > 0 ? (
          <div className="h-64 w-full text-[10px] font-semibold text-slate-400">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedTrends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#475569" strokeWidth={0.5} tickLine={false} />
                <YAxis stroke="#475569" strokeWidth={0.5} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Legend iconType="circle" />
                <Bar name="Investments" dataKey="investments" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar name="Emergency Savings" dataKey="savings" fill="#c084fc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-10 text-center">No asset details compiled.</p>
        )}
      </div>

      {/* Repeated Wasteful / Low-Value Spending List */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg mb-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
          <FlameKindling className="w-4 h-4 text-rose-400 shrink-0" /> Leakage: Repeated Low-Value Spending
        </h3>
        <p className="text-[10px] text-slate-500 leading-normal mb-3 -mt-2">
          These items were flagged as "Low Value" by your importance selection. Consider reducing these leaks.
        </p>

        <div className="flex flex-col gap-3">
          {repeatedWasteful.length > 0 ? (
            repeatedWasteful.map((item) => (
              <div 
                key={item.name}
                className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-850/60 rounded-2xl"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">{item.name}</div>
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block mt-0.5">
                    Purchased {item.count} {item.count === 1 ? 'time' : 'times'} this period
                  </span>
                </div>
                
                <div className="text-right">
                  <span className="text-xs font-extrabold text-rose-400 block">
                    -₹{item.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] font-bold text-slate-500 block mt-0.5">
                    Total Wasted
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-slate-950/30 border border-slate-850/40 rounded-2xl p-6 text-center text-xs text-slate-500 italic">
              Congrats! No low-value spending recorded in this period.
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Cashflow Details / Comparisons Card */}
      {period === 'week' ? (
        /* Comparative Daily Matrix for Week */
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Calendar className="w-4 h-4 text-indigo-400" /> Daily Comparison (Last 7 Days)
          </h3>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5 text-right">Earned</th>
                  <th className="py-2.5 text-right">Spent</th>
                  <th className="py-2.5 text-right">Saved/Inv</th>
                  <th className="py-2.5 text-right">Net Flow</th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.map((row) => {
                  const totalOut = row.spent + row.investments + row.savings;
                  const net = row.earned - totalOut;
                  
                  return (
                    <tr key={row.label} className="border-b border-slate-800/40 hover:bg-slate-950/20 transition-colors">
                      <td className="py-3 font-bold text-slate-300">{row.label}</td>
                      <td className="py-3 text-right font-extrabold text-emerald-400">
                        {row.earned > 0 ? `+₹${row.earned.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="py-3 text-right font-extrabold text-rose-400">
                        {row.spent > 0 ? `-₹${row.spent.toLocaleString('en-IN')}` : '₹0'}
                      </td>
                      <td className="py-3 text-right font-bold text-slate-400">
                        ₹{(row.investments + row.savings).toLocaleString('en-IN')}
                      </td>
                      <td className={`py-3 text-right font-black ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {net > 0 ? '+' : ''}₹{net.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : period === 'month' ? (
        /* Comparative Weekly Matrix for Month */
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Calendar className="w-4 h-4 text-indigo-400" /> Weekly Comparison (Last 4 Weeks)
          </h3>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5">Period</th>
                  <th className="py-2.5 text-right">Earned</th>
                  <th className="py-2.5 text-right">Spent</th>
                  <th className="py-2.5 text-right">Saved/Inv</th>
                  <th className="py-2.5 text-right">Net Flow</th>
                </tr>
              </thead>
              <tbody>
                {weeklyBreakdown.map((row) => {
                  const totalOut = row.spent + row.investments + row.savings;
                  const net = row.earned - totalOut;
                  
                  return (
                    <tr key={row.label} className="border-b border-slate-800/40 hover:bg-slate-950/20 transition-colors">
                      <td className="py-3 font-bold text-slate-300">{row.label}</td>
                      <td className="py-3 text-right font-extrabold text-emerald-400">+₹{row.earned.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-extrabold text-rose-400">-₹{row.spent.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-bold text-slate-400">₹{(row.investments + row.savings).toLocaleString('en-IN')}</td>
                      <td className={`py-3 text-right font-black ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {net >= 0 ? '+' : ''}₹{net.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : period === 'year' ? (
        /* Comparative Monthly Matrix for Year */
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Calendar className="w-4 h-4 text-indigo-400" /> Monthly Comparison (Last 12 Months)
          </h3>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5">Month</th>
                  <th className="py-2.5 text-right">Earned</th>
                  <th className="py-2.5 text-right">Spent</th>
                  <th className="py-2.5 text-right">Saved/Inv</th>
                  <th className="py-2.5 text-right">Net Flow</th>
                </tr>
              </thead>
              <tbody>
                {formattedTrends.map((row) => {
                  const totalOut = row.spent + row.investments + row.savings;
                  const net = row.earned - totalOut;
                  
                  return (
                    <tr key={row.label} className="border-b border-slate-800/40 hover:bg-slate-950/20 transition-colors">
                      <td className="py-3 font-bold text-slate-300">{row.label}</td>
                      <td className="py-3 text-right font-extrabold text-emerald-400">+₹{row.earned.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-extrabold text-rose-400">-₹{row.spent.toLocaleString('en-IN')}</td>
                      <td className="py-3 text-right font-bold text-slate-400">₹{(row.investments + row.savings).toLocaleString('en-IN')}</td>
                      <td className={`py-3 text-right font-black ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {net >= 0 ? '+' : ''}₹{net.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tabular Transaction List for Day (fallback) */
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-4 shadow-lg">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Activity className="w-4 h-4 text-indigo-400" /> Cashflow Ledger Logs
          </h3>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-[10px] table-fixed">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[9px] uppercase font-bold tracking-wider">
                  <th className="py-2 w-[30%] pl-1">Category</th>
                  <th className="py-2 w-[18%] text-center">Time</th>
                  <th className="py-2 w-[18%] text-right">Earned</th>
                  <th className="py-2 w-[18%] text-right">Spent</th>
                  <th className="py-2 w-[16%] text-center">Tag</th>
                </tr>
              </thead>
              <tbody>
                {periodTransactions.length > 0 ? (
                  periodTransactions.map((tx) => {
                    const localTimeStr = new Date(tx.date).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });

                    const isIncome = tx.type === 'income';
                    const isExpense = tx.type === 'expense';
                    const isExpanded = expandedTxIds.includes(tx._id);
                    
                    return (
                      <tr key={tx._id} className="border-b border-slate-800/40 hover:bg-slate-950/20 transition-colors">
                        <td className="py-2.5 pl-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isIncome 
                                ? 'bg-emerald-400' 
                                : tx.type === 'investment'
                                ? 'bg-sky-400'
                                : tx.type === 'savings'
                                ? 'bg-purple-400'
                                : tx.importance === 'essential'
                                ? 'bg-emerald-500'
                                : tx.importance === 'moderate'
                                ? 'bg-indigo-500'
                                : 'bg-rose-500'
                            }`} />
                            <span 
                              onClick={() => toggleExpandTx(tx._id)}
                              className={`font-bold text-slate-200 cursor-pointer ${
                                isExpanded 
                                  ? 'whitespace-normal break-all' 
                                  : 'truncate max-w-[70px] block'
                              }`}
                              title={tx.titleId?.displayName || 'Transaction'}
                            >
                              {tx.titleId?.displayName || 'Transaction'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center text-slate-400 font-semibold whitespace-nowrap">
                          {localTimeStr}
                        </td>
                        <td className="py-2.5 text-right font-extrabold text-emerald-400 whitespace-nowrap">
                          {isIncome ? `+₹${tx.amount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 text-right font-extrabold text-rose-400 whitespace-nowrap">
                          {isExpense ? `-₹${tx.amount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-2.5 text-center">
                          {isExpense ? (
                            <span 
                              title={tx.importance === 'low_value' ? 'Low Value' : tx.importance === 'essential' ? 'Essential' : 'Moderate'}
                              className={`text-[8px] font-extrabold px-1 py-0.5 rounded border uppercase tracking-wider whitespace-nowrap cursor-help ${
                                tx.importance === 'essential' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : tx.importance === 'moderate'
                                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}
                            >
                              {tx.importance === 'low_value' ? 'Low' : tx.importance === 'essential' ? 'Ess' : 'Mod'}
                            </span>
                          ) : (
                            <span className="text-slate-650 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-xs text-slate-500 italic">
                      No transaction logs recorded in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
