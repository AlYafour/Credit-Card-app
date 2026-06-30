const CATEGORY_AR: Record<string, string> = {
  food: 'طعام',
  restaurants: 'مطاعم',
  groceries: 'بقالة',
  travel: 'سفر',
  transport: 'مواصلات',
  transportation: 'مواصلات',
  fuel: 'وقود',
  shopping: 'تسوق',
  services: 'خدمات',
  technology: 'تكنولوجيا',
  electronics: 'إلكترونيات',
  healthcare: 'رعاية صحية',
  health: 'صحة',
  entertainment: 'ترفيه',
  education: 'تعليم',
  utilities: 'مرافق',
  hotels: 'فنادق',
  insurance: 'تأمين',
  banking: 'خدمات بنكية',
  telecoms: 'اتصالات',
  telecom: 'اتصالات',
  government: 'جهات حكومية',
  charity: 'تبرعات',
  subscriptions: 'اشتراكات',
  other: 'أخرى',
};

export function translateCategory(category: string, locale: string): string {
  if (locale !== 'ar') return category;
  return CATEGORY_AR[category.toLowerCase()] ?? category;
}

/**
 * Convert a string to a URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')              // Trim - from start of text
    .replace(/-+$/, '');             // Trim - from end of text
}

/**
 * Generate card URL with slug
 */
export function getCardUrl(cardId: string, cardName: string): string {
  const slug = slugify(cardName);
  return `/cards/${cardId}-${slug}`;
}

/**
 * Extract card ID from URL (handles both old format and new slug format)
 */
export function extractCardId(urlPath: string): string {
  // Handle format: /cards/[id]-[slug] or /cards/[id]
  // UUID format: 8-4-4-4-12 (36 characters with dashes)
  const uuidPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const match = urlPath.match(uuidPattern);
  if (match) {
    return match[1];
  }
  // Fallback: if no UUID found, try to extract from path segments
  const segments = urlPath.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || '';
  // Try to extract UUID from last segment (might be id-slug format)
  const segmentMatch = lastSegment.match(uuidPattern);
  if (segmentMatch) {
    return segmentMatch[1];
  }
  // Last resort: return the segment as-is (for backward compatibility)
  return lastSegment;
}
