import { useState } from 'react';
import { Warehouse, Hammer, Factory } from 'lucide-react';
import StageView from '../components/production/StageView';

// Jhalamand unit — all items routed to Jhalamand, split Antiques | Production.
const TABS = [
  { id: 'Antique', label: 'Antiques', icon: Hammer },
  { id: 'Production', label: 'Production', icon: Factory },
];

export default function JhalamandOrders() {
  const [tab, setTab] = useState('Antique');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
          <Warehouse size={20} strokeWidth={1.6} />
        </div>
        <div className="min-w-0">
          <h1 className="page-title">Jhalamand — Orders</h1>
          <p className="page-subtitle">Items being made / sourced at the Jhalamand unit</p>
        </div>
      </div>

      <div className="border-b border-brand-100 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <StageView
        key={tab}
        filters={{ branch: 'Jhalamand', category: tab }}
        mode="overview"
        emptyText={`No ${tab === 'Antique' ? 'antique' : 'production'} items at Jhalamand.`}
      />
    </div>
  );
}
