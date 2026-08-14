import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { searchProducts, SearchMatch } from '../services/storageService';
import { formatRupiah } from '../utils/formatters';
import { Search, Tag, Sparkles } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelectProduct: (product: Product) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onSelectProduct,
  placeholder = 'Ketik nama barang atau nama lain/alias...',
  autoFocus = false,
  inputRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search matches whenever value changes
  useEffect(() => {
    if (value.trim().length > 0) {
      const results = searchProducts(value);
      setMatches(results);
      setIsOpen(true);
      setSelectedIndex(-1);
    } else {
      setMatches([]);
      setIsOpen(false);
    }
  }, [value]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || matches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < matches.length) {
        e.preventDefault();
        handleSelect(matches[selectedIndex].product);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (product: Product) => {
    onSelectProduct(product);
    setIsOpen(false);
  };

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (value.trim().length > 0) {
            setMatches(searchProducts(value));
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {isOpen && value.trim().length > 0 && (
        <ul className="autocomplete-dropdown">
          {matches.length > 0 ? (
            matches.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={item.product.id}
                  className={`autocomplete-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(item.product)}
                >
                  <div className="item-left">
                    <div className="item-name">{item.product.name}</div>
                    {item.matchedBy === 'alias' && item.matchText && (
                      <span className="item-alias-tag">
                        <Tag size={11} />
                        Cocok dengan alias: "{item.matchText}"
                      </span>
                    )}
                    {item.product.aliases && item.product.aliases.length > 0 && item.matchedBy === 'name' && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {item.product.aliases.slice(0, 2).map((alias, aIdx) => (
                          <span key={aIdx} className="item-alias-tag" style={{ background: '#f1f5f9', color: '#64748b' }}>
                            {alias}
                          </span>
                        ))}
                        {item.product.aliases.length > 2 && (
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>+{item.product.aliases.length - 2} alias</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="item-price">
                    {formatRupiah(item.product.price)}
                    {item.product.unit ? ` / ${item.product.unit}` : ''}
                  </div>
                </li>
              );
            })
          ) : (
            <div className="autocomplete-empty-hint">
              <Sparkles size={14} color="#f59e0b" />
              <span>
                Barang belum terdaftar. Menambahkan ini akan <strong>otomatis menyimpannya</strong> ke Master Produk.
              </span>
            </div>
          )}
        </ul>
      )}
    </div>
  );
};
