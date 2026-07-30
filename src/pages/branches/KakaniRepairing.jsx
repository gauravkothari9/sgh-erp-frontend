import { Wrench } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Manufacturing unit — Kakani in-house items tagged "Manufacturing" (i.e. not
// Iron Khata) that are still ON the bench.
//
// Only the making stages show here — 'Repairing' for antiques, 'Made in Kakani'
// for production — so the one move available is the next stage, Polish. Once a
// piece is polished it belongs to the Polish / QC / Packing screens, and moving
// it on is done there, not from this unit.
export default function KakaniRepairing() {
  return (
    <StageView
      title="Kakani — Manufacturing"
      subtitle="Items on the bench in the Kakani manufacturing unit — move them to Polish when done"
      icon={Wrench}
      filters={{ branch: 'Kakani', subUnit: 'Manufacturing', stage: 'Repairing,Made in Kakani' }}
      advance
      emptyText="Nothing on the bench in the manufacturing unit."
    />
  );
}
