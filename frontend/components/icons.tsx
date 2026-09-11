export function ArrowIcon() { return <span aria-hidden="true">→</span>; }
export function SearchIcon() { return <span aria-hidden="true" className="icon-glyph">⌕</span>; }
export function HeartIcon({ filled = false }: { filled?: boolean }) { return <span aria-hidden="true">{filled ? '♥' : '♡'}</span>; }
export function BagIcon() { return <span aria-hidden="true">⌑</span>; }
export function StarRow({ rating = 5 }: { rating?: number }) { return <span className="stars" aria-label={`${rating} out of 5 stars`}>{'★'.repeat(rating)}{'☆'.repeat(5-rating)}</span>; }

