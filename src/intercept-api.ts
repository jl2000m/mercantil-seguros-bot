import { interceptNetworkRequests } from './network-interceptor';
import { QuoteConfig } from './types';

/**
 * Script to intercept network requests and discover the actual API endpoint
 * Run with: tsx src/intercept-api.ts
 */
async function main() {
  const config: QuoteConfig = {
    tripType: 'Viajes Por Día',
    origin: 'Panamá',
    destination: 'Europa',
    departureDate: '15/01/2026',
    returnDate: '20/01/2026',
    passengers: 1,
    ages: [30],
    agent: '2851',
  };

  console.log('🔍 Interceptando peticiones de red para descubrir el endpoint de la API...\n');
  
  try {
    const requests = await interceptNetworkRequests(config);
    
    console.log('\n📊 Resumen de peticiones encontradas:');
    console.log(`Total: ${requests.length} peticiones relevantes\n`);
    
    // Look for POST requests that might be the API
    const postRequests = requests.filter(r => r.method === 'POST');
    if (postRequests.length > 0) {
      console.log('📤 Peticiones POST encontradas:');
      postRequests.forEach((req, i) => {
        console.log(`\n${i + 1}. ${req.url}`);
        if (req.postData) {
          console.log(`   Datos: ${req.postData.substring(0, 300)}...`);
        }
      });
    }
    
    // Look for requests that return JSON
    console.log('\n💡 Busca peticiones que devuelvan JSON o que contengan "quotation" en la URL');
    console.log('💡 Esas son probablemente las llamadas a la API real');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

