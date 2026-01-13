'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchableSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; text: string }>;
  required?: boolean;
  placeholder?: string;
}

export default function SearchableSelect({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
  placeholder = 'Search...',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTerm) {
      const filtered = options.filter(opt =>
        opt.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => 
    opt.value === value || 
    opt.text === value ||
    (typeof value === 'string' && (opt.value === value || opt.text === value))
  );

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: '0.75rem',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{selectedOption?.text || placeholder}</span>
          <span>{isOpen ? '▲' : '▼'}</span>
        </div>
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              marginTop: '4px',
              maxHeight: '300px',
              overflow: 'auto',
              zIndex: 1000,
              boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            }}
          >
            <input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: 'none',
                borderBottom: '1px solid #e0e0e0',
                borderRadius: '8px 8px 0 0',
                fontSize: '1rem',
              }}
            />
            <div style={{ maxHeight: '250px', overflow: 'auto' }}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      onChange(option.text);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: (value === option.value || value === option.text) ? '#f0f0ff' : 'white',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = (value === option.value || value === option.text) ? '#f0f0ff' : 'white';
                    }}
                  >
                    {option.text}
                  </div>
                ))
              ) : (
                <div style={{ padding: '0.75rem', color: '#999' }}>
                  No se encontraron resultados
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {required && !value && (
        <small style={{ color: '#c33', display: 'block', marginTop: '0.25rem' }}>
          This field is required
        </small>
      )}
    </div>
  );
}

