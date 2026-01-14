import { NextRequest, NextResponse } from 'next/server';
import { MercantilSegurosBot } from '../../../src/index';
import { PurchaseFormData, PurchaseFormResult } from '../../../src/types';

export const maxDuration = 90; // 90 seconds timeout for purchase form

/**
 * Map plan ID from quote page (D-30) to purchase form (M-30)
 */
function mapPlanIdToPurchaseForm(planId: string): string {
  // D-30 -> M-30, D-50 -> M-50, etc.
  return planId.replace(/^D-/, 'M-');
}

/**
 * Extract UUID from quote URL
 * Example: https://.../quotation/b91a2eb0822af593be054528d21ca219
 */
function extractQuoteUuid(quoteUrl: string): string | null {
  const match = quoteUrl.match(/quotation\/([a-f0-9]+)/);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, quoteUrl } = body;
    
    if (!planId || !quoteUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'planId and quoteUrl are required',
        },
        { status: 400 }
      );
    }

    const quoteUuid = extractQuoteUuid(quoteUrl);
    if (!quoteUuid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not extract quote UUID from URL',
        },
        { status: 400 }
      );
    }

    // Map plan ID (D-30 -> M-30)
    const purchasePlanId = mapPlanIdToPurchaseForm(planId);
    const purchaseFormUrl = `https://www1.mercantilseguros.com/as/viajesint/MRP022052/quotation/${quoteUuid}/${purchasePlanId}/buy/step-one`;

    console.log(`📋 Scraping purchase form for plan ${planId} (${purchasePlanId})`);
    console.log(`   URL: ${purchaseFormUrl}`);

    const bot = new MercantilSegurosBot();
    
    try {
      await bot.initialize();
      
      if (!bot['page']) {
        throw new Error('Page not initialized');
      }
      
      const page = bot['page'];
      
      // Navigate directly to the purchase form
      await page.goto(purchaseFormUrl, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(3000); // Wait for page to fully load
      
      // Extract forms
      const forms = await page.locator('form').all();
      const purchaseForms = [];
      
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const formId = await form.getAttribute('id');
        const formAction = await form.getAttribute('action');
        const formMethod = await form.getAttribute('method') || 'GET';
        
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
          // Extract data-premium for rider checkboxes
          const dataPremium = await input.getAttribute('data-premium');
          
          // Filter out internal/hidden fields that shouldn't get labels
          // BUT: Allow rider checkboxes (optional benefits) - they have data-premium and are checkboxes
          const isRiderCheckbox = type === 'checkbox' && name?.includes('[riders]') && dataPremium !== null;
          
          // Skip if it's a hidden field or has internal field name patterns
          // Exception: rider checkboxes should be processed to get their labels
          if (
            type === 'hidden' ||
            (name && !isRiderCheckbox && (
              name.includes('[id]') ||
              name.includes('[uuid]') ||
              name.includes('[factor_wlc]') ||
              name.includes('[factor_main]') ||
              name.includes('[calculate_premium]') ||
              name.includes('[free_passenger]') ||
              name.includes('[plan][id]') ||
              name.includes('[data_taxes]') ||
              (name.includes('[riders][') && type !== 'checkbox') || // Filter out rider text inputs, but allow checkboxes
              name === 'website_quotation[id]' ||
              name === 'website_quotation[search_id]' ||
              name === 'website_quotation[date_from]' ||
              name === 'website_quotation[date_to]' ||
              name === 'website_quotation[days]' ||
              name === 'website_quotation[months]' ||
              name === 'website_quotation[passengers]' ||
              name === 'website_quotation[general_agent]' ||
              name === 'website_quotation[product]' ||
              name === 'website_quotation[origin]' ||
              name === 'website_quotation[destination]'
            ))
          ) {
            // Still include these fields but without labels
            fields.push({
              tag: tagName,
              type: type || null,
              name: name || null,
              id: id || null,
              placeholder: placeholder || null,
              label: null,
              required: required,
              value: value,
              options: null,
              dataPremium: dataPremium || null,
            });
            continue; // Skip label extraction for internal fields
          }
          
          // Try to find label with multiple strategies
          let label: string | null = null;
          try {
            const labelText = await input.evaluate((el) => {
              const id = el.id;
              
              // Strategy 1: Look for label[for="id"] - this is the most reliable pattern
              // The `for` attribute is the definitive link between label and input
              if (id) {
                const labelEl = document.querySelector(`label[for="${id}"]`);
                if (labelEl) {
                  const text = labelEl.textContent?.trim();
                  // Only return if text exists and doesn't look like programmatic content
                  if (text && !text.includes('[') && !text.includes(']') && text.length < 100) {
                    return text;
                  }
                }
              }
              
              // Strategy 2: Check if parent is a label
              if (el.parentElement?.tagName === 'LABEL') {
                const text = el.parentElement.textContent?.trim();
                if (text) return text;
              }
              
              // Strategy 3: Check previous sibling
              let sibling = el.previousElementSibling;
              while (sibling) {
                if (sibling.tagName === 'LABEL') {
                  const text = sibling.textContent?.trim();
                  if (text) return text;
                }
                sibling = sibling.previousElementSibling;
              }
              
              // Strategy 4: Look for label in immediate parent container (form-group, etc.)
              // Only check within the current passenger's fieldset to avoid picking up labels from other passengers
              // Stop at fieldset boundaries since each breakdown represents a passenger
              let parent = el.parentElement;
              let levelsChecked = 0;
              const maxLevels = 3; // Allow a bit more depth but stop at fieldset
              
              while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY' && levelsChecked < maxLevels) {
                // Stop searching if we hit a fieldset boundary (each passenger is in their own fieldset)
                if (parent.tagName === 'FIELDSET' && parent !== el.closest('fieldset')) {
                  break;
                }
                
                const labelInParent = parent.querySelector('label');
                if (labelInParent && labelInParent !== el) {
                  const labelFor = labelInParent.getAttribute('for');
                  const text = labelInParent.textContent?.trim();
                  
                  // Only accept this label if:
                  // 1. It has text and doesn't contain brackets (programmatic patterns)
                  // 2. Either it has no 'for' attribute (meaning it might be a container label)
                  //    OR its 'for' attribute matches this element's id (meaning it's actually for this field)
                  if (text && !text.includes('[') && !text.includes(']')) {
                    if (!labelFor || labelFor === id) {
                      return text;
                    }
                    // If label has a 'for' that doesn't match this field, it's for another field - skip it
                  }
                }
                parent = parent.parentElement;
                levelsChecked++;
              }
              
              // Strategy 5: Look for text node before the input
              const walker = document.createTreeWalker(
                el.parentElement || document.body,
                NodeFilter.SHOW_TEXT,
                null
              );
              let node;
              while (node = walker.nextNode()) {
                if (node.parentElement && el.compareDocumentPosition(node.parentElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
                  const text = node.textContent?.trim();
                  if (text && text.length > 0 && text.length < 50 && !text.includes('[')) {
                    return text;
                  }
                }
              }
              
              return null;
            });
            
            // Clean up label text - remove field names, brackets, etc.
            if (labelText) {
              // Remove common patterns that indicate it's not a real label
              let cleanedLabel = labelText.replace(/\[.*?\]/g, '').trim();
              cleanedLabel = cleanedLabel.replace(/website.*?quotation/gi, '').trim();
              // If label is too long or contains too many special chars, it's probably not a real label
              if (cleanedLabel.length > 50 || (cleanedLabel.match(/[\[\]{}]/g) || []).length > 2) {
                label = null;
              } else {
                label = cleanedLabel;
              }
            } else {
              label = null;
            }
          } catch (error) {
            // Label not found, continue
          }
          
          // Fallback: Map common field name patterns to Spanish labels
          if (!label && name) {
            const fieldNameMapping: { [key: string]: string } = {
              'nombre': 'Nombre',
              'apellido': 'Apellido',
              'genero': 'Género',
              'pais': 'País',
              'email': 'Email',
              'telefono': 'Teléfono',
              'codigo': 'Código País',
              'fecha': 'Fecha de Nacimiento',
              'nacimiento': 'Fecha de Nacimiento',
              'edad': 'Edad',
              'identificacion': 'Tipo de Identificación',
              'numero': 'Número',
              'condiciones': 'Condiciones Médicas',
              'medicas': 'Condiciones Médicas',
              'prima': 'Prima Total a Pagar',
              'agente': 'Agente/Agencia',
              'contacto': 'Contacto de Emergencia',
              'emergencia': 'Contacto de Emergencia',
            };
            
            const nameLower = name.toLowerCase();
            for (const [key, value] of Object.entries(fieldNameMapping)) {
              if (nameLower.includes(key)) {
                label = value;
                break;
              }
            }
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
            dataPremium: dataPremium || null,
          });
        }
        
        purchaseForms.push({
          index: i,
          id: formId,
          action: formAction,
          method: formMethod,
          fields: fields,
        });
      }
      
      const html = await page.content();
      const purchaseFormData: PurchaseFormData = {
        url: purchaseFormUrl,
        html: html,
        forms: purchaseForms,
      };
      
      await bot.close();

      return NextResponse.json({
        success: true,
        purchaseFormData,
      } as PurchaseFormResult);
    } catch (error) {
      await bot.close().catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('Error obteniendo formulario de compra:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

