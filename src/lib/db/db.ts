/**
 * DatabaseManager - IndexedDB Implementation
 * Singleton class để quản lý IndexedDB operations theo steering rules
 * 
 * Features:
 * - CRUD operations cho passwords
 * - Search functionality
 * - Error handling và retry logic
 * - Type-safe với TypeScript
 */

import { PasswordEntry, PasswordInsert } from '@/lib/types/models';
import { DATABASE } from '@/lib/constants/app-constants';

/**
 * IndexedDB Database Manager Singleton
 * Quản lý tất cả operations với IndexedDB
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: IDBDatabase | null = null;
  private readonly dbName = 'memorySafeGuardDB';
  private readonly storeName = DATABASE.TABLE_NAME;
  private readonly version = 1;

  private constructor() {}

  /**
   * Singleton pattern - chỉ có một instance duy nhất
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Khởi tạo database và tạo object store
   */
  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Không thể mở IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Tạo object store nếu chưa tồn tại
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { 
            keyPath: 'id' 
          });
          
          // Tạo indexes để tối ưu tìm kiếm
          store.createIndex('service', 'service', { unique: false });
          store.createIndex('username', 'username', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Đảm bảo database đã được khởi tạo
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  /**
   * Tạo ID duy nhất cho password entry
   */
  private generateId(): string {
    return `pwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Lấy tất cả passwords từ database
   */
  public async getAllPasswords(): Promise<PasswordEntry[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sắp xếp theo updatedAt giảm dần
        const passwords = request.result.sort((a: PasswordEntry, b: PasswordEntry) => 
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        resolve(passwords);
      };

      request.onerror = () => {
        reject(new Error('Không thể lấy danh sách mật khẩu'));
      };
    });
  }

  /**
   * Tìm kiếm passwords theo service hoặc username
   */
  public async searchPasswords(query: string): Promise<PasswordEntry[]> {
    if (!query.trim()) {
      return this.getAllPasswords();
    }

    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const allPasswords = request.result;
        const searchTerm = query.toLowerCase();
        
        // Tìm kiếm trong service và username
        const filtered = allPasswords.filter((password: PasswordEntry) => 
          password.service.toLowerCase().includes(searchTerm) ||
          password.username.toLowerCase().includes(searchTerm)
        );

        // Sắp xếp theo updatedAt giảm dần
        const sorted = filtered.sort((a: PasswordEntry, b: PasswordEntry) => 
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );

        resolve(sorted);
      };

      request.onerror = () => {
        reject(new Error('Không thể tìm kiếm mật khẩu'));
      };
    });
  }

  /**
   * Thêm password mới
   */
  public async addPassword(passwordData: PasswordInsert): Promise<PasswordEntry> {
    await this.ensureInitialized();
    
    const now = new Date().toISOString();
    const newPassword: PasswordEntry = {
      id: this.generateId(),
      ...passwordData,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(newPassword);

      request.onsuccess = () => {
        resolve(newPassword);
      };

      request.onerror = () => {
        reject(new Error('Không thể thêm mật khẩu mới'));
      };
    });
  }

  /**
   * Cập nhật password theo ID
   */
  public async updatePassword(id: string, updates: Partial<PasswordInsert>): Promise<PasswordEntry> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const existingPassword = getRequest.result;
        if (!existingPassword) {
          reject(new Error('Không tìm thấy mật khẩu'));
          return;
        }

        const updatedPassword: PasswordEntry = {
          ...existingPassword,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const putRequest = store.put(updatedPassword);
        
        putRequest.onsuccess = () => {
          resolve(updatedPassword);
        };

        putRequest.onerror = () => {
          reject(new Error('Không thể cập nhật mật khẩu'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Không thể tìm mật khẩu để cập nhật'));
      };
    });
  }

  /**
   * Xóa password theo ID
   */
  public async deletePassword(id: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Không thể xóa mật khẩu'));
      };
    });
  }

  /**
   * Lấy thống kê passwords
   */
  public async getStats(): Promise<{ total: number; hasPasswords: boolean }> {
    const passwords = await this.getAllPasswords();
    return {
      total: passwords.length,
      hasPasswords: passwords.length > 0,
    };
  }

  /**
   * Xóa toàn bộ database (cho testing hoặc reset)
   */
  public async clearAll(): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Không thể xóa toàn bộ dữ liệu'));
      };
    });
  }
}

/**
 * Export singleton instance để sử dụng trong toàn bộ app
 */
export const db = DatabaseManager.getInstance();