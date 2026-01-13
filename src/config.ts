import { QuoteConfig } from './types';

// Default configuration - can be overridden via environment variables or function parameters
export const defaultConfig: QuoteConfig = {
  tripType: 'Viajes Por Día',
  origin: 'Panamá', // You can change this to any country
  destination: 'Europa', // Will be validated against available options for trip type
  departureDate: '13/01/2026',
  returnDate: '15/01/2026',
  passengers: 1,
  ages: [30],
  agent: '2851', // Risk Management Seguros, S.a. (rm Seguros)
};

// URL of the quotation page
export const QUOTE_URL = 'https://www1.mercantilseguros.com/as/viajesint/mrp022052';

// Selectors for form elements
export const SELECTORS = {
  tripType: '#websitebundle_quotation_search_product',
  origin: '#websitebundle_quotation_search_origin',
  destination: '#websitebundle_quotation_search_destination',
  agent: '#websitebundle_quotation_search_agent',
  dateRange: '#sliderDateRange',
  passengerCount: '#selector-passenger-count',
  submitButton: 'button[type="submit"]',
  ageInput: (index: number) => `#passengers-age\\[${index}\\]`,
} as const;

