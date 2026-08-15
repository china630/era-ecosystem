import { Suspense } from 'react';
import Chessboard from '@/components/Chessboard';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Chessboard />
    </Suspense>
  );
}
