import { type Editor, useEditorState } from "@tiptap/react";
import { useCallback, useId, useState } from "react";
import { useImageUpload } from "../hooks/useImageUpload";

// スタイルをヘルパー関数で共通化
const getButtonClassName = (isActive: boolean, isDisabled = false) => {
  const baseClasses =
    "px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-200";
  const activeClasses =
    "bg-blue-500 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-700";
  const inactiveClasses =
    "bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700";
  const disabledClasses = "disabled:opacity-50 disabled:cursor-not-allowed";

  return `${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${isDisabled ? disabledClasses : ""}`;
};

interface EditorButtonProps {
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

const EditorButton = ({
  onClick,
  isActive,
  disabled = false,
  children,
}: EditorButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={getButtonClassName(isActive, disabled)}
  >
    {children}
  </button>
);

export function MenuBar({ editor }: { editor: Editor }) {
  // Read the current editor's state, and re-render the component when it changes
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive("bold") ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive("strike") ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive("code") ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        isHeading1: ctx.editor.isActive("heading", { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive("heading", { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive("heading", { level: 3 }) ?? false,
        isBulletList: ctx.editor.isActive("bulletList") ?? false,
        isOrderedList: ctx.editor.isActive("orderedList") ?? false,
        isCodeBlock: ctx.editor.isActive("codeBlock") ?? false,
        isBlockquote: ctx.editor.isActive("blockquote") ?? false,
      };
    },
  });

  // 画像モーダル関連のstate
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const imageUrlId = useId();

  const insertImage = useCallback(
    (url: string) => {
      // 先にモーダルを閉じてstateをリセット
      setIsImageModalOpen(false);
      setImageUrl("");
      // エディタにフォーカスを戻して画像を挿入
      editor.chain().focus().setImage({ src: url }).run();
    },
    [editor],
  );

  const { isUploading, fileInputRef, handleFileChange, acceptedTypes } =
    useImageUpload({
      onSuccess: insertImage,
    });

  const openImageModal = useCallback(() => {
    setImageUrl("");
    setIsImageModalOpen(true);
  }, []);

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [fileInputRef]);

  const handleUrlSubmit = useCallback(() => {
    if (imageUrl) {
      insertImage(imageUrl);
    }
  }, [imageUrl, insertImage]);

  const addYoutube = useCallback(() => {
    const url = window.prompt("YouTube動画のURLを入力してください");

    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  }, [editor]);

  return (
    <div className="pt-1">
      <div className="flex flex-wrap gap-2">
        <EditorButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editorState.isBold}
          disabled={!editorState.canBold}
        >
          B
        </EditorButton>
        <EditorButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editorState.isStrike}
          disabled={!editorState.canStrike}
        >
          S
        </EditorButton>
        <EditorButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editorState.isCode}
          disabled={!editorState.canCode}
        >
          &lt;/&gt;
        </EditorButton>
        <EditorButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editorState.isHeading1}
        >
          H1
        </EditorButton>
        <EditorButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editorState.isHeading2}
        >
          H2
        </EditorButton>
        <EditorButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editorState.isHeading3}
        >
          H3
        </EditorButton>
        <EditorButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editorState.isBulletList}
        >
          •
        </EditorButton>
        <EditorButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editorState.isOrderedList}
        >
          1.
        </EditorButton>
        <EditorButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editorState.isCodeBlock}
        >
          {"{"}
          {"}"}
        </EditorButton>
        <EditorButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editorState.isBlockquote}
        >
          "
        </EditorButton>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHardBreak().run()}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          ↵
        </button>
        <button
          type="button"
          onClick={openImageModal}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          画像
        </button>
        <button
          type="button"
          onClick={addYoutube}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          YouTube
        </button>
      </div>

      {/* 画像挿入モーダル */}
      {isImageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              画像を挿入
            </h2>

            <div className="space-y-4">
              {/* URL入力 */}
              <div>
                <label
                  htmlFor={imageUrlId}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  画像URL
                </label>
                <input
                  type="url"
                  id={imageUrlId}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* 区切り線 */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  または
                </span>
                <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
              </div>

              {/* ファイルアップロード */}
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors duration-200"
                >
                  {isUploading ? "アップロード中..." : "ファイルを選択"}
                </button>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  PNG, JPEG, JPG, WebP形式（3MB以下）
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptedTypes}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeImageModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg border border-gray-400 dark:border-gray-600 transition-colors duration-200"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={!imageUrl || isUploading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg border border-blue-700 dark:border-blue-800 transition-colors duration-200"
              >
                挿入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アップロード中オーバーレイ */}
      {isUploading && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-[60] transition-colors duration-300">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
