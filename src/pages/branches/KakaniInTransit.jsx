import { Truck } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Items dispatched from Jhalamand and currently in transit — Kakani receives them.
export default function KakaniInTransit() {
  return (
    <StageView
      title="Kakani — Orders In-Transit"
      subtitle="Incoming from Jhalamand — mark received on arrival"
      icon={Truck}
      filters={{ location: 'In Transit' }}
      advance
      advanceLabel="Mark Received"
      emptyText="Nothing in transit to Kakani right now."
    />
  );
}
