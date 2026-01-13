'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuoteResult, QuotePlan } from '../../src/types';

export default function ResultsPage() {
  const router = useRouter();
  const [quoteResult, setQuoteResult] = useState<QuoteResult | null>(null);
  const [loadingPurchase, setLoadingPurchase] = useState<number | null>(null);

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

  const handleComprar = async (planIndex: number) => {
    setLoadingPurchase(planIndex);
    
    try {
      // Get the quote config from sessionStorage if available
      const storedQuote = sessionStorage.getItem('quoteResult');
      const quoteConfig = storedQuote ? JSON.parse(storedQuote) : null;
      
      const response = await fetch('/api/purchase-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planIndex,
          quoteConfig: quoteConfig?.quoteData ? {
            // We need to reconstruct the config from the quote result
            // For now, we'll let the API handle it
          } : null,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.purchaseFormData) {
        // Store purchase form data and navigate to purchase page
        sessionStorage.setItem('purchaseFormData', JSON.stringify(result.purchaseFormData));
        sessionStorage.setItem('selectedPlanIndex', planIndex.toString());
        router.push('/purchase');
      } else {
        alert(`Error: ${result.error || 'No se pudo obtener el formulario de compra'}`);
      }
    } catch (error) {
      console.error('Error al obtener formulario de compra:', error);
      alert('Error al obtener el formulario de compra. Por favor, intente de nuevo.');
    } finally {
      setLoadingPurchase(null);
    }
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
                      <button
                        onClick={() => handleComprar(index)}
                        disabled={loadingPurchase === index}
                        style={{
                          marginTop: '1rem',
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: loadingPurchase === index ? '#ccc' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loadingPurchase === index ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {loadingPurchase === index ? 'Cargando...' : 'COMPRAR'}
                      </button>
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
