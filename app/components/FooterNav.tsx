import { useEffect, useId, useRef, useState } from "react";
import { Form, NavLink, useLocation, useNavigation } from "react-router";
import {
  HomeIcon,
  MoviesIcon,
  PlusIcon,
  QuestionMarkIcon,
  UserIcon,
} from "./Icons";

type KiokuType = "doc" | "note" | "youtube";

export function FooterNav() {
  const location = useLocation();
  const [isStandalone, setIsStandalone] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKiokuType, setSelectedKiokuType] = useState<KiokuType | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState("");
  const [noteUrl, setNoteUrl] = useState("");
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const titleId = useId();
  const videoIdInputId = useId();
  const noteUrlInputId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const videoIdInputRef = useRef<HTMLInputElement>(null);
  const noteUrlInputRef = useRef<HTMLInputElement>(null);

  // /kioku と /docs の両方で Kioku タブをアクティブにする
  const isKiokuActive =
    location.pathname === "/kioku" || location.pathname.startsWith("/docs");

  useEffect(() => {
    // PWAのスタンドアローンモードを検出
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as { standalone: boolean }).standalone === true);
    setIsStandalone(isStandaloneMode);
  }, []);

  // Doc が選択されたときにタイトル入力欄にフォーカス
  useEffect(() => {
    if (selectedKiokuType === "doc" && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [selectedKiokuType]);

  // YouTube が選択されたときに videoID 入力欄にフォーカス
  useEffect(() => {
    if (selectedKiokuType === "youtube" && videoIdInputRef.current) {
      videoIdInputRef.current.focus();
    }
  }, [selectedKiokuType]);

  // Note が選択されたときに URL 入力欄にフォーカス
  useEffect(() => {
    if (selectedKiokuType === "note" && noteUrlInputRef.current) {
      noteUrlInputRef.current.focus();
    }
  }, [selectedKiokuType]);

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 ${
          isStandalone ? "pb-6" : ""
        }`}
      >
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex justify-around items-center h-15">
            <NavLink
              to="/"
              prefetch="render"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors ${
                  isActive
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <HomeIcon
                    className={`w-5 h-5 ${isActive ? "stroke-2" : "stroke-1.5"}`}
                  />
                  <span className="text-[10px] font-medium">Home</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/kioku"
              prefetch="render"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors ${
                  isActive || isKiokuActive
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <MoviesIcon
                    className={`w-5 h-5 ${isActive || isKiokuActive ? "stroke-2" : "stroke-1.5"}`}
                  />
                  <span className="text-[10px] font-medium">Kioku</span>
                </>
              )}
            </NavLink>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex flex-col items-center justify-center px-3 py-1 -mt-3"
            >
              <div className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-1.5 transition-colors hover:border-green-600 dark:hover:border-green-400">
                <PlusIcon className="w-5 h-5 stroke-2 text-gray-600 dark:text-gray-400" />
              </div>
            </button>

            <NavLink
              to="/todo"
              prefetch="render"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors ${
                  isActive
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <QuestionMarkIcon
                    className={`w-5 h-5 ${isActive ? "stroke-2" : "stroke-1.5"}`}
                  />
                  <span className="text-[10px] font-medium">Todo</span>
                </>
              )}
            </NavLink>

            <NavLink
              to="/you"
              prefetch="render"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors ${
                  isActive
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <UserIcon
                    className={`w-5 h-5 ${isActive ? "stroke-2" : "stroke-1.5"}`}
                  />
                  <span className="text-[10px] font-medium">You</span>
                </>
              )}
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Kioku 作成モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            {/* Kioku タイプ選択 */}
            {!selectedKiokuType && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelectedKiokuType("doc")}
                  className="w-full p-4 text-left border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-600 dark:hover:border-green-400 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    Doc
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    閉じたドキュメントやエッセイを作成
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKiokuType("note")}
                  className="w-full p-4 text-left border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-600 dark:hover:border-green-400 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    Note
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    note の記事を追加
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKiokuType("youtube")}
                  className="w-full p-4 text-left border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-600 dark:hover:border-green-400 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    YouTube
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    YouTube 動画を追加
                  </div>
                </button>
              </div>
            )}

            {/* Doc タイトル入力フォーム */}
            {selectedKiokuType === "doc" && (
              <Form
                method="post"
                action="/docs/create"
                onSubmit={() => {
                  setIsModalOpen(false);
                  setSelectedKiokuType(null);
                  setTitle("");
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor={titleId}
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      タイトル
                    </label>
                    <input
                      type="text"
                      id={titleId}
                      name="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      ref={titleInputRef}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="タイトルを入力"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedKiokuType(null);
                      setTitle("");
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg border border-gray-400 dark:border-gray-600 transition-colors duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !title.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg border border-blue-700 dark:border-blue-800 transition-colors duration-200"
                  >
                    {isSubmitting ? "作成中..." : "作成"}
                  </button>
                </div>
              </Form>
            )}

            {/* YouTube videoID 入力フォーム */}
            {selectedKiokuType === "youtube" && (
              <Form
                method="post"
                action="/youtube/create"
                onSubmit={() => {
                  setIsModalOpen(false);
                  setSelectedKiokuType(null);
                  setVideoId("");
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor={videoIdInputId}
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      YouTube Video ID
                    </label>
                    <input
                      type="text"
                      id={videoIdInputId}
                      name="id"
                      value={videoId}
                      onChange={(e) => setVideoId(e.target.value)}
                      ref={videoIdInputRef}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="例: dQw4w9WgXcQ"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      YouTube URL の v= 以降の文字列
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedKiokuType(null);
                      setVideoId("");
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg border border-gray-400 dark:border-gray-600 transition-colors duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !videoId.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg border border-blue-700 dark:border-blue-800 transition-colors duration-200"
                  >
                    {isSubmitting ? "追加中..." : "追加"}
                  </button>
                </div>
              </Form>
            )}

            {/* Note URL 入力フォーム */}
            {selectedKiokuType === "note" && (
              <Form
                method="post"
                action="/note/create"
                onSubmit={() => {
                  setIsModalOpen(false);
                  setSelectedKiokuType(null);
                  setNoteUrl("");
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor={noteUrlInputId}
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Note 記事 URL
                    </label>
                    <input
                      type="url"
                      id={noteUrlInputId}
                      name="noteUrl"
                      value={noteUrl}
                      onChange={(e) => setNoteUrl(e.target.value)}
                      ref={noteUrlInputRef}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="https://note.com/username/n/n1234567890ab"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Note 記事のURLを入力してください
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setSelectedKiokuType(null);
                      setNoteUrl("");
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg border border-gray-400 dark:border-gray-600 transition-colors duration-200"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !noteUrl.trim()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg border border-blue-700 dark:border-blue-800 transition-colors duration-200"
                  >
                    {isSubmitting ? "追加中..." : "追加"}
                  </button>
                </div>
              </Form>
            )}

            {/* Kioku タイプが選択されていない場合のキャンセルボタン */}
            {!selectedKiokuType && (
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedKiokuType(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg border border-gray-400 dark:border-gray-600 transition-colors duration-200"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
