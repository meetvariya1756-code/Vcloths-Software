const skuPatterns = [
  // 1. Shorts Category — pack-size-specific rules (evaluated before generic fallback)
  { name: 'Stripe Shorts', pattern: /STRIP-SH-WB/i, price: 13000, category: 'Shorts', labels_per_unit: 4 },
  { name: 'Cord Shorts',   pattern: /CORD-SH/i,    price: 16000, category: 'Shorts', labels_per_unit: 4 },
  // NOTE: Generic Shorts pattern removed — pack-size routing is handled by detectShortsPackCount().

  // 2. Track Category
  { name: 'Zipper Track', pattern: /ZIPER-TRACK/i, price: 17500, category: 'Track', labels_per_unit: 4 },
  { name: '3 Patti Track', pattern: /3-PATTI-TRACK/i, price: 13000, category: 'Track', labels_per_unit: 4 },
  { name: 'Kids Track', pattern: /KIDS-TRACK/i, price: 10500, category: 'Track', labels_per_unit: 2 },
  { name: 'Track Pants', pattern: /TRACK-PC/i, price: 10500, category: 'Track', labels_per_unit: 4 },



  // 4. Ladies Category
  { name: 'Ladies WB', pattern: /LDS-WB/i, price: 16500, category: 'Ladies', labels_per_unit: 4 },
  { name: 'Ladies GB', pattern: /LDS-GB/i, price: 16500, category: 'Ladies', labels_per_unit: 4 },

  // 5. Men's Category
  { name: 'Men WB', pattern: /MEN-WB/i, price: 16500, category: 'Men', labels_per_unit: 60 },
  { name: 'Men GB', pattern: /MEN-GB/i, price: 16500, category: 'Men', labels_per_unit: 60 },

  // 6. Kids Category
  { name: 'Kids WB', pattern: /KIDS-WB/i, price: 16000, category: 'Kids', labels_per_unit: 2 },
  { name: 'Kids GB', pattern: /KIDS-GB/i, price: 16000, category: 'Kids', labels_per_unit: 2 }
];

