import { Factory } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Production — every finalized order's items, grouped into file folders (same
// file system as Order Management). Unassigned items can be routed to
// Kakani / Jhalamand; routed items advance stage by stage (by quantity).
export default function ProductionBoard() {
  return (
    <StageView
      title="Production"
      subtitle="Finalized orders — assign each item to Kakani / Jhalamand, then move it through its stages"
      icon={Factory}
      filters={{}}
      mode="overview"
      allowRoute
      emptyText="No orders in production yet. Finalize an order in the Office to see it here."
    />
  );
}
