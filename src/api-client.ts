import { QuoteConfig, QuoteResult, QuotePlan } from './types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Direct API client to call Mercantil Seguros API without browser automation
 * This is much faster than using Playwright - bypasses all UI loading
 */
export class MercantilSegurosAPIClient {
  private baseUrl = 'https://www1.mercantilseguros.com';
  private catalog: any = null;

  /**
   * Generate quote by directly calling the API
   * This mimics the form submission exactly
   */
  async generateQuote(config: QuoteConfig): Promise<QuoteResult> {
    try {
      console.log('📋 Generando cotización mediante llamada directa a la API...');

      // Load catalog once
      if (!this.catalog) {
        this.catalog = await this.loadCatalog();
      }

      // Get IDs from catalog
      const originId = this.getOriginId(config.origin);
      const destinationId = this.getDestinationId(config.destination, config.tripType);
      const tripTypeValue = this.getTripTypeValue(config.tripType);

      console.log('🔍 IDs obtenidos:');
      console.log(`   Origen: ${config.origin} -> ${originId}`);
      console.log(`   Destino: ${config.destination} -> ${destinationId}`);
      console.log(`   Tipo de viaje: ${config.tripType} -> ${tripTypeValue}`);

      // Convert dates from DD/MM/YYYY to YYYY-MM-DD
      const departureDate = this.convertDateToAPIFormat(config.departureDate);
      const returnDate = this.convertDateToAPIFormat(config.returnDate);
      
      console.log(`   Fechas: ${config.departureDate} -> ${departureDate}, ${config.returnDate} -> ${returnDate}`);

      // Construct form data exactly as the website does
      // Based on the XHR request we intercepted: websitebundle_quotation_search[field]
      const formData = new URLSearchParams();
      formData.append('websitebundle_quotation_search[uuid]', ''); // Empty UUID as seen in browser
      formData.append('websitebundle_quotation_search[product]', tripTypeValue);
      formData.append('websitebundle_quotation_search[origin]', originId);
      formData.append('websitebundle_quotation_search[destination]', destinationId);
      formData.append('websitebundle_quotation_search[agent]', config.agent || '2851');
      formData.append('websitebundle_quotation_search[date_from]', departureDate);
      formData.append('websitebundle_quotation_search[date_to]', returnDate);
      formData.append('selector-passenger-count', config.passengers.toString());

      // Add passenger ages - format: passengers-age[0], passengers-age[1], etc.
      config.ages.forEach((age, index) => {
        formData.append(`passengers-age[${index}]`, age.toString());
      });

      console.log('📋 Datos del formulario:', formData.toString());

      console.log('📤 Enviando petición POST al endpoint AJAX...');

      // First, get the initial page to establish session/cookies
      const initialResponse = await fetch(`${this.baseUrl}/as/viajesint/MRP022052`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });

      // Extract cookies from initial response
      // Node.js fetch returns Set-Cookie as a single header with comma-separated values
      const setCookieHeader = initialResponse.headers.get('set-cookie') || '';
      // Parse cookies - each cookie is separated by comma, but we need to be careful
      // because cookie values can contain commas
      const cookies = setCookieHeader;
      
      console.log(`🍪 Cookies recibidas: ${cookies ? 'Sí' : 'No'}`);
      if (cookies && cookies.length > 0) {
        console.log(`   Cookie length: ${cookies.length} chars`);
      }

      // Use the AJAX endpoint that returns JSON with HTML
      // This is much faster than submitting the form and waiting for page load
      // Note: We need to preserve cookies properly - use a cookie jar approach
      const cookieHeader = initialResponse.headers.get('set-cookie');
      const allCookies = cookieHeader ? cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ') : '';
      
      const response = await fetch(`${this.baseUrl}/as/viajesint/MRP022052/quotation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${this.baseUrl}/as/viajesint/MRP022052`,
          'Origin': this.baseUrl,
          'Cookie': allCookies,
        },
        body: formData.toString(),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`La llamada a la API falló: ${response.status} ${response.statusText}`);
      }

      // The endpoint returns JSON with the HTML inside
      const jsonResponse = await response.json();
      console.log(`✅ Respuesta JSON recibida`);
      
      if (!jsonResponse.html) {
        throw new Error('La respuesta no contiene HTML');
      }

      const html = jsonResponse.html;
      const resultUrl = jsonResponse.url || response.url;
      
      console.log(`📄 HTML recibido: ${html.length} bytes`);
      console.log(`📄 URL de resultado: ${resultUrl}`);
      
      // Debug: Check HTML content
      const hasItemBlock = html.includes('item-block');
      const hasSelectPlan = html.includes('Seleccione el plan');
      const hasFormD30 = html.includes('id="D-30"') || html.includes('id=\\"D-30\\"');
      const hasFormD50 = html.includes('id="D-50"') || html.includes('id=\\"D-50\\"');
      
      console.log(`📄 Debug HTML:`);
      console.log(`   - Tiene 'item-block': ${hasItemBlock}`);
      console.log(`   - Tiene 'Seleccione el plan': ${hasSelectPlan}`);
      console.log(`   - Tiene form D-30: ${hasFormD30}`);
      console.log(`   - Tiene form D-50: ${hasFormD50}`);
      
      // Parse the HTML to extract quote plans
      const plans = this.parseQuotePlans(html);

      if (plans.length === 0) {
        console.warn('⚠️ No se encontraron planes en la respuesta.');
        
        // Debug: Save HTML for inspection
        try {
          const debugDir = path.join(process.cwd(), 'debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          const debugPath = path.join(debugDir, `api-response-${Date.now()}.html`);
          fs.writeFileSync(debugPath, html, 'utf-8');
          console.log(`💾 HTML guardado para depuración: ${debugPath}`);
          
          // Also save a snippet showing what we're looking for
          const snippetPath = path.join(debugDir, `api-snippet-${Date.now()}.txt`);
          const snippet = html.substring(0, 5000) + '\n\n...\n\n' + html.substring(html.length - 5000);
          fs.writeFileSync(snippetPath, snippet, 'utf-8');
          console.log(`💾 Fragmento guardado: ${snippetPath}`);
        } catch (e) {
          console.warn('⚠️ No se pudo guardar HTML para depuración:', e);
        }
      } else {
        console.log(`✅ Se encontraron ${plans.length} planes`);
      }

      return {
        success: true,
        quoteData: {
          url: resultUrl,
          contentLength: html.length,
          plans: plans,
          planCount: plans.length,
        },
      };
    } catch (error) {
      console.error('❌ Error llamando a la API directamente:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private convertDateToAPIFormat(dateStr: string): string {
    // Convert from DD/MM/YYYY to YYYY-MM-DD
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }

  private getTripTypeValue(tripType: string): string {
    if (!this.catalog) {
      throw new Error('Catálogo no cargado');
    }
    // Find trip type in catalog - tripType can be the text or the value
    const tripTypeObj = this.catalog.tripTypes.find((t: any) => 
      t.text === tripType || 
      t.value === tripType ||
      tripType.includes(t.text) ||
      tripType.includes(t.value)
    );
    // Return the value from catalog (e.g., "Viajes Por Día" or "Viajes Anuales")
    return tripTypeObj?.value || 'Viajes Por Día';
  }

  private getOriginId(originText: string): string {
    if (!this.catalog) {
      throw new Error('Catálogo no cargado');
    }
    const origin = this.catalog.origins.find((o: any) => 
      o.text === originText || 
      o.text.includes(originText) ||
      originText.includes(o.text)
    );
    return origin?.value || '160'; // Default to Panamá
  }

  private getDestinationId(destinationText: string, tripType: string): string {
    if (!this.catalog) {
      throw new Error('Catálogo no cargado');
    }
    const tripTypeValue = this.getTripTypeValue(tripType);
    const destinations = this.catalog.destinations[tripTypeValue] || 
                         this.catalog.destinations[tripType] || 
                         [];
    const destination = destinations.find((d: any) => 
      d.text === destinationText || 
      d.text.includes(destinationText) ||
      destinationText.includes(d.text)
    );
    return destination?.value || '3'; // Default to Europa
  }

  private async loadCatalog(): Promise<any> {
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir);
    const catalogFiles = files.filter((f: string) => f.startsWith('catalog-') && f.endsWith('.json'));
    
    if (catalogFiles.length === 0) {
      throw new Error('No se encontró archivo de catálogo');
    }

    const catalogFile = catalogFiles.sort().reverse()[0];
    const catalogPath = path.join(dataDir, catalogFile);
    return JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  }

  private calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private parseQuotePlans(html: string): QuotePlan[] {
    const plans: QuotePlan[] = [];
    
    // Strategy 1: Find all forms with plan IDs (D-30, D-50, D-75, D-100)
    // These forms are inside item-block divs
    const formIdPattern = /<form[^>]*id="(D-\d+)"[^>]*name="select-plan"[^>]*>/g;
    const formIds: string[] = [];
    let match;
    
    while ((match = formIdPattern.exec(html)) !== null) {
      formIds.push(match[1]);
    }
    
    console.log(`🔍 Formularios encontrados: ${formIds.join(', ')}`);
    
    // For each form ID, find the corresponding plan card
    for (const formId of formIds) {
      try {
        // Find the item-block that contains this form
        // Look for the pattern: <div...item-block...>...<form id="D-30">...</form>...</div>
        const formStart = html.indexOf(`id="${formId}"`);
        if (formStart === -1) continue;
        
        // Look backwards for the item-block div start
        const beforeForm = html.substring(Math.max(0, formStart - 5000), formStart);
        const itemBlockStart = beforeForm.lastIndexOf('<div');
        if (itemBlockStart === -1) continue;
        
        // Look forwards for the closing label/div
        const afterForm = html.substring(formStart, Math.min(html.length, formStart + 5000));
        const itemBlockEnd = afterForm.indexOf('</label>');
        if (itemBlockEnd === -1) continue;
        
        const planHtml = html.substring(
          Math.max(0, formStart - 5000) + itemBlockStart,
          formStart + itemBlockEnd + 8
        );
        
        // Extract plan name from h3
        const nameMatch = planHtml.match(/<h3[^>]*class="[^"]*font-weight-bold[^"]*"[^>]*>([\s\S]*?)<\/h3>/);
        if (!nameMatch) {
          // Try without class requirement
          const nameMatch2 = planHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
          if (!nameMatch2) continue;
          var nameMatch = nameMatch2;
        }

        // Extract price
        const pricePatterns = [
          /<p[^>]*class="[^"]*text-color-light[^"]*opacity-7[^"]*mb-4[^"]*"[^>]*>([\s\S]*?)<\/p>/,
          /<p[^>]*class="[^"]*opacity-7[^"]*mb-4[^"]*"[^>]*>([\s\S]*?)<\/p>/,
          /<p[^>]*class="[^"]*opacity-7[^"]*"[^>]*>([\s\S]*?)<\/p>/,
          /USD\s+[\d,]+\.\d{2}/,
        ];

        let priceMatch = null;
        for (const pricePattern of pricePatterns) {
          priceMatch = planHtml.match(pricePattern);
          if (priceMatch) break;
        }
        if (!priceMatch) continue;

        // Clean up the name
        let name = nameMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<small[^>]*>([\s\S]*?)<\/small>/gi, '\n$1')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Clean up the price
        let price = priceMatch[1] || priceMatch[0];
        if (typeof price === 'string') {
          price = price.replace(/<[^>]+>/g, '').trim();
        }
        // Ensure price starts with USD
        if (price && !price.toUpperCase().includes('USD')) {
          price = `USD ${price}`;
        }

        if (name && price) {
          plans.push({
            name: name,
            price: price,
            planId: formId,
          });
          console.log(`✅ Plan encontrado: ${formId} - ${name} - ${price}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error parseando plan ${formId}:`, error);
      }
    }
    
    // If strategy 1 didn't work, try alternative patterns
    if (plans.length === 0) {
      console.log('🔄 Intentando estrategia alternativa de parsing...');
      
      // Strategy 2: Look for item-block divs with a different pattern
      const altPatterns = [
        /<div[^>]*class="[^"]*item-block[^"]*"[^>]*>([\s\S]{0,5000}?)<\/div>\s*<\/label>\s*<\/div>/g,
        /<label[^>]*for="(D-\d+)"[^>]*>([\s\S]{0,5000}?)<\/label>/g,
      ];

      for (const pattern of altPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null && plans.length < 10) {
          try {
            const planHtml = match[2] || match[1] || match[0];
            const planId = match[1] || '';

            // Extract plan name
            const nameMatch = planHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
            if (!nameMatch) continue;

            // Extract price
            const priceMatch = planHtml.match(/USD\s+[\d,]+\.\d{2}/);
            if (!priceMatch) continue;

            let name = nameMatch[1]
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<small[^>]*>([\s\S]*?)<\/small>/gi, '\n$1')
              .replace(/<[^>]+>/g, '')
              .trim();

            const price = priceMatch[0];

            if (name && price) {
              plans.push({
                name: name,
                price: price,
                planId: planId || `plan-${plans.length + 1}`,
              });
            }
          } catch (error) {
            // Continue to next match
          }
        }
      }
    }

    return plans;
  }
}

