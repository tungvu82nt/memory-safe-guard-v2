import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Shield, Lock, Bug } from "lucide-react";
import { PasswordCard } from "@/components/PasswordCard";
import { PasswordForm } from "@/components/PasswordForm";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NetlifyDebugTest } from "@/components/NetlifyDebugTest";
import { useToast } from "@/hooks/use-toast";
import { usePasswordsSupabase } from "@/hooks/use-passwords-supabase";
import { usePasswordForm } from "@/hooks/use-password-form";
import { PasswordEntry } from "@/lib/supabase-service-fixed";
import { TIMING, UI_CONFIG } from "@/lib/constants/app-constants";

// TypeScript interfaces cho type safety
interface StatsData {
  total: number;
  // Note: Có thể mở rộng thêm các thống kê khác như:
  // weak: number;
  // strong: number;
  // duplicates: number;
}

interface StatConfig {
  icon: React.ComponentType<{ className?: string }>;
  value: (stats: StatsData) => string | number;
  label: string;
  gradient: string;
}

// Constants từ app-constants để dễ bảo trì
const { SEARCH_DEBOUNCE_DELAY, ANIMATION_STAGGER_DELAY, MAX_ANIMATION_DELAY } = TIMING;
const { HERO_SECTION: HERO_SECTION_CONFIG } = UI_CONFIG;

const STATS_CONFIG: StatConfig[] = [
  { 
    icon: Lock, 
    value: (stats) => stats.total, 
    label: "Mật khẩu đã lưu",
    gradient: "bg-gradient-primary"
  },
  { 
    icon: Shield, 
    value: () => "100%", 
    label: "Bảo mật tuyệt đối",
    gradient: "bg-gradient-accent"
  },
  { 
    icon: Plus, 
    value: () => "∞", 
    label: "Không giới hạn",
    gradient: "bg-security/20 border border-security/30"
  }
];

/**
 * Component hiển thị loading state
 */
const LoadingState = () => (
  <div className="text-center py-16 animate-fade-in">
    <div className="p-4 rounded-full bg-muted/20 w-fit mx-auto mb-6 animate-pulse">
      <Lock className="w-20 h-20 text-muted-foreground" />
    </div>
    <h3 className="text-2xl font-bold mb-3 text-gradient">
      Đang tải dữ liệu...
    </h3>
  </div>
);

/**
 * Component hiển thị error state
 */
const ErrorState = ({ error }: { error: string }) => (
  <div className="text-center py-16 animate-fade-in">
    <div className="p-4 rounded-full bg-destructive/20 w-fit mx-auto mb-6">
      <Lock className="w-20 h-20 text-destructive" />
    </div>
    <h3 className="text-2xl font-bold mb-3 text-gradient">
      Lỗi khi tải dữ liệu
    </h3>
    <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
      {error}
    </p>
  </div>
);

/**
 * Component hiển thị thống kê
 * Memoized để tránh re-render không cần thiết
 */
