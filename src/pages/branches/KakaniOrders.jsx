import { Factory } from 'lucide-react';
import StageView from '../../components/production/StageView';

// All items routed to the Kakani unit, grouped by file.
export default function KakaniOrders() {
  return (
    <StageView
      title="Kakani — Orders"
      subtitle="All items being finished at Kakani"
      icon={Factory}
      filters={{ branch: 'Kakani' }}
      mode="overview"
      emptyText="No items routed to Kakani yet."
    />
  );
}
