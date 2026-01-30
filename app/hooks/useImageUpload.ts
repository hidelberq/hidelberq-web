import { useCallback, useRef, useState } from "react";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;
const ACCEPTED_TYPES = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_FILE_SIZE = 1024 * 1024 * 3; // 3MB

interface ImageUploadOptions {
  maxFileSize?: number;
  onSuccess: (url: string) => void;
}

interface UseImageUploadReturn {
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  acceptedTypes: string;
}

export function useImageUpload(
  options: ImageUploadOptions,
): UseImageUploadReturn {
  const { maxFileSize = MAX_FILE_SIZE, onSuccess } = options;
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // ファイル形式の検証
      if (
        !ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])
      ) {
        alert("PNG, JPEG, JPG, WebP形式の画像のみアップロード可能です");
        resetFileInput();
        return;
      }

      // ファイルサイズの検証
      if (file.size > maxFileSize) {
        alert("ファイルサイズは3MB以下にしてください");
        resetFileInput();
        return;
      }

      // ファイルをアップロード
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/fileupload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("アップロードに失敗しました");
        }

        const result = (await response.json()) as { url: string };
        onSuccess(result.url);
      } catch (_error) {
        alert("画像のアップロードに失敗しました");
      } finally {
        setIsUploading(false);
        resetFileInput();
      }
    },
    [maxFileSize, onSuccess, resetFileInput],
  );

  return {
    isUploading,
    fileInputRef,
    triggerFileSelect,
    handleFileChange,
    acceptedTypes: ACCEPTED_TYPES,
  };
}