const StatsSection = React.memo(({ stats }: { stats: StatsData }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
    {STATS_CONFIG.map((stat, index) => {
      const IconComponent = stat.icon;
      return (
        <div key={index} className="glass-effect rounded-xl p-6 text-center hover-lift group">
          <div className={`p-3 rounded-lg ${stat.gradient} w-fit mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
            <IconComponent className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-3xl font-bold mb-1">{stat.value(stats)}</div>
          <div className="text-muted-foreground font-medium">{stat.label}</div>
        </div>
      );
    })}
  </div>
));

/**
 * Component hiển thị hero section
 * Sử dụng Shield icon thay vì image để tránh lỗi build trên Netlify
 */
const HeroSection = ({ onAddPassword }: { onAddPassword: () => void }) => (
  <div className="text-center mb-12 animate-fade-in">
    <div className="mx-auto mb-8 w-full max-w-2xl relative">
      <div className="absolute inset-0 bg-gradient-hero rounded-xl blur-3xl opacity-30"></div>
      <div className="relative z-10 p-16 bg-gradient-primary rounded-xl shadow-glow hover-lift">
        <Shield className="w-32 h-32 mx-auto text-primary-foreground mb-6" />
        <div className="flex items-center justify-center gap-4 text-primary-foreground">
          <Lock className="w-8 h-8" />
          <span className="text-2xl font-bold">Memory Safe Guard</span>
          <Shield className="w-8 h-8" />
        </div>
      </div>
    </div>
    <h2 className="text-5xl font-bold mb-4 text-gradient leading-tight">
      {HERO_SECTION_CONFIG.title}
    </h2>
    <p className="text-muted-foreground max-w-3xl mx-auto text-lg leading-relaxed">
      {HERO_SECTION_CONFIG.subtitle}
      <br />
      <span className="text-accent font-medium">{HERO_SECTION_CONFIG.highlight}</span>
    </p>
  </div>
);

/**
 * Component hiển thị empty state
 */
const EmptyState = ({ searchQuery, onAddPassword }: { 
  searchQuery: string; 
  onAddPassword: () => void; 
}) => (
  <div className="text-center py-16 animate-fade-in">
    <div className="p-4 rounded-full bg-muted/20 w-fit mx-auto mb-6">
      <Lock className="w-20 h-20 text-muted-foreground" />
    </div>
    <h3 className="text-2xl font-bold mb-3 text-gradient">
      {searchQuery ? "Không tìm thấy kết quả" : "Chưa có mật khẩu nào"}
    </h3>
    <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
      {searchQuery
        ? "Thử tìm kiếm với từ khóa khác hoặc kiểm tra lại chính tả"
        : "Bắt đầu bảo vệ tài khoản của bạn bằng cách thêm mật khẩu đầu tiên"}
    </p>
    {!searchQuery && (
      <Button 
        onClick={onAddPassword} 
        variant="default" 
        className="shadow-button hover:shadow-glow transition-all duration-300 px-8 py-3"
      >
        <Plus className="w-5 h-5 mr-2" />
        Thêm mật khẩu đầu tiên
      </Button>
    )}
  </div>
);

/**
 * Trang chính của ứng dụng Memory Safe Guard
 * Hiển thị danh sách mật khẩu và các chức năng quản lý
 */
const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const { toast } = useToast();
  
  // Custom hooks để tách biệt logic
  const {
    passwords,
    loading,
    error,
    stats,
    searchPasswords,
    addPassword,
    updatePassword,
    deletePassword
  } = usePasswordsSupabase();

  const {
    isFormOpen,
    editEntry,
    openAddForm,
    openEditForm,
    closeForm,
    resetForm
  } = usePasswordForm();

  // Tìm kiếm với debounce sử dụng constant
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPasswords(searchQuery);
    }, SEARCH_DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchPasswords]);

  // Tối ưu animation delays với dependency chính xác
  const animationDelays = useMemo(() => {
    // Chỉ tính toán lại khi số lượng passwords thay đổi
    return passwords.map((_, index) => 
      `${Math.min(index * ANIMATION_STAGGER_DELAY, MAX_ANIMATION_DELAY)}ms`
    );
  }, [passwords.length]); // Dependency chính xác hơn
  
  const handleSave = useCallback(async (entryData: Omit<PasswordEntry, "id" | "createdAt" | "updatedAt">) => {
    try {
      if (editEntry) {
        await updatePassword(editEntry.id, entryData);
        toast({
          title: "Cập nhật thành công",
          description: "Mật khẩu đã được cập nhật",
        });
      } else {
        await addPassword(entryData);
        toast({
          title: "Thêm thành công", 
          description: "Mật khẩu mới đã được lưu",
        });
      }
      resetForm();
    } catch (err) {
      console.error('Lỗi khi lưu mật khẩu:', err);
      toast({
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Không thể lưu mật khẩu",
        variant: "destructive",
      });
    }
  }, [editEntry, updatePassword, addPassword, resetForm, toast]);

  const handleEdit = useCallback((entry: PasswordEntry) => {
    openEditForm(entry); // Sử dụng openEditForm từ custom hook
  }, [openEditForm]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deletePassword(id);
    } catch (err) {
      console.error('Lỗi khi xóa mật khẩu:', err);
    }
  }, [deletePassword]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-effect sticky top-0 z-50 border-b border-border/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-primary pulse-glow">
                <Shield className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gradient">Memory Safe Guard</h1>
                <p className="text-muted-foreground font-medium">Quản lý mật khẩu an toàn & hiện đại</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowDebug(!showDebug)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Bug className="w-4 h-4" />
                Debug
              </Button>
              <ThemeToggle />
              <Button 
                onClick={openAddForm} 
                variant="default" 
                className="gap-2 shadow-button hover:shadow-glow transition-all duration-300 px-6 py-3"
              >
                <Plus className="w-5 h-5" />
                Thêm mật khẩu
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Debug Panel - chỉ hiện khi cần */}
        {showDebug && (
          <div className="mb-12">
            <NetlifyDebugTest />
          </div>
        )}

        {/* Hero Section */}
        <HeroSection onAddPassword={openAddForm} />

        {/* Search */}
        <div className="max-w-lg mx-auto mb-12">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Stats */}
        <StatsSection stats={stats} />

        {/* Password Grid */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : passwords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {passwords.map((entry, index) => (
              <div 
                key={entry.id}
                className="animate-fade-in"
                style={{ animationDelay: animationDelays[index] }}
              >
                <PasswordCard
                  entry={entry}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState searchQuery={searchQuery} onAddPassword={openAddForm} />
        )}
      </div>

      {/* Form Modal */}
      <PasswordForm
        isOpen={isFormOpen}
        onClose={closeForm}
        onSave={handleSave}
        editEntry={editEntry}
      />
    </div>
  );
};

export default Index;