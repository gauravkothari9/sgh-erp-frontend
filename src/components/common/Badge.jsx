import { ORDER_STATUS_CONFIG, CUSTOMER_STATUS_CONFIG, ORDER_TYPE_CONFIG } from '../../utils/formatters';

export const StatusBadge = ({ status, type = 'order' }) => {
  const config =
    type === 'customer'
      ? CUSTOMER_STATUS_CONFIG[status]
      : ORDER_STATUS_CONFIG[status];

  if (!config) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        {status || '—'}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}
    >
      {config.dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      )}
      {config.label}
    </span>
  );
};

export const OrderTypeBadge = ({ type }) => {
  const config = ORDER_TYPE_CONFIG[type] || { color: 'bg-gray-100 text-gray-600' };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {type}
    </span>
  );
};

export const CountBadge = ({ count, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                text-[13px] font-bold rounded-full bg-brand-100 text-brand-700 ${className}`}
  >
    {count}
  </span>
);
