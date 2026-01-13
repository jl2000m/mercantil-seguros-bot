import { MercantilSegurosBot } from '../src/index';
import { QuoteConfig } from '../src/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script to automatically generate a quote, click COMPRAR, and scrape the purchase form
 */
async function scrapePurchaseForm() {
  const bot = new MercantilSegurosBot();
  
  try {
    console.log('🚀 Iniciando script automatizado para capturar formulario de compra...\n');
    
    await bot.initialize();
    
    // Generate a quote first
    const quoteConfig: QuoteConfig = {
      tripType: 'Anual Multiviaje',
      origin: 'Albania',
      destination: 'Mundial',
      departureDate: '28/01/2026',
      returnDate: '27/01/2027',
      passengers: 5,
      ages: [35, 32, 28, 25, 22],
      agent: '2851',
    };
    
    console.log('📋 Generando cotización...');
    console.log('   Configuración:', JSON.stringify(quoteConfig, null, 2));
    
    const quoteResult = await bot.generateQuote(quoteConfig);
    
    if (!quoteResult.success || !quoteResult.quoteData) {
      throw new Error(quoteResult.error || 'Error al generar cotización');
    }
    
    console.log('\n✅ Cotización generada exitosamente!');
    console.log(`   Planes encontrados: ${quoteResult.quoteData.plans?.length || 0}`);
    
    if (quoteResult.quoteData.plans && quoteResult.quoteData.plans.length > 0) {
      quoteResult.quoteData.plans.forEach((plan, index) => {
        console.log(`   ${index + 1}. ${plan.name} - ${plan.price}`);
      });
    }
    
    // Click COMPRAR on the first plan (index 0)
    console.log('\n🛒 Haciendo clic en COMPRAR en el primer plan...');
    const purchaseResult = await bot.clickComprarAndScrapeForm(0);
    
    if (!purchaseResult.success || !purchaseResult.purchaseFormData) {
      throw new Error(purchaseResult.error || 'Error al obtener formulario de compra');
    }
    
    console.log('\n✅ Formulario de compra capturado exitosamente!');
    console.log(`   URL: ${purchaseResult.purchaseFormData.url}`);
    console.log(`   Formularios encontrados: ${purchaseResult.purchaseFormData.forms.length}`);
    
    // Display form details
    purchaseResult.purchaseFormData.forms.forEach((form, formIndex) => {
      console.log(`\n📝 Formulario ${formIndex + 1}:`);
      console.log(`   ID: ${form.id || 'sin ID'}`);
      console.log(`   Action: ${form.action || 'sin action'}`);
      console.log(`   Method: ${form.method}`);
      console.log(`   Campos: ${form.fields.length}`);
      
      console.log('\n   Campos del formulario:');
      form.fields.forEach((field, fieldIndex) => {
        console.log(`   ${fieldIndex + 1}. ${field.tag.toUpperCase()} - ${field.name || field.id || 'sin nombre'}`);
        if (field.label) console.log(`      Label: ${field.label}`);
        if (field.type) console.log(`      Tipo: ${field.type}`);
        if (field.placeholder) console.log(`      Placeholder: ${field.placeholder}`);
        if (field.required) console.log(`      Requerido: Sí`);
        if (field.options && field.options.length > 0) {
          console.log(`      Opciones: ${field.options.length}`);
          field.options.slice(0, 5).forEach((opt, optIdx) => {
            console.log(`         ${optIdx + 1}. ${opt.text} (${opt.value})`);
          });
          if (field.options.length > 5) {
            console.log(`         ... y ${field.options.length - 5} más`);
          }
        }
      });
    });
    
    // Save the purchase form data to a file
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const purchaseFormPath = path.join(dataDir, `purchase-form-${Date.now()}.json`);
    fs.writeFileSync(
      purchaseFormPath,
      JSON.stringify(purchaseResult.purchaseFormData, null, 2),
      'utf-8'
    );
    
    console.log(`\n💾 Datos del formulario guardados en: ${purchaseFormPath}`);
    
    // Also save a simplified HTML version for inspection
    const htmlPath = path.join(dataDir, `purchase-form-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, purchaseResult.purchaseFormData.html, 'utf-8');
    console.log(`📄 HTML guardado en: ${htmlPath}`);
    
    // Save a summary
    const summary = {
      timestamp: new Date().toISOString(),
      url: purchaseResult.purchaseFormData.url,
      formsCount: purchaseResult.purchaseFormData.forms.length,
      forms: purchaseResult.purchaseFormData.forms.map(form => ({
        id: form.id,
        action: form.action,
        method: form.method,
        fieldsCount: form.fields.length,
        fields: form.fields.map(f => ({
          tag: f.tag,
          type: f.type,
          name: f.name,
          id: f.id,
          label: f.label,
          required: f.required,
          hasOptions: !!(f.options && f.options.length > 0),
          optionsCount: f.options?.length || 0,
        })),
      })),
    };
    
    const summaryPath = path.join(dataDir, `purchase-form-summary-${Date.now()}.json`);
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(summary, null, 2),
      'utf-8'
    );
    console.log(`📊 Resumen guardado en: ${summaryPath}`);
    
    console.log('\n✅ Script completado exitosamente!');
    
    return purchaseResult;
  } catch (error) {
    console.error('\n❌ Error en el script:', error);
    throw error;
  } finally {
    await bot.close();
  }
}

// Run the script
if (require.main === module) {
  scrapePurchaseForm()
    .then(() => {
      console.log('\n🎉 Proceso finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { scrapePurchaseForm };

