import { Factory } from 'lucide-react';
import StageView from '../../components/production/StageView';

// All items routed to the Kakani unit — same three-level drill as Production:
// customer file → its orders → each order's items.
export default function KakaniOrders() {
  return (
    <StageView
      title="Kakani — Orders"
      subtitle="Items being finished at Kakani, by customer file — open a file to see its orders and their items"
      icon={Factory}
      filters={{ branch: 'Kakani' }}
      mode="overview"
      // An order drops off this list the moment all of its Kakani items are at
      // Ready for Container — nothing is left to do here, and Container takes
      // over from that point.
      hideReadyOrders
      emptyText="No items routed to Kakani yet — orders leave this list once every piece is Ready for Container."
    />
  );
}
