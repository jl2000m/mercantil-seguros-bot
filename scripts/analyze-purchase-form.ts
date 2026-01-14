import * as fs from 'fs';
import * as path from 'path';

interface FieldAnalysis {
  tag: string;
  type: string | null;
  name: string | null;
  id: string | null;
  placeholder: string | null;
  label: string | null;
  required: boolean;
  value: string | null;
  options?: Array<{ value: string; text: string }> | null;
  _analysis?: {
    htmlContext?: string | null;
    labelSource?: string | null;
  };
}

interface FormAnalysis {
  index: number;
  id: string | null;
  action: string | null;
  method: string;
  fields: FieldAnalysis[];
}

interface RawData {
  timestamp: string;
  url: string;
  forms: FormAnalysis[];
}

/**
 * Analyze saved purchase form data to identify patterns and improve label extraction
 */
async function analyzePurchaseFormData() {
  const dataDir = path.join(process.cwd(), 'data');
  
  if (!fs.existsSync(dataDir)) {
    console.error('❌ Data directory does not exist');
    return;
  }

  // Find all raw purchase form files
  const files = fs.readdirSync(dataDir)
    .filter(file => file.startsWith('purchase-form-raw-') && file.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first

  if (files.length === 0) {
    console.log('ℹ️  No purchase form data files found. Run a purchase form scrape first.');
    return;
  }

  console.log(`📊 Found ${files.length} purchase form data file(s)`);
  console.log(`   Analyzing most recent: ${files[0]}\n`);

  const filePath = path.join(dataDir, files[0]);
  const rawData: RawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Analysis results
  const analysis = {
    totalFields: 0,
    fieldsWithLabels: 0,
    fieldsWithoutLabels: 0,
    labelSources: {} as Record<string, number>,
    fieldsByType: {} as Record<string, number>,
    fieldsWithoutLabelDetails: [] as Array<{
      name: string | null;
      id: string | null;
      type: string | null;
      htmlContext: string | null;
    }>,
    labelPatterns: [] as Array<{
      fieldName: string;
      label: string;
      source: string;
    }>,
    suggestions: [] as string[],
  };

  // Analyze each form
  for (const form of rawData.forms) {
    console.log(`\n📋 Form ${form.index + 1}: ${form.action || 'No action'}`);
    console.log(`   Fields: ${form.fields.length}`);

    for (const field of form.fields) {
      analysis.totalFields++;

      // Count by type
      const fieldType = field.type || 'text';
      analysis.fieldsByType[fieldType] = (analysis.fieldsByType[fieldType] || 0) + 1;

      // Check if label exists
      if (field.label && field.label.trim()) {
        analysis.fieldsWithLabels++;
        
        // Track label source
        const source = field._analysis?.labelSource || 'unknown';
        analysis.labelSources[source] = (analysis.labelSources[source] || 0) + 1;
        
        // Store successful patterns
        if (field.name) {
          analysis.labelPatterns.push({
            fieldName: field.name,
            label: field.label,
            source: source,
          });
        }
      } else {
        analysis.fieldsWithoutLabels++;
        
        // Store fields without labels for investigation
        if (field.name && !field.name.includes('[id]') && !field.name.includes('[uuid]')) {
          analysis.fieldsWithoutLabelDetails.push({
            name: field.name,
            id: field.id,
            type: field.type,
            htmlContext: field._analysis?.htmlContext || null,
          });
        }
      }
    }
  }

  // Generate analysis report
  console.log('\n' + '='.repeat(80));
  console.log('📊 ANALYSIS REPORT');
  console.log('='.repeat(80));

  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Total fields: ${analysis.totalFields}`);
  console.log(`   Fields with labels: ${analysis.fieldsWithLabels} (${((analysis.fieldsWithLabels / analysis.totalFields) * 100).toFixed(1)}%)`);
  console.log(`   Fields without labels: ${analysis.fieldsWithoutLabels} (${((analysis.fieldsWithoutLabels / analysis.totalFields) * 100).toFixed(1)}%)`);

  console.log(`\n🏷️  Label Sources:`);
  for (const [source, count] of Object.entries(analysis.labelSources)) {
    console.log(`   ${source}: ${count} (${((count / analysis.fieldsWithLabels) * 100).toFixed(1)}%)`);
  }

  console.log(`\n📝 Fields by Type:`);
  for (const [type, count] of Object.entries(analysis.fieldsByType)) {
    console.log(`   ${type}: ${count}`);
  }

  // Analyze fields without labels
  if (analysis.fieldsWithoutLabelDetails.length > 0) {
    console.log(`\n⚠️  Fields Without Labels (${analysis.fieldsWithoutLabelDetails.length}):`);
    
    // Group by field name pattern
    const fieldNamePatterns: Record<string, number> = {};
    for (const field of analysis.fieldsWithoutLabelDetails) {
      if (field.name) {
        // Extract pattern (e.g., "website_quotation[quotes][0][breakdowns][0][passenger][first_name]" -> "first_name")
        const parts = field.name.split(/[\[\]_]/).filter(p => p.length > 0);
        const lastPart = parts[parts.length - 1];
        fieldNamePatterns[lastPart] = (fieldNamePatterns[lastPart] || 0) + 1;
      }
    }

    console.log(`\n   Common field name patterns without labels:`);
    const sortedPatterns = Object.entries(fieldNamePatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [pattern, count] of sortedPatterns) {
      console.log(`   - ${pattern}: ${count} field(s)`);
    }

    // Show sample HTML contexts for fields without labels
    console.log(`\n   Sample HTML contexts (first 3):`);
    for (let i = 0; i < Math.min(3, analysis.fieldsWithoutLabelDetails.length); i++) {
      const field = analysis.fieldsWithoutLabelDetails[i];
      console.log(`\n   Field: ${field.name || field.id || 'unknown'}`);
      if (field.htmlContext) {
        const preview = field.htmlContext.substring(0, 300).replace(/\s+/g, ' ');
        console.log(`   HTML: ${preview}...`);
      }
    }
  }

  // Analyze successful label patterns
  if (analysis.labelPatterns.length > 0) {
    console.log(`\n✅ Successful Label Patterns:`);
    
    // Group by field name pattern
    const successfulPatterns: Record<string, { label: string; source: string; count: number }> = {};
    for (const pattern of analysis.labelPatterns) {
      const parts = pattern.fieldName.split(/[\[\]_]/).filter(p => p.length > 0);
      const lastPart = parts[parts.length - 1];
      
      if (!successfulPatterns[lastPart]) {
        successfulPatterns[lastPart] = {
          label: pattern.label,
          source: pattern.source,
          count: 0,
        };
      }
      successfulPatterns[lastPart].count++;
    }

    const sortedSuccessful = Object.entries(successfulPatterns)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    for (const [pattern, data] of sortedSuccessful) {
      console.log(`   ${pattern} → "${data.label}" (${data.source}, ${data.count}x)`);
    }
  }

  // Generate suggestions
  console.log(`\n💡 Suggestions:`);
  
  const successRate = (analysis.fieldsWithLabels / analysis.totalFields) * 100;
  if (successRate < 50) {
    analysis.suggestions.push('⚠️  Label extraction success rate is below 50%. Consider improving extraction strategies.');
  }

  if (analysis.fieldsWithoutLabelDetails.length > 0) {
    // Check if there are common patterns in field names that could be mapped
    const unmappedPatterns = new Set<string>();
    for (const field of analysis.fieldsWithoutLabelDetails) {
      if (field.name) {
        const parts = field.name.split(/[\[\]_]/).filter(p => p.length > 0);
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.length > 2) {
          unmappedPatterns.add(lastPart);
        }
      }
    }
    
    if (unmappedPatterns.size > 0) {
      analysis.suggestions.push(`📝 Consider adding field name mappings for: ${Array.from(unmappedPatterns).slice(0, 10).join(', ')}`);
    }
  }

  // Check HTML context patterns
  const htmlContextsWithLabels = analysis.fieldsWithoutLabelDetails
    .filter(f => f.htmlContext && f.htmlContext.includes('<label'))
    .length;
  
  if (htmlContextsWithLabels > 0) {
    analysis.suggestions.push(`🔍 ${htmlContextsWithLabels} fields without labels have <label> tags in their HTML context. Improve parent container traversal.`);
  }

  for (const suggestion of analysis.suggestions) {
    console.log(`   ${suggestion}`);
  }

  // Save analysis report
  const reportPath = path.join(dataDir, `analysis-report-${Date.now()}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      sourceFile: files[0],
      ...analysis,
    }, null, 2),
    'utf-8'
  );

  console.log(`\n💾 Analysis report saved to: ${reportPath}`);
  console.log('\n' + '='.repeat(80));
}

// Run analysis
analyzePurchaseFormData().catch(console.error);
