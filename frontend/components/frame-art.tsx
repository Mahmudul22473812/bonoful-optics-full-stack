import type { Product } from '@/lib/catalog';

export function FrameArt({ tone, compact = false }: { tone: Product['tone']; compact?: boolean }) {
  return (
    <div className={`frame-art frame-${tone}${compact ? ' frame-compact' : ''}`} aria-hidden="true">
      <span className="lens lens-left" />
      <span className="bridge" />
      <span className="lens lens-right" />
      <span className="arm arm-left" />
      <span className="arm arm-right" />
    </div>
  );
}

