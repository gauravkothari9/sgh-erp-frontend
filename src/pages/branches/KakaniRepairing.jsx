import { Wrench } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Repairing (antiques) + Manufacturing (Made in Kakani production) at Kakani.
export default function KakaniRepairing() {
  return (
    <StageView
      title="Kakani — Repairing / Manufacturing"
      subtitle="Antiques being repaired and production being made at Kakani"
      icon={Wrench}
      filters={{ stage: 'Repairing,Made in Kakani', location: 'Kakani' }}
      advance
      emptyText="Nothing in repairing / manufacturing."
    />
  );
}
