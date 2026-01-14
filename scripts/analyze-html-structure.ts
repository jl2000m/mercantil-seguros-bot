import * as fs from 'fs';
import * as path from 'path';

/**
 * Analyze the HTML structure to understand how labels are associated with form fields
 */
async function analyzeHTMLStructure() {
  const htmlPath = path.join(process.cwd(), 'data', 'purchase-form-html-1768369869296.html');
  
  if (!fs.existsSync(htmlPath)) {
    console.error('❌ HTML file not found:', htmlPath);
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  console.log('📊 Analyzing HTML structure for label patterns...\n');
  
  // Extract all label elements and their associations
  const labelPatterns: Array<{
    labelText: string;
    forAttribute: string | null;
    structure: string;
    nearbyInputs: string[];
  }> = [];
  
  // Find all labels with for attributes
  const labelForRegex = /<label[^>]*for=["']([^"']+)["'][^>]*>([^<]+)<\/label>/gi;
  let match;
  while ((match = labelForRegex.exec(html)) !== null) {
    const forAttr = match[1];
    const labelText = match[2].trim();
    
    // Find the associated input
    const inputRegex = new RegExp(`<input[^>]*id=["']${forAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
    const inputMatch = html.match(inputRegex);
    
    labelPatterns.push({
      labelText,
      forAttribute: forAttr,
      structure: 'label-for-attribute',
      nearbyInputs: inputMatch ? [inputMatch[0].substring(0, 200)] : [],
    });
  }
  
  // Find labels that wrap inputs (parent labels)
  const labelWrapRegex = /<label[^>]*>([^<]*)<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
  while ((match = labelWrapRegex.exec(html)) !== null) {
    const labelText = match[1].trim();
    const fieldName = match[2];
    
    labelPatterns.push({
      labelText,
      forAttribute: null,
      structure: 'label-wraps-input',
      nearbyInputs: [fieldName],
    });
  }
  
  // Find form groups with labels and inputs
  const formGroupRegex = /<div[^>]*class=["'][^"']*form-group[^"']*["'][^>]*>[\s\S]{0,500}<label[^>]*>([^<]+)<\/label>[\s\S]{0,200}<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
  while ((match = formGroupRegex.exec(html)) !== null) {
    const labelText = match[1].trim();
    const fieldName = match[2];
    
    labelPatterns.push({
      labelText,
      forAttribute: null,
      structure: 'form-group-label-input',
      nearbyInputs: [fieldName],
    });
  }
  
  // Find labels that are siblings before inputs
  const labelSiblingRegex = /<label[^>]*>([^<]+)<\/label>\s*<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
  while ((match = labelSiblingRegex.exec(html)) !== null) {
    const labelText = match[1].trim();
    const fieldName = match[2];
    
    labelPatterns.push({
      labelText,
      forAttribute: null,
      structure: 'label-sibling-before-input',
      nearbyInputs: [fieldName],
    });
  }
  
  // Analyze patterns
  console.log(`📋 Found ${labelPatterns.length} label patterns:\n`);
  
  const byStructure: Record<string, number> = {};
  const fieldNameToLabel: Record<string, string[]> = {};
  
  for (const pattern of labelPatterns) {
    byStructure[pattern.structure] = (byStructure[pattern.structure] || 0) + 1;
    
    for (const input of pattern.nearbyInputs) {
      // Extract field name from input
      const nameMatch = input.match(/name=["']([^"']+)["']/);
      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (!fieldNameToLabel[fieldName]) {
          fieldNameToLabel[fieldName] = [];
        }
        if (!fieldNameToLabel[fieldName].includes(pattern.labelText)) {
          fieldNameToLabel[fieldName].push(pattern.labelText);
        }
      }
    }
  }
  
  console.log('🏗️  Label structures found:');
  for (const [structure, count] of Object.entries(byStructure)) {
    console.log(`   ${structure}: ${count}`);
  }
  
  console.log('\n📝 Field name to label mappings:');
  const sortedFields = Object.entries(fieldNameToLabel)
    .filter(([name]) => !name.includes('[id]') && !name.includes('[uuid]'))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);
  
  for (const [fieldName, labels] of sortedFields) {
    console.log(`   ${fieldName}`);
    for (const label of labels) {
      console.log(`      → "${label}"`);
    }
  }
  
  // Find common patterns in field names that could be mapped
  console.log('\n🔍 Analyzing field name patterns:');
  const fieldNameParts: Record<string, number> = {};
  
  for (const fieldName of Object.keys(fieldNameToLabel)) {
    const parts = fieldName.split(/[\[\]_]/).filter(p => p.length > 0);
    for (const part of parts) {
      if (part.length > 2 && !/^\d+$/.test(part)) {
        fieldNameParts[part] = (fieldNameParts[part] || 0) + 1;
      }
    }
  }
  
  const sortedParts = Object.entries(fieldNameParts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  console.log('   Common field name parts:');
  for (const [part, count] of sortedParts) {
    console.log(`   ${part}: ${count} occurrences`);
  }
  
  // Check for inputs without labels
  console.log('\n⚠️  Checking for inputs without visible labels...');
  const allInputsRegex = /<input[^>]*name=["']([^"']+)["'][^>]*>/gi;
  const allInputs = new Set<string>();
  while ((match = allInputsRegex.exec(html)) !== null) {
    const fieldName = match[1];
    if (!fieldName.includes('[id]') && !fieldName.includes('[uuid]')) {
      allInputs.add(fieldName);
    }
  }
  
  const inputsWithoutLabels = Array.from(allInputs).filter(name => !fieldNameToLabel[name]);
  console.log(`   Found ${inputsWithoutLabels.length} inputs without labels:`);
  for (const name of inputsWithoutLabels.slice(0, 10)) {
    console.log(`   - ${name}`);
  }
}

analyzeHTMLStructure().catch(console.error);
