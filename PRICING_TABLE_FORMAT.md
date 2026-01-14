# Pricing Table Format Specification

## Overview

This document specifies the recommended format for requesting a pricing table from Mercantil Seguros that can be integrated directly into this system without requiring bot automation.

## Current System Parameters

Based on the current implementation, pricing depends on the following parameters:

1. **Trip Type** (`product`)
   - `"Viajes Por Día"` (Daily trips)
   - `"Anual Multiviaje"` (Annual multi-trip)

2. **Origin** (`origin`)
   - Country ID (e.g., "10" for Argentina, "56" for Algeria)
   - See `data/catalog.json` for complete list

3. **Destination** (`destination`)
   - Varies by trip type
   - For "Viajes Por Día": e.g., "Europa", "Resto del Mundo"
   - For "Anual Multiviaje": e.g., "Mundial"
   - See `data/catalog.json` for complete list per trip type

4. **Date Range** (`date_from`, `date_to`)
   - Format: `YYYY-MM-DD`
   - **Important**: For "Viajes Por Día", pricing varies by date range
   - For "Anual Multiviaje", dates may be less critical but should still be included

5. **Number of Passengers** (`selector-passenger-count`)
   - Range: 1-8 passengers

6. **Passenger Ages** (`passengers-age[0]`, `passengers-age[1]`, etc.)
   - Array of ages (one per passenger)
   - Ages typically range from 0-99

7. **Agent** (`agent`)
   - Optional, defaults to "2851" (Risk Management Seguros)

## Recommended Pricing Table Format

### Option 1: JSON Format (Recommended)

This format is most compatible with the current system and easy to process programmatically.

```json
{
  "metadata": {
    "version": "1.0",
    "generatedAt": "2026-01-15T10:00:00Z",
    "validFrom": "2026-01-15",
    "validTo": "2026-12-31",
    "currency": "USD"
  },
  "pricing": [
    {
      "tripType": "Viajes Por Día",
      "tripTypeId": "1",
      "origin": {
        "id": "10",
        "name": "Argentina"
      },
      "destination": {
        "id": "5",
        "name": "Europa"
      },
      "dateRange": {
        "minDays": 1,
        "maxDays": 365,
        "dateBased": true
      },
      "passengerConfig": {
        "count": 1,
        "ages": [30]
      },
      "plans": [
        {
          "planId": "plan-basic-001",
          "name": "Plan Básico",
          "price": 25.50,
          "priceFormatted": "USD 25.50"
        },
        {
          "planId": "plan-premium-001",
          "name": "Plan Premium",
          "price": 45.75,
          "priceFormatted": "USD 45.75"
        }
      ],
      "agent": "2851"
    }
  ]
}
```

### Option 2: CSV Format (Alternative)

For easier manual review and Excel compatibility:

```csv
tripType,tripTypeId,originId,originName,destinationId,destinationName,minDays,maxDays,passengerCount,passengerAges,planId,planName,price,priceFormatted,agent
Viajes Por Día,1,10,Argentina,5,Europa,1,7,1,"[30]",plan-basic-001,Plan Básico,25.50,USD 25.50,2851
Viajes Por Día,1,10,Argentina,5,Europa,1,7,1,"[30]",plan-premium-001,Plan Premium,45.75,USD 45.75,2851
Viajes Por Día,1,10,Argentina,5,Europa,8,14,1,"[30]",plan-basic-001,Plan Básico,35.00,USD 35.00,2851
Viajes Por Día,1,10,Argentina,5,Europa,8,14,1,"[30]",plan-premium-001,Plan Premium,60.25,USD 60.25,2851
Anual Multiviaje,2,10,Argentina,10,Mundial,365,365,1,"[30]",plan-basic-001,Plan Básico,150.00,USD 150.00,2851
```

### Option 3: Flat JSON Array (Simplest)

A simplified flat structure:

```json
[
  {
    "tripType": "Viajes Por Día",
    "originId": "10",
    "destinationId": "5",
    "days": 7,
    "passengers": 1,
    "ages": [30],
    "plans": [
      {"planId": "plan-basic-001", "name": "Plan Básico", "price": 25.50},
      {"planId": "plan-premium-001", "name": "Plan Premium", "price": 45.75}
    ]
  }
]
```

## Key Considerations

### 1. Date Range Handling

For **"Viajes Por Día"**, pricing typically varies by:
- **Trip duration** (number of days)
- **Seasonality** (high/low season dates)
- **Specific date ranges** (holidays, special periods)

