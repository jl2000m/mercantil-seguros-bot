'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuoteConfig, CatalogData } from '../src/types';
import SearchableSelect from './components/SearchableSelect';

export default function Home() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Omit<QuoteConfig, 'ages'> & { tripTypeValue: string; ages?: string[] }>>({
    tripType: 'Viajes Por Día',
    tripTypeValue: 'Viajes Por Día',
    passengers: 1,
    ages: ['30'],
    departureDate: '',
    returnDate: '',
    agent: '2851', // Risk Management - fijo, no se puede cambiar
  });
  const [dateInputs, setDateInputs] = useState<{ departureDate: string; returnDate: string }>({
    departureDate: '',
    returnDate: '',
  });
  const [availableDestinations, setAvailableDestinations] = useState<Array<{ value: string; text: string }>>([]);
  const [dateError, setDateError] = useState<string>('');

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (catalog && formData.tripTypeValue) {
      const destinations = catalog.destinations[formData.tripTypeValue] || [];
      setAvailableDestinations(destinations);
      if (destinations.length > 0 && !formData.destination) {
        setFormData(prev => ({ ...prev, destination: destinations[0].text }));
      }
    }
  }, [catalog, formData.tripTypeValue]);

  useEffect(() => {
    if (catalog) {
      // Siempre usar Risk Management como agente fijo
      setFormData(prev => ({ ...prev, agent: '2851' }));
    }
  }, [catalog]);

  const loadCatalog = async () => {
    try {
      const response = await fetch('/api/catalog');
      if (response.ok) {
        const data = await response.json();
        setCatalog(data);
        if (data.origins && data.origins.length > 0) {
          setFormData(prev => ({ ...prev, origin: data.origins[0].text }));
        }
      }
    } catch (error) {
      console.error('Error al cargar catálogo:', error);
    }
  };

  const handlePassengerChange = (count: number) => {
    const newAges = Array(count).fill('').map((_, i) => formData.ages?.[i] || '30');
    setFormData(prev => ({ ...prev, passengers: count, ages: newAges }));
  };

  const handleAgeChange = (index: number, value: string) => {
    const newAges = [...(formData.ages || [])];
    newAges[index] = value;
    setFormData(prev => ({ ...prev, ages: newAges }));
  };

  const validateDate = (dateStr: string): boolean => {
    if (!dateStr) return true;
    // dateStr is in YYYY-MM-DD format from the input
    const selectedDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');

    // Validar fecha de salida (usar el valor del input que está en YYYY-MM-DD)
    if (dateInputs.departureDate) {
      if (!validateDate(dateInputs.departureDate)) {
        setDateError('La fecha de salida no puede ser en el pasado');
        return;
      }
    }

    // Validar que la fecha de regreso sea después de la de salida
    if (dateInputs.departureDate && dateInputs.returnDate) {
      const departure = new Date(dateInputs.departureDate);
      const returnDate = new Date(dateInputs.returnDate);
      if (returnDate < departure) {
        setDateError('La fecha de regreso debe ser después de la fecha de salida');
        return;
      }
    }

    setLoading(true);

    try {
      // Enviar tripTypeValue en lugar de tripType a la API
      const { tripTypeValue, ages, ...dataToSend } = formData;
      const payload = {
        ...dataToSend,
        tripType: tripTypeValue || formData.tripType,
        ages: (ages || []).map(age => typeof age === 'string' ? parseInt(age, 10) : age),
        agent: '2851', // Siempre usar Risk Management
      };
      
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      // Guardar resultado en sessionStorage y navegar a la página de resultados
      sessionStorage.setItem('quoteResult', JSON.stringify(result));
      router.push('/results');
    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
      sessionStorage.setItem('quoteResult', JSON.stringify(errorResult));
      router.push('/results');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    // dateStr is in YYYY-MM-DD format from the input
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (field: 'departureDate' | 'returnDate', value: string) => {
    // Store the raw input value (YYYY-MM-DD) for the input element
    setDateInputs(prev => ({ ...prev, [field]: value }));
    
    if (value) {
      // Convert to DD/MM/YYYY for the API
      const formatted = formatDate(value);
      setFormData(prev => ({ ...prev, [field]: formatted }));
      setDateError('');
    } else {
      setFormData(prev => ({ ...prev, [field]: '' }));
      setDateError('');
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  if (!catalog) {
    return (
      <div className="container">
        <div className="card">
          <p>Cargando catálogo...</p>
        </div>
      </div>
    );
  }

  const riskManagementAgent = catalog.agents.find(a => a.value === '2851');

  return (
    <div className="container">
      <h1>🏥 Generador de Cotizaciones Mercantil Seguros</h1>

      <div className="card">
        <h2>Configuración de Cotización</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="tripType">Tipo de Viaje</label>
            <select
              id="tripType"
              value={formData.tripTypeValue || 'Viajes Por Día'}
              onChange={(e) => {
                const selectedType = catalog.tripTypes.find(t => t.value === e.target.value);
                if (selectedType) {
                  setFormData(prev => ({ 
                    ...prev, 
                    tripType: selectedType.text as 'Viajes Por Día' | 'Anual Multiviaje',
                    tripTypeValue: selectedType.value
                  }));
                }
              }}
              required
            >
              {catalog.tripTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.text}
                </option>
              ))}
            </select>
          </div>

          <SearchableSelect
            id="origin"
            label="Origen del Viaje"
            value={formData.origin || ''}
            onChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}
            options={catalog.origins}
            required
            placeholder="Buscar país de origen..."
          />

          <SearchableSelect
            id="destination"
            label="Destino"
            value={formData.destination || ''}
            onChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
            options={availableDestinations}
            required
            placeholder="Buscar destino..."
          />

          <div className="form-group">
            <label htmlFor="agent">Agente/Agencia</label>
            <input
              type="text"
              id="agent"
              value={riskManagementAgent?.text || 'Risk Management Seguros, S.a. (rm Seguros)'}
              disabled
              style={{
                backgroundColor: '#f5f5f5',
                cursor: 'not-allowed',
                opacity: 0.7,
              }}
            />
            <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
              Agente fijo: Risk Management Seguros
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="departureDate">Fecha de Salida</label>
            <input
              type="date"
              id="departureDate"
              value={dateInputs.departureDate}
              min={getMinDate()}
              onChange={(e) => handleDateChange('departureDate', e.target.value)}
              required
            />
            {formData.departureDate && (
              <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
                Seleccionada: {formData.departureDate}
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="returnDate">Fecha de Regreso</label>
            <input
              type="date"
              id="returnDate"
              value={dateInputs.returnDate}
              min={dateInputs.departureDate || getMinDate()}
              onChange={(e) => handleDateChange('returnDate', e.target.value)}
              required
            />
            {formData.returnDate && (
              <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
                Seleccionada: {formData.returnDate}
              </small>
            )}
          </div>

          {dateError && (
            <div className="error" style={{ marginBottom: '1rem' }}>
              {dateError}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="passengers">Número de Pasajeros</label>
            <select
              id="passengers"
              value={formData.passengers || 1}
              onChange={(e) => handlePassengerChange(parseInt(e.target.value))}
              required
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="ages-label">Edades de los Pasajeros</label>
            <div className="passenger-ages">
              {Array.from({ length: formData.passengers || 1 }).map((_, index) => (
                <div key={index}>
                  <label htmlFor={`age-${index}`} style={{ fontSize: '0.875rem' }}>
                    Pasajero {index + 1}
                  </label>
                  <input
                    type="number"
                    id={`age-${index}`}
                    min="1"
                    max="100"
                    value={formData.ages?.[index] || ''}
                    onChange={(e) => handleAgeChange(index, e.target.value)}
                    required
                    placeholder="Edad"
                  />
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Generando Cotización...' : 'Generar Cotización'}
          </button>
        </form>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="progress-container">
            <h2>Calculando Cotizaciones...</h2>
            <p>Por favor espere mientras generamos sus cotizaciones de seguro de viaje</p>
            <div className="progress-bar-wrapper">
              <div className="progress-bar"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
