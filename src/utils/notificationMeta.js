import {
  PackageCheck, ClipboardCheck, Factory, XCircle, Store, AlertTriangle,
  Receipt, IndianRupee, Undo2, ShieldCheck, UserPlus, Bell,
} from 'lucide-react';

// Icon + colour per notification type, so the bell and the notifications page
// tell the same visual story.
const META = {
  'container-complete':      { icon: PackageCheck,   tone: 'bg-emerald-100 text-emerald-600' },
  'order-finalized':         { icon: ClipboardCheck, tone: 'bg-blue-100 text-blue-600' },
  'order-processing':        { icon: Factory,        tone: 'bg-indigo-100 text-indigo-600' },
  'order-status':            { icon: ClipboardCheck, tone: 'bg-blue-100 text-blue-600' },
  'order-cancelled':         { icon: XCircle,        tone: 'bg-red-100 text-red-600' },
  'stage-advanced':          { icon: Factory,        tone: 'bg-indigo-100 text-indigo-600' },
  'showroom-sold-out':       { icon: Store,          tone: 'bg-amber-100 text-amber-600' },
  'showroom-no-local-price': { icon: AlertTriangle,  tone: 'bg-red-100 text-red-600' },
  'local-sale-created':      { icon: Receipt,        tone: 'bg-emerald-100 text-emerald-600' },
  'local-sale-balance-due':  { icon: IndianRupee,    tone: 'bg-amber-100 text-amber-600' },
  'local-sale-payment':      { icon: IndianRupee,    tone: 'bg-emerald-100 text-emerald-600' },
  'local-sale-refund-due':   { icon: IndianRupee,    tone: 'bg-blue-100 text-blue-600' },
  'local-sale-returned':     { icon: Undo2,          tone: 'bg-amber-100 text-amber-600' },
  'permissions-changed':     { icon: ShieldCheck,    tone: 'bg-purple-100 text-purple-600' },
  'user-created':            { icon: UserPlus,       tone: 'bg-purple-100 text-purple-600' },
};

const FALLBACK = { icon: Bell, tone: 'bg-gray-100 text-gray-500' };

export const notificationMeta = (type) => META[type] || FALLBACK;

// Groups used by the filter row on the notifications page.
export const NOTIFICATION_GROUPS = [
  { key: '', label: 'All', types: [] },
  { key: 'orders', label: 'Orders', types: ['order-finalized', 'order-processing', 'order-status', 'order-cancelled', 'container-complete'] },
  { key: 'production', label: 'Production', types: ['stage-advanced'] },
  { key: 'showroom', label: 'Showroom', types: ['showroom-sold-out', 'showroom-no-local-price'] },
  { key: 'local', label: 'Local', types: ['local-sale-created', 'local-sale-balance-due', 'local-sale-payment', 'local-sale-refund-due', 'local-sale-returned'] },
  { key: 'admin', label: 'Admin', types: ['permissions-changed', 'user-created'] },
];
