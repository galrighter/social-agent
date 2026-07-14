/**
 * basePath לפריסה תחת נתיב משנה (למשל powdercoat.co.il/playgames).
 * Link ו־router של Next מוסיפים אותו אוטומטית; קריאות fetch ידניות — לא.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
