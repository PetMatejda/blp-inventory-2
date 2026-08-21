import React, { useState } from 'react';
import { getCategoryMeta } from '../../utils/categoryIcons';
import { Image as ImageIcon } from 'lucide-react';

export const ItemThumbnail = ({ src, name, category, className = '', onClick }) => {
  const [hasError, setHasError] = useState(false);
  const catMeta = getCategoryMeta(category);
  const CatIcon = catMeta.icon;

  if (!src || hasError) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2 rounded-xl border border-outline-variant/60 transition-all ${catMeta.color} ${className}`}
        title={`Kategorie: ${catMeta.label}`}
      >
        <CatIcon className="w-8 h-8 mb-1 opacity-90" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-center truncate max-w-full">
          {catMeta.label}
        </span>
      </div>
    );
  }

  return (
    <div onClick={onClick} className={`relative flex items-center justify-center overflow-hidden rounded-xl ${className}`}>
      <img
        src={src}
        alt={name}
        onError={() => setHasError(true)}
        className="max-h-full max-w-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
      />
      <span className="absolute bottom-1 right-1 bg-black/60 text-white p-1 rounded text-[10px]">
        <ImageIcon className="w-3 h-3" />
      </span>
    </div>
  );
};
