import { Truck } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Jhalamand items ready to move to Kakani, or already dispatched.
export default function JhalamandInTransit() {
  return (
    <StageView
      title="Jhalamand — In-Transit"
      subtitle="Ready for transit and dispatched items heading to Kakani"
      icon={Truck}
      filters={{ branch: 'Jhalamand', stage: 'Ready for Transit,In Transit' }}
      advance
      emptyText="Nothing ready for transit."
    />
  );
}
