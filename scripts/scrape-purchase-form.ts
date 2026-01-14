import { MercantilSegurosBot } from '../src/index';
import { QuoteConfig } from '../src/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script to automatically generate a quote, click COMPRAR, and scrape the purchase form
 */
async function scrapePurchaseForm(planId: string = 'M-30') {
  const bot = new MercantilSegurosBot();
  
  try {
    console.log('🚀 Iniciando script automatizado para capturar formulario de compra...\n');
    
    await bot.initialize();
    
    if (!bot['page']) {
      throw new Error('Page not initialized');
    }
    
    const page = bot['page'];
    
    // Use the provided quote UUID and navigate directly to the purchase form
    const quoteUuid = 'b91a2eb0822af593be054528d21ca219';
    const purchaseFormUrl = `https://www1.mercantilseguros.com/as/viajesint/MRP022052/quotation/${quoteUuid}/${planId}/buy/step-one`;
    
    console.log(`🌐 Navegando directamente al formulario de compra...`);
    console.log(`   URL: ${purchaseFormUrl}`);
    console.log(`   Plan ID: ${planId}`);
    
    await page.goto(purchaseFormUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000); // Wait for page to fully load
    
    // Take a screenshot
    const screenshotDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotDir, `purchase-form-${planId}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot guardado: ${screenshotPath}`);
    
    // Get page HTML
    const html = await page.content();
    const htmlPath = path.join(screenshotDir, `purchase-form-${planId}-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`📄 HTML guardado: ${htmlPath}`);
    
    // Extract forms
    const forms = await page.locator('form').all();
    console.log(`\n📋 Formularios encontrados: ${forms.length}`);
    
    const purchaseForms = [];
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const formId = await form.getAttribute('id');
      const formAction = await form.getAttribute('action');
      const formMethod = await form.getAttribute('method') || 'GET';
      
      console.log(`\n📝 Formulario ${i + 1}:`);
      console.log(`   ID: ${formId || 'sin ID'}`);
      console.log(`   Action: ${formAction || 'sin action'}`);
      console.log(`   Method: ${formMethod}`);
      
      // Extract all input fields
      const inputs = await form.locator('input, select, textarea').all();
      const fields = [];
      
      for (const input of inputs) {
        const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        const required = await input.evaluate((el) => (el as HTMLInputElement).required);
        const value = await input.getAttribute('value') || await input.inputValue().catch(() => null);
        
        // Try to find label
        let label: string | null = null;
        try {
          const labelElement = await input.evaluateHandle((el) => {
            const id = el.id;
            if (id) {
              const label = document.querySelector(`label[for="${id}"]`);
              if (label) return label;
            }
            if (el.parentElement?.tagName === 'LABEL') {
              return el.parentElement;
            }
            if (el.previousElementSibling?.tagName === 'LABEL') {
              return el.previousElementSibling;
            }
            return null;
          });
          
          if (labelElement) {
            const labelText = await labelElement.evaluate((el) => el.textContent?.trim() || null);
            label = labelText;
          }
        } catch (error) {
          // Label not found, continue
        }
        
        // Get options for select elements
        let options: Array<{ value: string; text: string }> | null = null;
        if (tagName === 'select') {
          const optionElements = await input.locator('option').all();
          options = [];
          for (const option of optionElements) {
            const optionValue = await option.getAttribute('value');
            const optionText = await option.textContent();
            if (optionValue !== null && optionText) {
              options.push({
                value: optionValue,
                text: optionText.trim(),
              });
            }
          }
        }
        
        fields.push({
          tag: tagName,
          type: type || null,
          name: name || null,
          id: id || null,
          placeholder: placeholder || null,
          label: label,
          required: required,
          value: value,
          options: options,
        });
      }
      
      console.log(`   Campos: ${fields.length}`);
      fields.forEach((field, idx) => {
        console.log(`   ${idx + 1}. ${field.tag.toUpperCase()} - ${field.name || field.id || 'sin nombre'}`);
        if (field.label) console.log(`      Label: ${field.label}`);
        if (field.type) console.log(`      Tipo: ${field.type}`);
        if (field.required) console.log(`      Requerido: Sí`);
      });
      
      purchaseForms.push({
        index: i,
        id: formId,
        action: formAction,
        method: formMethod,
        fields: fields,
      });
    }
    
    const purchaseFormData = {
      url: purchaseFormUrl,
      html: html,
      forms: purchaseForms,
    };
    
    // Save the purchase form data
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const purchaseFormPath = path.join(dataDir, `purchase-form-${planId}-${Date.now()}.json`);
    fs.writeFileSync(
      purchaseFormPath,
      JSON.stringify(purchaseFormData, null, 2),
      'utf-8'
    );
    
    console.log(`\n💾 Datos del formulario guardados en: ${purchaseFormPath}`);
    
    // Save a summary
    const summary = {
      timestamp: new Date().toISOString(),
      planId: planId,
      url: purchaseFormUrl,
      formsCount: purchaseForms.length,
      forms: purchaseForms.map(form => ({
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
    
    const summaryPath = path.join(dataDir, `purchase-form-summary-${planId}-${Date.now()}.json`);
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(summary, null, 2),
      'utf-8'
    );
    console.log(`📊 Resumen guardado en: ${summaryPath}`);
    
    console.log('\n✅ Script completado exitosamente!');
    
    return {
      success: true,
      purchaseFormData,
      screenshotPath: screenshotPath,
      htmlPath: htmlPath,
    };
  } catch (error) {
    console.error('\n❌ Error en el script:', error);
    throw error;
  } finally {
    await bot.close();
  }
}

// Run the script
if (require.main === module) {
  // Get plan ID from command line args or use default
  const planId = process.argv[2] || 'M-30';
  
  console.log(`📋 Plan seleccionado: ${planId}`);
  console.log('   M-30 = Access 30');
  console.log('   M-50 = Premium 50');
  console.log('   M-75 = Premium 75');
  console.log('   M-100 = Elite 100\n');
  
  scrapePurchaseForm(planId)
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

