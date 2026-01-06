/**
 * Password Entry Model
 * Đồng bộ với database schema (PostgreSQL + IndexedDB)
 * 
 * Note: Timestamps được lưu dưới dạng ISO string để tương thích
 * với cả IndexedDB và PostgreSQL
 */
export interface PasswordEntry {
  id: string;
  service: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Password Insert Type
 * Dùng khi tạo mới password (không cần id và timestamps)
 */
export type PasswordInsert = Omit<PasswordEntry, "id" | "createdAt" | "updatedAt">;

/**
 * Password Update Type
 * Dùng khi cập nhật password (có thể partial)
 */
export type PasswordUpdate = Partial<PasswordInsert>;

/**
 * Database Stats Type
 * Thống kê về passwords trong database
 */
export interface PasswordStats {
  total: number;
  hasPasswords: boolean;
}

/**
 * Search Query Type
 * Tham số tìm kiếm passwords
 */
export interface SearchQuery {
  query?: string;
  limit?: number;
  offset?: number;
}