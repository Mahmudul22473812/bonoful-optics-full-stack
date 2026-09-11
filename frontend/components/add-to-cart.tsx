'use client';

import { useState } from 'react';
import type { Product } from '@/lib/catalog';
import { useCommerce } from './commerce-provider';

export function AddToCart({ product }: { product: Product }) {
  const { addToCart, wishlist, toggleWishlist } = useCommerce();
  const [added, setAdded] = useState(false);
  const saved = wishlist.includes(product.id);
  return (
    <div className="buy-actions">
      <button className="button button-dark button-wide" type="button" disabled={!product.stock} onClick={() => { addToCart(product); setAdded(true); setTimeout(() => setAdded(false), 1800); }}>{added ? 'Added to your bag ✓' : product.stock ? 'Add to bag' : 'Out of stock'}</button>
      <button className={`button button-outline ${saved ? 'active' : ''}`} type="button" aria-label="Save to wishlist" onClick={() => toggleWishlist(product.id)}>{saved ? '♥' : '♡'}</button>
      {added && <p className="toast" role="status">{product.name} is ready in your bag.</p>}
    </div>
  );
}
