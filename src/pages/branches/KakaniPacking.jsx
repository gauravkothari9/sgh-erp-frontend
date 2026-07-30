import { Package } from 'lucide-react';
import StageView from '../../components/production/StageView';

// Final Kakani stage — advancing marks the item Ready for Container.
export default function KakaniPacking() {
  return (
    <StageView
      title="Kakani — Packing"
      subtitle="Pack items and mark them ready for the container — packed items stay listed here"
      icon={Package}
      // Both stages: an item marked Ready for Container KEEPS its row here (and
      // its order keeps its place in the file), so the screen shows everything
      // packed and still to pack for every order of every file.
      filters={{ stage: 'Packing,Ready for Container' }}
      // …but only the Packing pieces count as pending, and an item split across
      // the two stages shows as a single row.
      pendingStage="Packing"
      advance
      // Packing is the last step, so each row also shows how many of that item's
      // pieces have already made it to Ready for Container.
      readyColumn
      // …and how close each file's container is to being complete.
      containerProgress
      advanceLabel="Mark Ready for Container"
      emptyText="Nothing at packing."
    />
  );
}
