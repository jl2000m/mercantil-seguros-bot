'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuoteResult, QuotePlan } from '../../src/types';

export default function ResultsPage() {
  const router = useRouter();
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('quoteResult');
    if (stored) {
      try {
        setQuoteResult(JSON.parse(stored));
      } catch (error) {
        console.error('Error al parsear resultado:', error);
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router]);

  const handleNewQuote = () => {
    sessionStorage.removeItem('quoteResult');
    router.push('/');
  };

  if (!quoteResult) {
    return (
      <div className="container">
        <div className="card">
          <p>Cargando resultados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>📊 Resultados de Cotización</h1>

      <div className="card">
        {quoteResult.success ? (
          <>
            {quoteResult.quoteData?.plans && quoteResult.quoteData.plans.length > 0 ? (
              <>
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2>Planes de Seguro Disponibles</h2>
                  <button onClick={handleNewQuote} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
                    Nueva Cotización
                  </button>
                </div>
                <div className="quotes-grid">
                  {quoteResult.quoteData.plans.map((plan: QuotePlan, index: number) => (
                    <div key={index} className="quote-card">
                      <h3>{plan.name.split('\n')[0].trim()}</h3>
                      <div className="coverage">{plan.name.split('\n')[1]?.trim() || ''}</div>
                      <div className="price">{plan.price}</div>
                      <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '0.5rem' }}>
                        ID del Plan: {plan.planId}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: '#666' }}>
                    <strong>Total de Planes Encontrados:</strong> {quoteResult.quoteData.planCount || quoteResult.quoteData.plans.length}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <h2>No Hay Cotizaciones Disponibles</h2>
                <p>No se encontraron cotizaciones para esta configuración.</p>
                <button onClick={handleNewQuote} style={{ marginTop: '1rem' }}>
                  Intentar de Nuevo
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="error">
            <h2>Error al Generar Cotización</h2>
            <p>{quoteResult.error || 'Ocurrió un error desconocido'}</p>
            <button onClick={handleNewQuote} style={{ marginTop: '1rem' }}>
              Intentar de Nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
