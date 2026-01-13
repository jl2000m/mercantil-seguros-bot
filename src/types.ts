export interface QuoteConfig {
  tripType: 'Viajes Por Día' | 'Anual Multiviaje';
  origin: string;
  destination: string; // Dynamic based on trip type
  departureDate: string; // Format: DD/MM/YYYY
  returnDate: string; // Format: DD/MM/YYYY
  passengers: number; // 1-8
  ages: number[]; // Array of ages, length should match passengers
  agent?: string; // Optional: specific agent ID, defaults to Risk Management Seguros
}

export interface QuotePlan {
  name: string;
  price: string;
  planId: string;
}

export interface QuoteData {
  url: string;
  contentLength: number;
  plans?: QuotePlan[];
  planCount?: number;
}

export interface QuoteResult {
  success: boolean;
  quoteData?: QuoteData;
  error?: string;
  screenshotPath?: string;
}

export interface CatalogOption {
  value: string;
  text: string;
  disabled?: boolean;
  dataFilter?: string;
}

export interface CatalogData {
  tripTypes: CatalogOption[];
  origins: CatalogOption[];
  destinations: {
    [tripType: string]: CatalogOption[]; // Key is trip type, value is available destinations
  };
  agents: CatalogOption[];
}

