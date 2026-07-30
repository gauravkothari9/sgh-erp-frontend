import { Boxes } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Iron Khata workshop queue — Kakani items tagged to this workshop that are
// still on the bench. Same rule as the manufacturing unit: only the making
// stages show, so the single move available is on to Polish.
export default function KakaniIronKhata() {
  return (
    <StageView
      title="Kakani — Iron Khata"
      subtitle="Items on the bench in the Iron Khata workshop — move them to Polish when done"
      icon={Boxes}
      filters={{ branch: 'Kakani', subUnit: 'Iron Khata', stage: 'Repairing,Made in Kakani' }}
      advance
      emptyText="No items on the bench in Iron Khata."
    />
  );
}
