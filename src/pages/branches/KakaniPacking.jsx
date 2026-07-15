import { Package } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Final Kakani stage — advancing marks the item Ready for Container.
export default function KakaniPacking() {
  return (
    <StageView
      title="Kakani — Packing"
      subtitle="Pack items and mark them ready for the container"
      icon={Package}
      filters={{ stage: 'Packing' }}
      advance
      advanceLabel="Mark Ready for Container"
      emptyText="Nothing at packing."
    />
  );
}