function levenshteinDistance(a, b) {
  const tmp = [];
  let i, j, alen = a.length, blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (i = 0; i <= alen; i++) tmp[i] = [i];
  for (j = 0; j <= blen; j++) tmp[0][j] = j;
  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

function getExplicitPackSize(sku) {
  if (!sku) return null;
  const upper = sku.toUpperCase().trim();
  
  // 1. Combo colors count (highest priority, e.g. Black+Cream)
  if (upper.includes('+')) {
    const parts = upper.split('+');
    if (parts.length >= 2 && parts.length <= 9) {
      return parts.length;
    }
  }

  // 2. Explicit PC-X, PC_X, PCX
  const pcMatch = upper.match(/PC[-_]?([1-9])/i);
  if (pcMatch) return parseInt(pcMatch[1]);
  
  // 3. Shorts specific SH-PX or SHPX
  const shpMatch = upper.match(/SH-P([1-9])/i);
  if (shpMatch) return parseInt(shpMatch[1]);
  const shpcMatch = upper.match(/SHPC[-_]?([1-9])/i);
  if (shpcMatch) return parseInt(shpcMatch[1]);
  
  // 4. trailing digit after dash or underscore (must be small, i.e. 1-9)
  const trailingMatch = upper.match(/[-_]([1-9])$/);
  if (trailingMatch) return parseInt(trailingMatch[1]);
  
  return null;
}

async function findBestSkuMapping(prisma, rawSku, platform = 'meesho') {
  if (!rawSku) return null;
  const sku = rawSku.trim();
  const rawPackSize = getExplicitPackSize(sku);

  // Helper to validate mapping pack size matches SKU explicit pack size
  const isValidMapping = (m) => {
    if (!m || !m.product) return false;
    if (rawPackSize !== null) {
      const mappedPackSize = m.product.labels_per_unit;
      if (mappedPackSize !== rawPackSize) {
        return false;
      }
    }
    return true;
  };

  // 1. Try exact match — always trust explicit user-set mappings
  let mapping = await prisma.skuMapping.findUnique({
    where: { marketplace_sku: sku },
    include: { product: true }
  });
  if (mapping && mapping.product) return mapping; // Exact DB mapping: always return without pack-size validation

  // Get all mappings for secondary matching
  const allMappings = await prisma.skuMapping.findMany({
    include: { product: true }
  });

  // 2. Try case-insensitive match — still trust user-set mappings
  const lowerSku = sku.toLowerCase();
  mapping = allMappings.find(m => m.marketplace_sku.toLowerCase() === lowerSku);
  if (mapping && mapping.product) return mapping; // Case-insensitive match: trust without pack-size validation

  // 3. Try fuzzy match (Levenshtein distance <= 2)
  let bestMapping = null;
  let minDistance = 3; // Must be <= 2

  for (const m of allMappings) {
    if (!isValidMapping(m)) continue;
    const dist = levenshteinDistance(sku.toLowerCase(), m.marketplace_sku.toLowerCase());
    if (dist <= 2 && dist < minDistance) {
      minDistance = dist;
      bestMapping = m;
    }
  }
  if (bestMapping) return bestMapping;

  // 4. Try containment match (e.g. raw description contains the SKU code)
  const cleanSku = sku.toLowerCase();
  for (const m of allMappings) {
    if (!isValidMapping(m)) continue;
    if (cleanSku.includes(m.marketplace_sku.toLowerCase())) {
      return m;
    }
  }

  // ── Handle SHORTS products — route to correct Shorts PC-X pack-size product ──
  const isShortsSkU = /SHPC|SH-P[1-4]|SHORTS/i.test(sku);
  if (isShortsSkU && !/(STRIP|CORD)/i.test(sku)) {
    let packCount = getExplicitPackSize(sku);
    if (packCount === null) {
      packCount = 1;
    }
    packCount = Math.min(4, Math.max(1, packCount));

    const targetName = `Shorts PC-${packCount} (Pack of ${packCount} Piece${packCount > 1 ? 's' : ''})`;
    let product = await prisma.product.findFirst({ where: { name: targetName } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: targetName,
          category: 'Shorts',
          labels_per_unit: packCount,
          base_price: 8000
        }
      });
    }

    const existingMapping = allMappings.find(m => m.marketplace_sku.toLowerCase() === lowerSku);
    if (existingMapping) {
      if (existingMapping.product_id === product.id) {
        return existingMapping;
      } else {
        const updatedMapping = await prisma.skuMapping.update({
          where: { id: existingMapping.id },
          data: { product_id: product.id },
          include: { product: true }
        });
        return updatedMapping;
      }
    }

    const newMapping = await prisma.skuMapping.create({
      data: {
        marketplace_sku: sku,
        product_id: product.id,
        platform: platform,
        color_variant: 'Assorted',
        size_variant: 'Free'
      },
      include: { product: true }
    });
    return newMapping;
  }

  // ── Handle BARFI products — route to correct BARFI-PC-X pack-size product ──
  if (cleanSku.includes('barfi') || cleanSku.includes('burfi')) {
    let packSize = getExplicitPackSize(sku);
    if (packSize === null) {
      packSize = 2; // Default to 2 for Barfi products if not explicitly specified
    }
    packSize = Math.min(3, Math.max(1, packSize));

    const targetName = `BARFI-PC-${packSize} (Pack of ${packSize} Piece${packSize > 1 ? 's' : ''})`;
    let product = await prisma.product.findFirst({ where: { name: targetName } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: targetName,
          category: 'Barfi',
          labels_per_unit: packSize,
          base_price: 11000
        }
      });
    }

    const existingMapping = allMappings.find(m => m.marketplace_sku.toLowerCase() === lowerSku);
    if (existingMapping) {
      if (existingMapping.product_id === product.id) {
        return existingMapping;
      } else {
        const updatedMapping = await prisma.skuMapping.update({
          where: { id: existingMapping.id },
          data: { product_id: product.id },
          include: { product: true }
        });
        return updatedMapping;
      }
    }

    const newMapping = await prisma.skuMapping.create({
      data: {
        marketplace_sku: sku,
        product_id: product.id,
        platform: platform,
        color_variant: 'Assorted',
        size_variant: 'Free'
      },
      include: { product: true }
    });
    return newMapping;
  }

  // 5. Try keyword Fallback Matcher (e.g., matching common descriptions to products)
  const products = await prisma.product.findMany();
  for (const p of products) {
    const nameLower = p.name.toLowerCase();
    
    // Smart checks for specific Indian e-commerce descriptions
    if (
      cleanSku.includes(nameLower) ||
      (cleanSku.includes("short") && nameLower.includes("shorts")) || // "Shorts PC-3"
      (cleanSku.includes("boxer") && nameLower.includes("boxer"))
    ) {
      const associatedMapping = allMappings.find(m => m.product_id === p.id);
      if (associatedMapping) {
        return associatedMapping;
      }
      // Return a virtual mapping
      return {
        product_id: p.id,
        product: p
      };
    }
  }

  // 6. Try SKU pattern prefix match from the user price mapping image
  for (const patternRule of skuPatterns) {
    if (patternRule.pattern.test(sku)) {
      // Find or create product
      let product = await prisma.product.findFirst({
        where: { name: patternRule.name }
      });
      if (!product) {
        product = await prisma.product.create({
          data: {
            name: patternRule.name,
            category: patternRule.category,
            labels_per_unit: patternRule.labels_per_unit,
            base_price: patternRule.price
          }
        });
      }

      // Create SkuMapping
      const newMapping = await prisma.skuMapping.create({
        data: {
          marketplace_sku: sku,
          product_id: product.id,
          platform: platform,
          color_variant: 'Assorted',
          size_variant: 'Free'
        },
        include: { product: true }
      });

      return newMapping;
    }
  }

  return null;
}

module.exports = {
  levenshteinDistance,
  findBestSkuMapping
};
