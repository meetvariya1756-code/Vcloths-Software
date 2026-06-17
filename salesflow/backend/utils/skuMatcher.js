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

async function findBestSkuMapping(prisma, rawSku) {
  if (!rawSku) return null;
  const sku = rawSku.trim();

  // 1. Try exact match
  let mapping = await prisma.skuMapping.findUnique({
    where: { marketplace_sku: sku },
    include: { product: true }
  });
  if (mapping) return mapping;

  // Get all mappings for secondary matching
  const allMappings = await prisma.skuMapping.findMany({
    include: { product: true }
  });

  // 2. Try case-insensitive match
  const lowerSku = sku.toLowerCase();
  mapping = allMappings.find(m => m.marketplace_sku.toLowerCase() === lowerSku);
  if (mapping) return mapping;

  // 3. Try fuzzy match (Levenshtein distance <= 2)
  let bestMapping = null;
  let minDistance = 3; // Must be <= 2

  for (const m of allMappings) {
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
    if (cleanSku.includes(m.marketplace_sku.toLowerCase())) {
      return m;
    }
  }

  // ── Handle SHORTS products — route to correct Shorts PC-X pack-size product ──
  const isShortsSkU = /SHPC|SH-P[1-4]|SHORTS/i.test(sku);
  if (isShortsSkU && !/(STRIP|CORD)/i.test(sku)) {
    let packCount = 1;
    // SHPC-X or SHPCX
    const shpcMatch = sku.match(/SHPC[-_]?([1-4])/i);
    if (shpcMatch) {
      packCount = parseInt(shpcMatch[1]);
    } else {
      // SH-PX
      const shpMatch = sku.match(/SH-P([1-4])/i);
      if (shpMatch) packCount = parseInt(shpMatch[1]);
    }
    // Clamp to 1-4
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
    if (existingMapping) return existingMapping;

    const newMapping = await prisma.skuMapping.create({
      data: {
        marketplace_sku: sku,
        product_id: product.id,
        platform: 'meesho',
        color_variant: 'Assorted',
        size_variant: 'Free'
      },
      include: { product: true }
    });
    return newMapping;
  }

  // ── Handle BARFI products — route to correct BARFI-PC-X pack-size product ──
  if (cleanSku.includes('barfi') || cleanSku.includes('burfi')) {
    let packSize = 1;
    const pcMatch = sku.match(/PC[-_]?([1-3])/i);
    if (pcMatch) {
      packSize = parseInt(pcMatch[1]);
    } else if (sku.includes('+')) {
      const parts = sku.split('+');
      if (parts.length >= 1 && parts.length <= 3) {
        packSize = parts.length;
      }
    } else {
      const endMatch = sku.match(/[-_]([1-3])$/);
      if (endMatch) {
        packSize = parseInt(endMatch[1]);
      }
    }

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
    if (existingMapping) return existingMapping;

    const newMapping = await prisma.skuMapping.create({
      data: {
        marketplace_sku: sku,
        product_id: product.id,
        platform: 'meesho',
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
      (cleanSku.includes("gb") && nameLower.includes("gb")) || // "Men GB PC-2"
      (cleanSku.includes("wb") && nameLower.includes("boxer")) || // "Men WB Boxer PC-3"
      (cleanSku.includes("short") && nameLower.includes("shorts")) || // "Shorts PC-3"
      (cleanSku.includes("track pants") && nameLower.includes("gb")) || 
      (cleanSku.includes("baggy") && nameLower.includes("gb")) ||
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
          platform: 'meesho',
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
