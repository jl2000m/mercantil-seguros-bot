'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PurchaseFormData, PurchaseFormField, QuotePlan } from '../../src/types';

/**
 * Clean label text by removing programmatic patterns and formatting
 */
const cleanLabel = (text: string): string => {
  let cleaned = text.replace(/\[.*?\]/g, '').trim(); // Remove brackets and their content
  cleaned = cleaned.replace(/website_quotation/gi, '').trim(); // Remove "website_quotation"
  cleaned = cleaned.replace(/quotes\d+/g, '').trim(); // Remove "quotes0", "quotes1", etc.
  cleaned = cleaned.replace(/breakdowns\d+/g, '').trim(); // Remove "breakdowns0", "breakdowns1", etc.
  cleaned = cleaned.replace(/riders\d+/g, '').trim(); // Remove "riders0", "riders1", etc.
  cleaned = cleaned.replace(/passenger/g, '').trim(); // Remove "passenger"
  cleaned = cleaned.replace(/contact/g, '').trim(); // Remove "contact"
  cleaned = cleaned.replace(/_/g, ' ').trim(); // Replace underscores with spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim(); // Replace multiple spaces with single space
  cleaned = cleaned.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); // Capitalize each word
  return cleaned;
};

/**
 * Map field names to user-friendly Spanish labels
 */
const fieldNameMapping: { [key: string]: string } = {
  'first_name': 'Nombre',
  'last_name': 'Apellido',
  'nombre': 'Nombre',
  'apellido': 'Apellido',
  'gender': 'Género',
  'genero': 'Género',
  'country': 'País',
  'pais': 'País',
  'email': 'Email',
  'phone_country': 'Código País',
  'phone_number': 'Teléfono',
  'telefono': 'Teléfono',
  'codigo': 'Código País',
  'medical_condition': 'Condiciones Médicas',
  'condiciones': 'Condiciones Médicas',
  'medicas': 'Condiciones Médicas',
  'birthday_day': 'Día de Nacimiento',
  'birthday_month': 'Mes de Nacimiento',
  'birthday_year': 'Año de Nacimiento',
  'fecha': 'Fecha de Nacimiento',
  'nacimiento': 'Fecha de Nacimiento',
  'age': 'Edad',
  'edad': 'Edad',
  'identification_type': 'Tipo de Identificación',
  'identification_number': 'Número de Identificación',
  'identificacion': 'Tipo de Identificación',
  'numero': 'Número',
  'premium': 'Prima Total a Pagar',
  'prima': 'Prima Total a Pagar',
  'agent_fullname': 'Agente/Agencia',
  'agente': 'Agente/Agencia',
  'contacto': 'Contacto de Emergencia',
  'emergencia': 'Contacto de Emergencia',
};

/**
 * Get a user-friendly label for a field
 */
const getFieldLabel = (field: PurchaseFormField): string => {
  // If we already have a clean label, use it
  if (field.label && field.label.trim() && !field.label.includes('[') && !field.label.includes('website_quotation')) {
    const cleaned = cleanLabel(field.label);
    if (cleaned && cleaned.length > 0 && cleaned.length < 50) {
      return cleaned;
    }
  }

  // Try placeholder
  if (field.placeholder && field.placeholder.trim()) {
    return field.placeholder;
  }

  // Try to extract from field name
  if (field.name) {
    const nameLower = field.name.toLowerCase();
    
    // Check exact matches first
    for (const [key, value] of Object.entries(fieldNameMapping)) {
      if (nameLower === key || nameLower.includes(key)) {
        return value;
      }
    }

    // Try to extract meaningful parts from complex field names
    // e.g., "website_quotation[quotes][0][breakdowns][0][passenger][first_name]" -> "Nombre"
    const nameParts = nameLower.split(/[\[\]_]/).filter(part => part.length > 0);
    for (const part of nameParts) {
      if (fieldNameMapping[part]) {
        return fieldNameMapping[part];
      }
    }

    // Last resort: clean the field name itself
    return cleanLabel(field.name);
  }

  // Final fallback
  return field.id || 'Campo';
};

