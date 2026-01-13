/**
 * Script para ejecutar en la consola del navegador
 * 
 * INSTRUCCIONES:
 * 1. Abre https://www1.mercantilseguros.com/as/viajesint/MRP022052
 * 2. Abre las DevTools (F12)
 * 3. Ve a la pestaña "Console"
 * 4. Pega y ejecuta este script completo
 * 5. Llena el formulario y haz clic en "COTIZAR SEGURO"
 * 6. Observa los logs en la consola para ver todas las peticiones de red
 */

(function() {
  console.log('🔍 Iniciando interceptor de peticiones de red...\n');

  const requests = [];
  const responses = [];

  // Interceptar fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    console.log('📤 FETCH:', options.method || 'GET', url);
    if (options.body) {
      console.log('   Body:', typeof options.body === 'string' ? options.body.substring(0, 200) : options.body);
    }
    if (options.headers) {
      console.log('   Headers:', options.headers);
    }

    const request = {
      url: url,
      method: options.method || 'GET',
      body: options.body,
      headers: options.headers,
      timestamp: new Date().toISOString(),
    };
    requests.push(request);

    try {
      const response = await originalFetch.apply(this, args);
      
      // Clonar la respuesta para leer el body sin consumirlo
      const clonedResponse = response.clone();
      
      // Intentar leer como texto
      clonedResponse.text().then(text => {
        console.log('📥 FETCH Response:', response.status, url);
        console.log('   Content-Type:', response.headers.get('content-type'));
        console.log('   Size:', text.length, 'bytes');
        
        // Si es JSON, mostrarlo
        if (response.headers.get('content-type')?.includes('json')) {
          try {
            const json = JSON.parse(text);
            console.log('   JSON:', JSON.stringify(json, null, 2).substring(0, 500));
          } catch (e) {
            console.log('   Text (first 500 chars):', text.substring(0, 500));
          }
        } else if (text.length < 1000) {
          console.log('   Text:', text);
        } else {
          console.log('   Text (first 1000 chars):', text.substring(0, 1000));
          // Buscar indicadores de planes
          if (text.includes('item-block')) {
            console.log('   ✅ Contiene "item-block" - probablemente tiene planes!');
          }
          if (text.includes('D-30') || text.includes('D-50')) {
            console.log('   ✅ Contiene IDs de planes (D-30, D-50, etc.)');
          }
        }

        responses.push({
          url: url,
          status: response.status,
          contentType: response.headers.get('content-type'),
          body: text,
          timestamp: new Date().toISOString(),
        });
      }).catch(e => {
        console.log('   ⚠️ No se pudo leer el body:', e);
      });

      return response;
    } catch (error) {
      console.error('❌ FETCH Error:', error);
      throw error;
    }
  };

  // Interceptar XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._method = method;
    this._url = url;
    console.log('📤 XHR.open:', method, url);
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(data) {
    if (data) {
      console.log('📤 XHR.send:', this._method, this._url);
      console.log('   Data:', typeof data === 'string' ? data.substring(0, 200) : data);
    }

    this.addEventListener('load', function() {
      console.log('📥 XHR Response:', this.status, this._url);
      console.log('   Content-Type:', this.getResponseHeader('content-type'));
      
      try {
        const responseText = this.responseText;
        console.log('   Size:', responseText.length, 'bytes');
        
        if (this.getResponseHeader('content-type')?.includes('json')) {
          try {
            const json = JSON.parse(responseText);
            console.log('   JSON:', JSON.stringify(json, null, 2).substring(0, 500));
          } catch (e) {
            console.log('   Text (first 500 chars):', responseText.substring(0, 500));
          }
        } else {
          console.log('   Text (first 1000 chars):', responseText.substring(0, 1000));
        }

        responses.push({
          url: this._url,
          status: this.status,
          contentType: this.getResponseHeader('content-type'),
          body: responseText,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.log('   ⚠️ No se pudo leer la respuesta:', e);
      }
    });

    this.addEventListener('error', function() {
      console.error('❌ XHR Error:', this._url);
    });

    return originalXHRSend.apply(this, arguments);
  };

  // Función para obtener resumen
  window.getNetworkSummary = function() {
    console.log('\n📊 RESUMEN DE PETICIONES:\n');
    console.log(`Total FETCH: ${requests.filter(r => r.url).length}`);
    console.log(`Total XHR: ${responses.length}\n`);
    
    console.log('📤 PETICIONES:');
    requests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.method} ${req.url}`);
    });
    
    console.log('\n📥 RESPUESTAS:');
    responses.forEach((res, i) => {
      console.log(`${i + 1}. ${res.status} ${res.url}`);
      console.log(`   Content-Type: ${res.contentType}`);
      console.log(`   Size: ${res.body?.length || 0} bytes`);
    });

    // Buscar peticiones que parezcan ser la API de cotizaciones
    const quoteRequests = requests.filter(r => 
      r.url.includes('quotation') || 
      r.url.includes('quote') ||
      (r.method === 'POST' && r.body && r.body.includes('quotation'))
    );
    
    if (quoteRequests.length > 0) {
      console.log('\n🎯 PETICIONES RELACIONADAS CON COTIZACIONES:');
      quoteRequests.forEach((req, i) => {
        console.log(`${i + 1}. ${req.method} ${req.url}`);
        if (req.body) {
          console.log(`   Body: ${req.body.substring(0, 300)}`);
        }
      });
    }

    return { requests, responses };
  };

  // Función para exportar datos
  window.exportNetworkData = function() {
    const data = {
      requests: requests.map(r => ({
        url: r.url,
        method: r.method,
        body: typeof r.body === 'string' ? r.body : String(r.body),
        timestamp: r.timestamp,
      })),
      responses: responses.map(r => ({
        url: r.url,
        status: r.status,
        contentType: r.contentType,
        bodyLength: r.body?.length || 0,
        bodyPreview: r.body?.substring(0, 500) || '',
        timestamp: r.timestamp,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('💾 Datos exportados!');
    return data;
  };

  console.log('✅ Interceptor activado!\n');
  console.log('📝 Instrucciones:');
  console.log('   1. Llena el formulario');
  console.log('   2. Haz clic en "COTIZAR SEGURO"');
  console.log('   3. Ejecuta: getNetworkSummary()');
  console.log('   4. Para exportar: exportNetworkData()\n');
})();

