import { Sparkles } from 'lucide-react';
import StageView from '../../components/production/StageView';

export default function KakaniPolish() {
  return (
    <StageView
      title="Kakani — Polish"
      subtitle="Items at the polishing stage"
      icon={Sparkles}
      filters={{ stage: 'Polish' }}
      advance
      emptyText="Nothing at polish."
    />
  );
}
