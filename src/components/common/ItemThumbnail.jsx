import React, { useState } from 'react';
import { getCategoryMeta } from '../../utils/categoryIcons';

/**
 * ItemThumbnail
 *
 * Renders an equipment image with graceful icon fallback.
 * - If src is missing/broken → shows category icon + label
 * - className is applied to the outer container
 *
 * Usage:
 *   <ItemThumbnail src={item.image} name={item.name} category={item.category}
 *     className="w-full h-full" onClick={...} />
 */
export const ItemThumbnail = ({ src, name, category, className = '', onClick }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const catMeta = getCategoryMeta(category);
  const CatIcon = catMeta.icon;

  const showFallback = !src || hasError;

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center overflow-hidden bg-surface-container-lowest ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Fallback icon — always rendered, hidden when image loads successfully */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity ${showFallback ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${catMeta.color} border border-outline-variant/40`}
        title={catMeta.label}
      >
        <CatIcon className="w-8 h-8 mb-1 opacity-80" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-center px-1 truncate max-w-full">
          {catMeta.label}
        </span>
      </div>

      {/* Actual image — hidden during load/error */}
      {src && (
        <img
          src={src}
          alt={name}
          onError={() => { setHasError(true); setIsLoading(false); }}
          onLoad={() => setIsLoading(false)}
          className={`max-h-full max-w-full object-contain p-1 transition-opacity duration-300 ${hasError ? 'opacity-0' : isLoading ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
    </div>
  );
};
