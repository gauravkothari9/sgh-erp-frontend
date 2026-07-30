import { Wrench } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Manufacturing unit — every Kakani in-house item tagged "Manufacturing"
// (i.e. not Iron Khata), across all its stages.
export default function KakaniRepairing() {
  return (
    <StageView
      title="Kakani — Manufacturing"
      subtitle="Items being made in the Kakani manufacturing unit"
      icon={Wrench}
      filters={{ branch: 'Kakani', subUnit: 'Manufacturing' }}
      advance
      emptyText="Nothing in the manufacturing unit."
    />
  );
}
