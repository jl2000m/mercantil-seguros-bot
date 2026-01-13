'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PurchaseFormData, PurchaseFormField } from '../../src/types';

export default function PurchasePage() {
  const router = useRouter();
  const [purchaseFormData, setPurchaseFormData] = useState<PurchaseFormData | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('purchaseFormData');
    if (stored) {
      try {
        const data = JSON.parse(stored) as PurchaseFormData;
        setPurchaseFormData(data);
        
        // Initialize form values with default values from fields
        const initialValues: Record<string, string> = {};
        data.forms.forEach((form) => {
          form.fields.forEach((field) => {
            if (field.name && field.value) {
              initialValues[field.name] = field.value;
            }
          });
        });
        setFormValues(initialValues);
      } catch (error) {
        console.error('Error al parsear datos del formulario:', error);
        router.push('/results');
      }
    } else {
      router.push('/results');
    }
  }, [router]);

  const handleInputChange = (name: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent, formIndex: number) => {
    e.preventDefault();
    setLoading(true);

    try {
      const form = purchaseFormData?.forms[formIndex];
      if (!form) return;

      // Build form data
      const formData = new FormData();
      form.fields.forEach((field) => {
        if (field.name) {
          const value = formValues[field.name] || field.value || '';
          formData.append(field.name, value);
        }
      });

      // Submit to the form's action URL
      if (form.action) {
        const actionUrl = form.action.startsWith('http')
          ? form.action
          : `https://www1.mercantilseguros.com${form.action}`;

        // For now, we'll show the form data and action URL
        // In a real scenario, you might want to submit directly or proxy through your API
        console.log('Form data to submit:', Object.fromEntries(formData));
        console.log('Action URL:', actionUrl);
        console.log('Method:', form.method);

        alert(
          `Formulario listo para enviar.\n\n` +
          `Action: ${actionUrl}\n` +
          `Method: ${form.method}\n\n` +
          `Datos: ${JSON.stringify(Object.fromEntries(formData), null, 2)}\n\n` +
          `Nota: En producción, esto se enviaría directamente a Mercantil Seguros.`
        );
      } else {
        alert('El formulario no tiene una URL de acción definida.');
      }
    } catch (error) {
      console.error('Error al enviar formulario:', error);
      alert('Error al enviar el formulario. Por favor, intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field: PurchaseFormField, formIndex: number) => {
    const fieldKey = field.name || field.id || `field-${formIndex}-${field.tag}`;
    const value = formValues[fieldKey] || field.value || '';

    switch (field.tag) {
      case 'input':
        if (field.type === 'checkbox' || field.type === 'radio') {
          return (
            <div key={fieldKey} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type={field.type}
                  name={field.name || undefined}
                  id={field.id || undefined}
                  checked={!!value}
                  onChange={(e) => handleInputChange(fieldKey, e.target.checked ? '1' : '0')}
                  required={field.required}
                />
                <span>{field.label || field.placeholder || field.name}</span>
              </label>
            </div>
          );
        }
        return (
          <div key={fieldKey} style={{ marginBottom: '1rem' }}>
            <label htmlFor={field.id || undefined} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {field.label || field.placeholder || field.name}
              {field.required && <span style={{ color: 'red' }}> *</span>}
            </label>
            <input
              type={field.type || 'text'}
              name={field.name || undefined}
              id={field.id || undefined}
              placeholder={field.placeholder || undefined}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              required={field.required}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            />
          </div>
        );

      case 'select':
        return (
          <div key={fieldKey} style={{ marginBottom: '1rem' }}>
            <label htmlFor={field.id || undefined} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {field.label || field.placeholder || field.name}
              {field.required && <span style={{ color: 'red' }}> *</span>}
            </label>
            <select
              name={field.name || undefined}
              id={field.id || undefined}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              required={field.required}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              {field.options?.map((option, idx) => (
                <option key={idx} value={option.value}>
                  {option.text}
                </option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
        return (
          <div key={fieldKey} style={{ marginBottom: '1rem' }}>
            <label htmlFor={field.id || undefined} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {field.label || field.placeholder || field.name}
              {field.required && <span style={{ color: 'red' }}> *</span>}
            </label>
            <textarea
              name={field.name || undefined}
              id={field.id || undefined}
              placeholder={field.placeholder || undefined}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              required={field.required}
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                fontFamily: 'inherit',
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (!purchaseFormData) {
    return (
      <div className="container">
        <div className="card">
          <p>Cargando formulario de compra...</p>
        </div>
      </div>
    );
  }

  if (purchaseFormData.forms.length === 0) {
    return (
      <div className="container">
        <div className="card">
          <h2>No se encontró formulario de compra</h2>
          <p>No se pudo obtener el formulario de compra. Por favor, intente de nuevo.</p>
          <button onClick={() => router.push('/results')} style={{ marginTop: '1rem' }}>
            Volver a Resultados
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>🛒 Formulario de Compra</h1>

      <div className="card">
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
              URL: <a href={purchaseFormData.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
                {purchaseFormData.url}
              </a>
            </p>
          </div>
          <button onClick={() => router.push('/results')} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
            Volver a Resultados
          </button>
        </div>

        {purchaseFormData.forms.map((form, formIndex) => (
          <form
            key={formIndex}
            onSubmit={(e) => handleSubmit(e, formIndex)}
            style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
              Formulario {formIndex + 1}
              {form.id && <span style={{ fontSize: '0.875rem', color: '#666', fontWeight: 'normal' }}> (ID: {form.id})</span>}
            </h2>

            {form.action && (
              <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
                <strong>Action:</strong> {form.action}<br />
                <strong>Method:</strong> {form.method}
              </p>
            )}

            {form.fields.map((field) => renderField(field, formIndex))}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '1rem',
                backgroundColor: loading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1.125rem',
                fontWeight: 'bold',
              }}
            >
              {loading ? 'Enviando...' : 'Enviar Formulario'}
            </button>
          </form>
        ))}

        {purchaseFormData.error && (
          <div style={{ padding: '1rem', backgroundColor: '#fee', borderRadius: '8px', marginTop: '1rem' }}>
            <p style={{ margin: 0, color: '#c00' }}>⚠️ {purchaseFormData.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

