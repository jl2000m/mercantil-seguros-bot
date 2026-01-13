import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const catalogPath = path.join(dataDir, 'catalog.json');
    
    // First try the standard catalog.json file
    if (fs.existsSync(catalogPath)) {
      const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
      return NextResponse.json(catalogData);
    }
    
    // Fallback: try to find timestamped catalog files
    if (fs.existsSync(dataDir)) {
      const files = fs.readdirSync(dataDir);
      const catalogFiles = files.filter(f => f.startsWith('catalog-') && f.endsWith('.json'));
      
      if (catalogFiles.length > 0) {
        const catalogFile = catalogFiles.sort().reverse()[0];
        const timestampedCatalogPath = path.join(dataDir, catalogFile);
        const catalogData = JSON.parse(fs.readFileSync(timestampedCatalogPath, 'utf-8'));
        return NextResponse.json(catalogData);
      }
    }
    
    return NextResponse.json(
      { error: 'No catalog file found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error loading catalog:', error);
    return NextResponse.json(
      { error: 'Failed to load catalog' },
      { status: 500 }
    );
  }
}

