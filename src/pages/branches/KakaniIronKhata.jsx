import { Boxes } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Iron Khata workshop queue — all Kakani items assigned to this maker.
export default function KakaniIronKhata() {
  return (
    <StageView
      title="Kakani — Iron Khata"
      subtitle="Items assigned to the Iron Khata workshop"
      icon={Boxes}
      filters={{ branch: 'Kakani', maker: 'Iron Khata' }}
      advance
      emptyText="No items assigned to Iron Khata yet."
    />
  );
}
