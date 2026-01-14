'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PurchaseFormData, PurchaseFormField, QuotePlan } from '../../src/types';

export default function PurchasePage() {
  const router = useRouter();
  const [purchaseFormData, setPurchaseFormData] = useState<PurchaseFormData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<QuotePlan | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('purchaseFormData');
    const storedPlan = sessionStorage.getItem('selectedPlan');
    
    if (stored) {
      try {
        const data = JSON.parse(stored) as PurchaseFormData;
        setPurchaseFormData(data);
        
        if (storedPlan) {
          const plan = JSON.parse(storedPlan) as QuotePlan;
          setSelectedPlan(plan);
        }
        
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

  const handleInputChange = (fieldName: string, value: string, actualFieldName?: string) => {
    // Use actualFieldName if provided (for proper form submission), otherwise use fieldName
    const key = actualFieldName || fieldName;
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
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
          let value = formValues[field.name] || field.value || '';
          
          // Handle checkboxes - if not in formValues, use empty string for unchecked
          if (field.type === 'checkbox' && !formValues[field.name]) {
            value = '';
          }
          
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
    const value = formValues[field.name || fieldKey] || field.value || '';

    // Skip hidden fields in the main display (they'll be included in form submission)
    if (field.type === 'hidden') {
      return (
        <input
          key={fieldKey}
          type="hidden"
          name={field.name || undefined}
          value={value}
        />
      );
    }

    switch (field.tag) {
      case 'input':
        if (field.type === 'checkbox' || field.type === 'radio') {
          return (
            <div key={fieldKey} style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type={field.type}
                  name={field.name || undefined}
                  id={field.id || undefined}
                  checked={!!value || (field.type === 'checkbox' && value === '1')}
                  onChange={(e) => handleInputChange(fieldKey, e.target.checked ? '1' : '0', field.name || undefined)}
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
              onChange={(e) => handleInputChange(fieldKey, e.target.value, field.name || undefined)}
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
              onChange={(e) => handleInputChange(fieldKey, e.target.value, field.name || undefined)}
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
              onChange={(e) => handleInputChange(fieldKey, e.target.value, field.name || undefined)}
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

  // Find the main purchase form (usually the first one with many fields)
  const mainForm = purchaseFormData.forms.find(form => 
    form.fields.length > 50 && form.action?.includes('/buy/step-one')
  ) || purchaseFormData.forms[0];

  // Group fields by passenger if they contain passenger data
  const groupFieldsByPassenger = (fields: PurchaseFormField[]) => {
    const groups: { [key: string]: PurchaseFormField[] } = {};
    const otherFields: PurchaseFormField[] = [];
    
    fields.forEach(field => {
      if (field.name?.includes('[breakdowns]')) {
        const match = field.name.match(/\[breakdowns\]\[(\d+)\]/);
        if (match) {
          const passengerIndex = match[1];
          if (!groups[passengerIndex]) {
            groups[passengerIndex] = [];
          }
          groups[passengerIndex].push(field);
        } else {
          otherFields.push(field);
        }
      } else if (field.name?.includes('[contact]')) {
        if (!groups['contact']) {
          groups['contact'] = [];
        }
        groups['contact'].push(field);
      } else {
        otherFields.push(field);
      }
    });
    
    return { groups, otherFields };
  };

  return (
    <div className="container">
      <h1>🛒 Formulario de Compra</h1>

      <div className="card">
        {selectedPlan && (
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '8px',
            border: '1px solid #4caf50'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{selectedPlan.name.split('\n')[0].trim()}</h3>
            <p style={{ margin: '0.25rem 0', color: '#666' }}>
              <strong>Cobertura:</strong> {selectedPlan.name.split('\n')[1]?.trim() || 'N/A'}
            </p>
            <p style={{ margin: '0.25rem 0', color: '#666' }}>
              <strong>Precio:</strong> {selectedPlan.price}
            </p>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
              Complete el formulario para proceder con la compra
            </p>
          </div>
          <button onClick={() => router.push('/results')} style={{ width: 'auto', padding: '0.75rem 1.5rem' }}>
            Volver a Resultados
          </button>
        </div>

        {mainForm && (
          <form
            onSubmit={(e) => handleSubmit(e, purchaseFormData.forms.indexOf(mainForm))}
            style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
              Información de Pasajeros y Cobertura
            </h2>

            {/* Render hidden fields first */}
            {mainForm.fields
              .filter(f => f.type === 'hidden')
              .map((field) => renderField(field, 0))}

            {/* Group and render passenger fields */}
            {(() => {
              const { groups, otherFields } = groupFieldsByPassenger(mainForm.fields.filter(f => f.type !== 'hidden'));
              
              return (
                <>
                  {/* Passenger sections */}
                  {Object.entries(groups)
                    .filter(([key]) => key !== 'contact')
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([passengerIndex, fields]) => (
                      <div key={passengerIndex} style={{ 
                        marginBottom: '2rem', 
                        padding: '1.5rem', 
                        backgroundColor: 'white', 
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
                          Pasajero {parseInt(passengerIndex) + 1}
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                          {fields.map((field) => renderField(field, 0))}
                        </div>
                      </div>
                    ))}

                  {/* Contact information */}
                  {groups['contact'] && groups['contact'].length > 0 && (
                    <div style={{ 
                      marginBottom: '2rem', 
                      padding: '1.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
                        Información de Contacto
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        {groups['contact'].map((field) => renderField(field, 0))}
                      </div>
                    </div>
                  )}

                  {/* Other fields */}
                  {otherFields.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      {otherFields.map((field) => renderField(field, 0))}
                    </div>
                  )}
                </>
              );
            })()}

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
              {loading ? 'Enviando...' : 'Continuar con la Compra'}
            </button>
          </form>
        )}

        {/* Render other forms (like email forms) */}
        {purchaseFormData.forms
          .filter(form => form !== mainForm)
          .map((form, formIndex) => (
            <form
              key={formIndex}
              onSubmit={(e) => handleSubmit(e, purchaseFormData.forms.indexOf(form))}
              style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>
                {form.action?.includes('/send') ? 'Enviar Cotización por Email' : `Formulario ${formIndex + 1}`}
              </h3>
              {form.fields.map((field) => renderField(field, formIndex))}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: loading ? '#ccc' : '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Enviando...' : 'Enviar'}
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

