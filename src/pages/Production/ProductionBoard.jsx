import { Factory } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Production — three levels: customer file → its orders → each order's items.
// Open a file to see every order in it; each order lists its own items, which
// you route to Kakani / Jhalamand and move through their stages.
export default function ProductionBoard() {
  return (
    <StageView
      title="Production"
      subtitle="Finalized orders by customer file — open a file to see its orders and their items"
      icon={Factory}
      filters={{}}
      mode="overview"
      allowRoute
      emptyText="No orders in production yet. Finalize an order in the Office to see it here."
    />
  );
}
