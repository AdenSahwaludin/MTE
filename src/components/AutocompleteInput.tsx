import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import { searchProducts, SearchMatch } from '../services/storageService';
import { formatRupiah } from '../utils/formatters';
import { Tag, Sparkles, X } from 'lucide-react';

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
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } else {
      setMatches([]);
      setIsOpen(false);
    }
  }, [value]);

  // Click outside listener to close dropdown immediately
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

  const hasMatches = matches.length > 0;
  const isNewItem = value.trim().length > 0 && !hasMatches;

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
            const results = searchProducts(value);
            setMatches(results);
            setIsOpen(results.length > 0);
          }
        }}
        onBlur={() => {
          // Delay to allow item click or button tap before hiding
          setTimeout(() => {
            setIsOpen(false);
          }, 180);
        }}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {/* Floating Dropdown ONLY when there are actual matching products */}
      {isOpen && hasMatches && (
        <div className="autocomplete-dropdown-wrapper">
          <div className="autocomplete-dropdown-header">
            <span>Saran Produk ({matches.length})</span>
            <button
              type="button"
              className="autocomplete-close-btn"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsOpen(false);
              }}
              title="Tutup saran"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="autocomplete-dropdown">
            {matches.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={item.product.id}
                  className={`autocomplete-item ${isSelected ? 'selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevents blur before select triggers
                    handleSelect(item.product);
                  }}
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
            })}
          </ul>
        </div>
      )}

      {/* Non-overlapping Inline Helper Badge when typing a brand new item */}
      {isNewItem && (
        <div className="autocomplete-inline-hint">
          <Sparkles size={13} color="#d97706" style={{ flexShrink: 0 }} />
          <span>
            Barang belum terdaftar. Menambahkan ini akan <strong>otomatis menyimpannya</strong> ke Master Produk.
          </span>
        </div>
      )}
    </div>
  );
};