**Recommendation**: Provide pricing for common duration ranges:
- 1-7 days
- 8-14 days
- 15-21 days
- 22-30 days
- 31+ days

And specify if there are seasonal multipliers or specific date-based pricing.

For **"Anual Multiviaje"**, dates are less critical but should still be included for consistency.

### 2. Passenger Age Combinations

Pricing may vary based on:
- **Number of passengers** (1-8)
- **Age combinations** (adults vs. children, senior discounts)

**Recommendation**: Provide pricing for common scenarios:
- Single passenger (various ages: 18, 30, 50, 70)
- Two passengers (adult + adult, adult + child)
- Family groups (2 adults + 1-3 children)
- Large groups (4-8 passengers)

### 3. Coverage Completeness

The pricing table should cover:
- All available **trip types**
- All **origin countries** (or at least the most common ones)
- All **destination options** per trip type
- All available **insurance plans**
- Common **date ranges** and **passenger configurations**

### 4. Plan Identification

Each plan should include:
- **planId**: Unique identifier (matches form ID from website)
- **name**: Human-readable plan name
- **price**: Numeric price value
- **priceFormatted**: Formatted string (e.g., "USD 25.50")

## Integration Requirements

### What the System Needs

1. **Lookup Function**: Ability to query pricing by:
   - Trip type + Origin + Destination + Date range + Passenger config

2. **Fallback Logic**: If exact match not found:
   - Try closest date range
   - Try similar age groups
   - Try default agent if specific agent not found

3. **Cache Management**: 
   - Store pricing table in memory or database
   - Handle updates/refreshes
   - Version control for pricing changes

### Sample Integration Code Structure

```typescript
interface PricingTable {
  metadata: {
    version: string;
    validFrom: string;
    validTo: string;
  };
  pricing: PricingEntry[];
}

interface PricingEntry {
  tripType: string;
  originId: string;
  destinationId: string;
  dateRange: { minDays: number; maxDays: number };
  passengerConfig: { count: number; ages: number[] };
  plans: Array<{ planId: string; name: string; price: number }>;
}

class PricingService {
  private pricingTable: PricingTable;
  
  async loadPricingTable(filePath: string) {
    // Load JSON/CSV pricing table
  }
  
  findPrice(config: QuoteConfig): QuotePlan[] {
    // Match config to pricing table entry
    // Return matching plans with prices
  }
}
```

## Questions to Ask the Insurance Company

1. **Format Preference**: Do they have an existing pricing table format, or can they provide data in one of the formats above?

2. **Update Frequency**: How often does pricing change? (daily, weekly, monthly, seasonally?)

3. **Coverage Scope**: 
   - Can they provide pricing for all combinations, or should we request specific subsets?
   - Are there any combinations that are not available?

4. **Date-Based Pricing**: 
   - For "Viajes Por Día", is pricing based on trip duration, specific dates, or both?
   - Are there seasonal multipliers or special date ranges?

5. **Age-Based Pricing**: 
   - How does pricing vary by passenger age?
   - Are there age brackets (e.g., 0-17, 18-64, 65+) or individual age pricing?

6. **Plan Availability**: 
   - Are all plans available for all combinations?
   - Are there restrictions based on trip type, destination, or other factors?

7. **API vs. File**: 
   - Can they provide a live API endpoint for pricing queries?
   - Or do they prefer providing periodic file exports?

8. **Agent-Specific Pricing**: 
   - Does pricing vary by agent?
   - Should we request pricing for specific agents or use default?

## Recommended Request Template

**Subject**: Request for Pricing Table Data - Integration Format

**Body**:

Dear [Insurance Company],

We are integrating your travel insurance pricing into our system and would like to request a pricing table in a format that allows us to programmatically query prices without using web automation.

**Required Parameters:**
- Trip Type (Viajes Por Día / Anual Multiviaje)
- Origin Country
- Destination
- Date Range / Trip Duration
- Number of Passengers (1-8)
- Passenger Ages
- Insurance Plan Options

**Preferred Format:**
[JSON format as specified above - Option 1]

**Questions:**
1. What format can you provide the pricing data in?
2. How often is pricing updated?
3. Do you have an API endpoint, or will you provide file exports?
4. Are there any limitations on the combinations we can request?

Please let us know the best way to proceed.

Thank you,
[Your Name]

---

## Next Steps

1. **Review this document** with your team
2. **Customize the format** based on insurance company capabilities
3. **Request sample data** from insurance company in preferred format
4. **Build integration layer** to load and query pricing table
5. **Implement fallback logic** for missing combinations
6. **Set up update mechanism** for pricing table refreshes