// Searchable Select Component for long lists
function SearchableSelect({ 
  field, 
  fieldKey, 
  value, 
  displayLabel, 
  required, 
  onChange 
}: { 
  field: PurchaseFormField; 
  fieldKey: string; 
  value: string; 
  displayLabel: string; 
  required: boolean; 
  onChange: (value: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = field.options?.filter(option =>
    option.text.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const selectedOption = field.options?.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div key={fieldKey} style={{ marginBottom: '1rem', position: 'relative' }} ref={dropdownRef}>
      <label htmlFor={field.id || undefined} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
        {displayLabel}
        {required && <span style={{ color: 'red' }}> *</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="hidden"
          name={field.name || undefined}
          value={value}
        />
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: value ? '#333' : '#999' }}>
            {selectedOption?.text || 'Seleccione...'}
          </span>
          <span style={{ fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            marginTop: '0.25rem',
            maxHeight: '300px',
            overflow: 'hidden',
            zIndex: 1000,
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: 'none',
                borderBottom: '1px solid #ddd',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      backgroundColor: option.value === value ? '#e3f2fd' : 'white',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                    onMouseEnter={(e) => {
                      if (option.value !== value) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (option.value !== value) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    {option.text}
                  </div>
                ))
              ) : (
                <div style={{ padding: '0.75rem', color: '#999', textAlign: 'center' }}>
                  No se encontraron resultados
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PurchasePage() {
  const router = useRouter();
  const [purchaseFormData, setPurchaseFormData] = useState<PurchaseFormData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<QuotePlan | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [basePremium, setBasePremium] = useState<number>(0);

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
        let foundBasePremium = 0;
        
        data.forms.forEach((form) => {
          form.fields.forEach((field) => {
            if (field.name) {
              // For checkboxes, only initialize if they're explicitly checked (have a value)
              // For other fields, use the field value
              if (field.type === 'checkbox') {
                // Checkboxes start unchecked unless they have a checked value
                // For rider checkboxes, don't initialize them - they should start unchecked
                if (field.name.includes('[riders]')) {
                  // Rider checkboxes start unchecked - don't set initial value
                  // They'll be checked when user clicks them
                } else if (field.value) {
                  // Other checkboxes can have initial values
                  initialValues[field.name] = field.value;
                }
              } else if (field.value) {
                // Non-checkbox fields: use the field value
              initialValues[field.name] = field.value;
                
                // Extract base premium from premium field
                if ((field.name.toLowerCase().includes('premium') || field.name.toLowerCase().includes('prima')) && 
                    !field.name.includes('[calculate_premium]')) {
                  const premiumValue = parseFloat(field.value.replace(/[^0-9.]/g, ''));
                  if (!isNaN(premiumValue) && premiumValue > 0) {
                    foundBasePremium = premiumValue;
                  }
                }
              }
            }
          });
        });
        
        setFormValues(initialValues);
        setBasePremium(foundBasePremium);
      } catch (error) {
        console.error('Error al parsear datos del formulario:', error);
        router.push('/results');
      }
    } else {
      router.push('/results');
    }
  }, [router]);

  // Calculate total premium based on base premium and selected riders
  const calculateTotalPremium = (currentFormValues: Record<string, string>): number => {
    if (!purchaseFormData || !mainForm) return basePremium;
    
    let total = basePremium;
    
    // Find all rider checkboxes and sum their premiums if selected
    mainForm.fields.forEach((field) => {
      if (field.type === 'checkbox' && 
          field.name?.includes('[riders]') && 
          field.dataPremium) {
        // Use field.id as the key (unique per checkbox) for state tracking
        const stateKey = field.id || field.name || '';
        // Checkbox is checked if form value equals the checkbox's value attribute (rider ID)
        const currentValue = currentFormValues[stateKey];
        const isChecked = currentValue === field.value && currentValue !== undefined && currentValue !== '';
        
        if (isChecked) {
          const riderPremium = parseFloat(field.dataPremium);
          if (!isNaN(riderPremium) && riderPremium > 0) {
            total += riderPremium;
          }
        }
      }
    });
    
    return total;
  };

  const handleInputChange = (fieldName: string, value: string, actualFieldName?: string) => {
    // Use actualFieldName if provided (for proper form submission), otherwise use fieldName
    const key = actualFieldName || fieldName;
    const newFormValues = {
      ...formValues,
    };
    
    // For checkboxes, if unchecked (empty value), remove the key instead of setting it to empty string
    if (value === '') {
      delete newFormValues[key];
    } else {
      newFormValues[key] = value;
    }
    
    setFormValues(newFormValues);
    
    // Update premium if a rider checkbox changed
    if (purchaseFormData && mainForm) {
      const field = mainForm.fields.find(f => (f.name || f.id) === key);
      if (field && field.type === 'checkbox' && field.name?.includes('[riders]')) {
        const totalPremium = calculateTotalPremium(newFormValues);
        
        // Find premium field and update it
        const premiumField = mainForm.fields.find(f => 
          (f.name?.toLowerCase().includes('premium') || f.name?.toLowerCase().includes('prima')) &&
          !f.name?.includes('[calculate_premium]')
        );
        
        if (premiumField && premiumField.name) {
          // Format as currency (US$ X.XX)
          const formattedPremium = `US$ ${totalPremium.toFixed(2)}`;
          setFormValues(prev => ({
      ...prev,
            [premiumField.name!]: formattedPremium,
    }));
        }
      }
    }
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

  const renderField = (field: PurchaseFormField, formIndex: number, fieldIndex?: number) => {
    // Create a unique key by combining name/id with index to handle duplicates
    const baseKey = field.name || field.id || `field-${formIndex}-${field.tag}`;
    const fieldKey = fieldIndex !== undefined ? `${baseKey}-${fieldIndex}` : baseKey;
    const value = formValues[field.name || baseKey] || field.value || '';

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
    
    // Skip fields that are clearly internal/not user-facing
    if (
      (field.name && (
        field.name.includes('[id]') || 
        field.name.includes('[uuid]') || 
        field.name.includes('[factor_wlc]') || 
        field.name.includes('[factor_main]') || 
        field.name.includes('[calculate_premium]') || 
        field.name.includes('[free_passenger]') || 
        field.name.includes('[plan][id]') || 
        field.name.includes('[data_taxes]')
      )) ||
      (field.type === 'hidden') ||
      // Don't filter out rider checkboxes - they're the optional benefits
      (field.name && field.name.includes('website_quotation[quotes][0][breakdowns][0][riders]') && !field.label && field.type !== 'checkbox')
    ) {
      return null;
    }

    // Get user-friendly label
    const displayLabel = getFieldLabel(field);

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
                <span>{displayLabel}</span>
              </label>
            </div>
          );
        }
        // Check if this is a premium field (should be read-only)
        const isPremiumField = field.name?.toLowerCase().includes('premium') || 
                               field.name?.toLowerCase().includes('prima') ||
                               displayLabel.toLowerCase().includes('prima');
        
        return (
          <div key={fieldKey} style={{ marginBottom: '1rem' }}>
            <label htmlFor={field.id || undefined} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {displayLabel}
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
              readOnly={isPremiumField}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                backgroundColor: isPremiumField ? '#f5f5f5' : 'white',
                cursor: isPremiumField ? 'not-allowed' : 'text',
              }}
            />
          </div>
        );

      case 'select':
        // Check if this is a long list that needs search (country code, country, etc.)
        const isLongList = (field.options?.length || 0) > 10;
        const needsSearch = isLongList && (
          displayLabel.toLowerCase().includes('código') ||
          displayLabel.toLowerCase().includes('país') ||
          displayLabel.toLowerCase().includes('country')
        );
        
        if (needsSearch) {
          return <SearchableSelect
            key={fieldKey}
            field={field}
            fieldKey={fieldKey}
            value={value}
            displayLabel={displayLabel}
            required={field.required}
            onChange={(newValue) => handleInputChange(fieldKey, newValue, field.name || undefined)}
          />;
        }
        
        return (
          <div key={fieldKey} style={{ marginBottom: '1rem' }}>
            <label htmlFor={field.id || undefined} style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              {displayLabel}
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
                backgroundColor: 'white',
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
              {displayLabel}
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

  // Find the main purchase form (step-two is the actual purchase form with proper labels)
  // Prioritize step-two, then step-one matching the selected plan
  const mainForm = (() => {
    // First, try to find step-two matching the selected plan
    if (selectedPlan?.planId) {
      const stepTwoForPlan = purchaseFormData.forms.find(form => 
        form.action?.includes('/buy/step-two') && 
        form.action?.includes(`/${selectedPlan.planId}/`)
      );
      if (stepTwoForPlan) return stepTwoForPlan;
    }
    
    // Then try any step-two form (usually there's only one)
    const anyStepTwo = purchaseFormData.forms.find(form => 
      form.action?.includes('/buy/step-two')
    );
    if (anyStepTwo) return anyStepTwo;
    
    // Fallback to step-one matching the plan
    if (selectedPlan?.planId) {
      const stepOneForPlan = purchaseFormData.forms.find(form => 
        form.action?.includes('/buy/step-one') && 
        form.action?.includes(`/${selectedPlan.planId}/`)
      );
      if (stepOneForPlan) return stepOneForPlan;
    }
    
    // Last resort: any step-one or largest form
    return purchaseFormData.forms.find(form => 
      form.action?.includes('/buy/step-one')
    ) || purchaseFormData.forms.find(form => 
      form.fields.length > 50
  ) || purchaseFormData.forms[0];
  })();

  // Filter out internal fields that shouldn't be displayed
  const shouldDisplayField = (field: PurchaseFormField): boolean => {
    // Don't show hidden fields (they're rendered separately)
    if (field.type === 'hidden') {
      return false;
    }
    
    // Filter out rider text inputs (they're internal IDs, not user inputs)
    // But keep rider checkboxes (they're the optional benefits/add-ons)
    if (field.name?.includes('[riders][') && field.type === 'text') {
      return false;
    }
    
    // Show rider checkboxes (they have labels and are user-selectable benefits)
    if (field.type === 'checkbox' && field.name?.includes('[riders]') && field.label) {
      return true;
    }
    
    // Filter out other internal fields
    if (field.name && (
      field.name.includes('[factor_wlc]') ||
      field.name.includes('[factor_main]') ||
      field.name.includes('[plan][id]') ||
      field.name.includes('[data_taxes]') ||
      field.name.includes('[calculate_premium]') ||
      field.name.includes('[free_passenger]')
    )) {
      return false;
    }
    
    // Hide auto-filled fields that users don't input:
    // - Plan selection (already selected)
    // - Agent/Agency (auto-filled)
    // - Premium (calculated, shown as read-only)
    // - Email send forms
    if (field.name && (
      field.name.includes('[plan]') && !field.name.includes('[plan][id]') ||
      field.name.includes('[agent]') ||
      field.name.includes('agent_fullname') ||
      (field.name === 'email' && field.label?.toLowerCase().includes('enviar'))
    )) {
      return false;
    }
    
    // Only show fields that have a label OR are required (user needs to fill them)
    // But skip if it's clearly an internal field even if it has a label
    if (!field.label && !field.required) {
      return false;
    }
    
    return true;
  };

  // Group fields by passenger if they contain passenger data
  const groupFieldsByPassenger = (fields: PurchaseFormField[]) => {
    const groups: { [key: string]: PurchaseFormField[] } = {};
    const otherFields: PurchaseFormField[] = [];
    
    // Filter fields first
    const displayableFields = fields.filter(shouldDisplayField);
    
    displayableFields.forEach(field => {
      if (field.name?.includes('[breakdowns]')) {
        const match = field.name.match(/\[breakdowns\]\[(\d+)\]/);
        if (match) {
          const passengerIndex = match[1];
          // Convert breakdown index to passenger number (breakdown 0 = passenger 1)
          const passengerNumber = parseInt(passengerIndex) + 1;
          const passengerKey = `passenger-${passengerNumber}`;
          if (!groups[passengerKey]) {
            groups[passengerKey] = [];
          }
          groups[passengerKey].push(field);
        } else {
          otherFields.push(field);
        }
      } else if (field.name?.includes('[contact]')) {
        if (!groups['contact']) {
          groups['contact'] = [];
        }
        groups['contact'].push(field);
      } else if (field.type === 'checkbox' && field.name?.includes('[riders]')) {
        // Group rider checkboxes (optional benefits) separately
        if (!groups['beneficios']) {
          groups['beneficios'] = [];
        }
        groups['beneficios'].push(field);
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
            <h2 style={{ 
              marginTop: 0, 
              marginBottom: '2rem', 
              color: '#333',
              fontSize: '1.5rem',
              fontWeight: '600',
              paddingBottom: '1rem',
              borderBottom: '3px solid #667eea'
            }}>
              📋 Información de Pasajeros y Cobertura
            </h2>

            {/* Render hidden fields first */}
            {mainForm.fields
              .filter(f => f.type === 'hidden')
              .map((field, index) => {
                const fieldKey = field.name || field.id || `hidden-field-${index}`;
                return (
                  <input
                    key={`${fieldKey}-${index}`}
                    type="hidden"
                    name={field.name || undefined}
                    value={formValues[field.name || fieldKey] || field.value || ''}
                  />
                );
              })}

            {/* Group and render passenger fields */}
            {(() => {
              const { groups, otherFields } = groupFieldsByPassenger(mainForm.fields.filter(f => f.type !== 'hidden'));
              
              return (
                <>
                  {/* Passenger sections */}
                  {Object.entries(groups)
                    .filter(([key]) => key !== 'contact' && key !== 'beneficios' && key.startsWith('passenger-'))
                    .sort(([a], [b]) => {
                      const numA = parseInt(a.replace('passenger-', ''));
                      const numB = parseInt(b.replace('passenger-', ''));
                      return numA - numB;
                    })
                    .map(([passengerKey, fields]) => {
                      const passengerNumber = parseInt(passengerKey.replace('passenger-', ''));
                      return (
                      <div key={passengerKey} style={{ 
                        marginBottom: '2rem', 
                        padding: '1.5rem', 
                        backgroundColor: 'white', 
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0'
                      }}>
                        <h3 style={{ 
                          marginTop: 0, 
                          marginBottom: '1.5rem', 
                          color: '#333',
                          fontSize: '1.25rem',
                          fontWeight: '600',
                          paddingBottom: '0.75rem',
                          borderBottom: '2px solid #e0e0e0'
                        }}>
                          👤 Pasajero {passengerNumber}
                        </h3>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                          gap: '1.25rem' 
                        }}>
                          {fields.map((field, fieldIndex) => {
                            const rendered = renderField(field, 0, fieldIndex);
                            return rendered;
                          }).filter(Boolean)}
                        </div>
                      </div>
                      );
                    })}

                  {/* Optional Benefits (Beneficios Opcionales) */}
                  {groups['beneficios'] && groups['beneficios'].length > 0 && (
                    <div style={{ 
                      marginBottom: '2rem', 
                      padding: '1.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <h3 style={{ 
                        marginTop: 0, 
                        marginBottom: '1.5rem', 
                        color: '#333',
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        paddingBottom: '0.75rem',
                        borderBottom: '2px solid #e0e0e0'
                      }}>
                        ⭐ Beneficios Opcionales
                      </h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                        gap: '1rem' 
                      }}>
                        {groups['beneficios'].map((field, fieldIndex) => {
                          // Use field.id as the key for React state (unique per checkbox)
                          // But use field.name for form submission (multiple checkboxes can have same name)
                          const stateKey = field.id || field.name || `beneficio-${fieldIndex}`;
                          // For checkboxes, check if the form value matches the checkbox value
                          // The checkbox value is the rider ID (field.value), and when checked, formValues[stateKey] should equal that
                          const currentValue = formValues[stateKey];
                          // Checkbox is checked if form value equals the checkbox's value attribute (rider ID)
                          const isChecked = currentValue === field.value && currentValue !== undefined && currentValue !== '';
                          const premium = field.dataPremium ? parseFloat(field.dataPremium) : 0;
                          const displayLabel = getFieldLabel(field);
                          
                          return (
                            <div key={`${stateKey}-${field.value || fieldIndex}`} style={{
                              padding: '1rem',
                              border: '1px solid #e0e0e0',
                              borderRadius: '8px',
                              backgroundColor: isChecked ? '#f0f8ff' : 'white',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem'
                            }}>
                              <label style={{ 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '0.75rem', 
                                cursor: 'pointer',
                                marginBottom: '0.5rem'
                              }}>
                                <input
                                  type="checkbox"
                                  name={field.name || undefined}
                                  id={field.id || undefined}
                                  value={field.value || ''}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    // When checked, set value to the rider ID (field.value)
                                    // When unchecked, remove from formValues
                                    // Use stateKey for React state, but field.name for form submission
                                    const newValue = e.target.checked ? (field.value || '1') : '';
                                    handleInputChange(stateKey, newValue, field.name || undefined);
                                  }}
                                  required={field.required}
                                  style={{ marginTop: '0.25rem' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                    {displayLabel}
                                  </div>
                                  {premium > 0 && (
                                    <div style={{ fontSize: '0.875rem', color: '#666', fontWeight: '600' }}>
                                      Prima: US$ {premium.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Contact information */}
                  {groups['contact'] && groups['contact'].length > 0 && (
                    <div style={{ 
                      marginBottom: '2rem', 
                      padding: '1.5rem', 
                      backgroundColor: 'white', 
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}>
                      <h3 style={{ 
                        marginTop: 0, 
                        marginBottom: '1.5rem', 
                        color: '#333',
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        paddingBottom: '0.75rem',
                        borderBottom: '2px solid #e0e0e0'
                      }}>
                        🚨 Contacto de Emergencia
                      </h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                        gap: '1.25rem' 
                      }}>
                        {groups['contact'].map((field, fieldIndex) => renderField(field, 0, fieldIndex))}
                      </div>
                    </div>
                  )}

                  {/* Other fields */}
                  {otherFields.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      {otherFields.map((field, fieldIndex) => renderField(field, 0, fieldIndex))}
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

        {/* Email forms are hidden - user doesn't want them */}

        {purchaseFormData.error && (
          <div style={{ padding: '1rem', backgroundColor: '#fee', borderRadius: '8px', marginTop: '1rem' }}>
            <p style={{ margin: 0, color: '#c00' }}>⚠️ {purchaseFormData.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

