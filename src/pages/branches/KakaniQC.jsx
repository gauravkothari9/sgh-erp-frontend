import { ClipboardCheck } from 'lucide-react';
import StageView from '../../components/production/StageView';

export default function KakaniQC() {
  return (
    <StageView
      title="Kakani — QC"
      subtitle="Items in quality control"
      icon={ClipboardCheck}
      filters={{ stage: 'QC' }}
      advance
      emptyText="Nothing in QC."
    />
  );
}
