const skuPatterns = [
  { name: 'SHPC', pattern: /^SHPC-?/i, price: 8000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'TRACK-PC', pattern: /^TRACK-PC-?/i, price: 10500, category: 'Apparel', labels_per_unit: 4 },
  { name: 'SHIRTPC', pattern: /^SHIRTPC-?/i, price: 11000, category: 'Apparel', labels_per_unit: 4 },
  { name: '(ZIPER)-TRACK-PC', pattern: /^\(ZIPER\)-TRACK-PC-?/i, price: 17500, category: 'Apparel', labels_per_unit: 4 },
  { name: 'Pyjama-PC', pattern: /^Pyjama-PC-?/i, price: 9000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'KIDS-Pyjm-PC', pattern: /^KIDS-Pyjm-PC-?/i, price: 9000, category: 'Kids', labels_per_unit: 2 },
  { name: 'KIDS-TRACK-PC', pattern: /^KIDS-TRACK-PC-?/i, price: 10500, category: 'Kids', labels_per_unit: 2 },
  { name: 'KIDS-BARFI-PC', pattern: /^KIDS-BARFI-PC-?/i, price: 11000, category: 'Kids', labels_per_unit: 2 },
  { name: 'BARFI-PC', pattern: /^BARFI-PC-?/i, price: 11000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'PANTPC', pattern: /^PANTPC-?/i, price: 14500, category: 'Apparel', labels_per_unit: 4 },
  { name: 'LDS-GB-BGY-PC', pattern: /^LDS-GB-BGY-PC-?/i, price: 16000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'LDS-WB-BGY-PC', pattern: /^LDS-WB-BGY-PC-?/i, price: 16000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'KIDS-WB-BGY-PC', pattern: /^KIDS-WB-BGY-PC-?/i, price: 16000, category: 'Kids', labels_per_unit: 2 },
  { name: 'KIDS-GB-BGY-PC', pattern: /^KIDS-GB-BGY-PC-?/i, price: 16000, category: 'Kids', labels_per_unit: 2 },
  { name: 'MEN-WB-BGY-PC', pattern: /^MEN-WB-BGY-PC-?/i, price: 16500, category: 'Innerwear', labels_per_unit: 60 },
  { name: 'MEN-GB-BGY-PC', pattern: /^MEN-GB-BGY-PC-?/i, price: 16500, category: 'Innerwear', labels_per_unit: 60 },
  { name: '(CORD-SH)-PC', pattern: /^\(CORD-SH\)-PC-?/i, price: 16000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'STRIP-SH-WB-PC', pattern: /^STRIP-SH-WB-PC-?/i, price: 13000, category: 'Apparel', labels_per_unit: 4 },
  { name: 'MEN-(KB)-BGY-PC', pattern: /^MEN-\(KB\)-BGY-PC-?/i, price: 16000, category: 'Innerwear', labels_per_unit: 60 }
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
      (cleanSku.includes("boxer") && nameLower.includes("boxer")) ||
      (cleanSku.includes("barfi") && nameLower.includes("barfi"))
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
