import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import {
	bookGroups,
	bookGroupMembers,
	books,
	bookMemberStatuses,
	personalBooks,
	userProfiles,
} from "~/db/schema";
import { generateGroupCode, generateMemberId } from "~/books/types";
import type { Route } from "./+types/api.books-seed";

// メンバー定義
const MEMBERS = [
	"hidelberq",
	"いのまり",
	"はっとり",
	"りょうま",
	"しゅんた",
	"えいすけ",
	"ゆき",
	"まさち",
] as const;

// 起票者名マッピング
function mapAddedBy(raw: string): string {
	if (!raw) return "hidelberq";
	if (raw === "ひで") return "hidelberq";
	if (raw.startsWith("服部")) return "はっとり";
	if (raw === "しゅんた") return "しゅんた";
	if (raw === "りょうま") return "りょうま";
	if (raw === "まさち") return "まさち";
	if (raw === "はっとり") return "はっとり";
	return raw;
}

// ジャンルマッピング
function mapGenre(raw: string): string | null {
	if (!raw) return null;
	const m: Record<string, string> = {
		日本思想: "哲学・思想",
		社会学: "社会学",
		現代思想: "哲学・思想",
		哲学: "哲学・思想",
		解説書: "その他",
		小説: "小説・文学",
		政治学: "社会学",
		詩: "小説・文学",
		戯曲: "小説・文学",
		歴史学: "歴史",
		生物学: "科学・数学",
		数学: "科学・数学",
		文学: "小説・文学",
		"文学 ": "小説・文学",
		新書: "その他",
		地質学: "科学・数学",
		自伝インタビュー: "ノンフィクション",
		美術: "芸術・デザイン",
		エッセイ: "エッセイ",
		科学: "科学・数学",
		古典: "小説・文学",
		日記: "エッセイ",
		日本文学: "小説・文学",
		児童文学絵本: "小説・文学",
		動物行動学: "科学・数学",
		分析哲学: "哲学・思想",
		現代哲学: "哲学・思想",
		演劇: "小説・文学",
		SF: "小説・文学",
		漫画: "漫画",
		IT: "技術・IT",
		"実用/音声": "その他",
		ビジネス: "ビジネス・経済",
		お笑い: "その他",
		スポーツ: "その他",
		"社会/政治": "社会学",
		生き方: "自己啓発",
		思考法: "自己啓発",
		対談: "その他",
		"漫画/歴史": "漫画",
		"漫画/エッセイ": "漫画",
		思想: "哲学・思想",
		"実用/思考": "自己啓発",
		心理学: "心理学",
	};
	return m[raw] ?? "その他";
}

// ステータスマッピング
function mapStatus(raw: string): { status: string; memo: string | null } | null {
	const t = raw.trim();
	if (!t) return null;
	if (t === "読了" || t === "了") return { status: "completed", memo: null };
	if (t === "一応読了") return { status: "completed", memo: "一応読了" };
	if (t === "読んだ面白かった") return { status: "completed", memo: "読んだ面白かった" };
	if (t === "持ってない") return { status: "wishlist", memo: null };
	if (t === "途中") return { status: "reading", memo: null };
	if (t === "未了") return { status: "reading", memo: null };
	if (t === "興味あり") return { status: "wishlist", memo: null };
	if (t.startsWith("挫折")) return { status: "abandoned", memo: t };
	return { status: "tsundoku", memo: t };
}

// 難易度パース (★5 → 5)
function parseDifficulty(raw: string): number | null {
	if (!raw) return null;
	const m = raw.match(/★(\d)/);
	return m ? Number(m[1]) : null;
}

// 本のデータ型
interface BookSeed {
	author: string;
	title: string;
	addedBy: string;
	prerequisiteText: string | null;
	genre: string | null;
	importanceLevel: string | null;
	difficultyLevel: number | null;
	videoUrl: string | null;
	description: string | null;
	memo: string | null;
	// メンバーステータス: [ひで, いのまり, はっとり, りょうま, しゅんた, えいすけ, ゆき]
	statuses: (string | null)[];
}

// 全データ
const SEED_DATA: BookSeed[] = [
	{
		author: "吉本隆明", title: "共同幻想論", addedBy: "ひで",
		prerequisiteText: "マルクス、フロイト（用語）", genre: "日本思想",
		importanceLevel: "B", difficultyLevel: 5,
		videoUrl: "https://www.youtube.com/watch?v=0kXQyCGrOQU",
		description: "【戦後思想の金字塔】国家・法・宗教は「共同の幻想」。対幻想。",
		memo: null,
		statuses: ["一応読了", null, "了", null, null, null, null],
	},
	{
		author: "宮台真司", title: "14歳からの社会学", addedBy: "ひで",
		prerequisiteText: "なし", genre: "社会学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: "https://www.youtube.com/watch?v=kYJzUqOQo2M",
		description: "【入門】「社会」の仕組みと「実存」。輝ける没落。",
		memo: null,
		statuses: ["読了", null, "了", null, null, null, null],
	},
	{
		author: "宮台真司", title: "日本の難点", addedBy: "ひで",
		prerequisiteText: "14歳からの社会学", genre: "社会学",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "日本社会の空洞化、共同体の崩壊、性愛。",
		memo: null,
		statuses: ["読了", null, null, null, null, null, null],
	},
	{
		author: "宮台真司", title: "終わりなき日常を生きろ", addedBy: "ひで",
		prerequisiteText: "なし", genre: "社会学",
		importanceLevel: "B", difficultyLevel: 3,
		videoUrl: null,
		description: "【90年代代表作】オウム後の社会で「まったり」生きる知恵。",
		memo: null,
		statuses: ["読了", null, "了", null, null, null, null],
	},
	{
		author: "R・ローティ", title: "偶然性・アイロニー・連帯", addedBy: "ひで",
		prerequisiteText: "ウィトゲンシュタイン", genre: "現代思想",
		importanceLevel: "S", difficultyLevel: 4,
		videoUrl: "https://www.youtube.com/watch?v=cbA7T2djeWA",
		description: "リベラリズムの再定義。絶対的真理を捨てて連帯する。",
		memo: null,
		statuses: ["挫折。。でもちゃんと読みたい！(えいすけさんすみません)", null, "了", null, null, null, null],
	},
	{
		author: "Q・メイヤスー", title: "有限性の後で", addedBy: "ひで",
		prerequisiteText: "カント（批判哲学）", genre: "現代思想",
		importanceLevel: "S", difficultyLevel: 5,
		videoUrl: "https://www.youtube.com/watch?v=3IB_dCpL2T8",
		description: "【超難解】人間不在でも世界はあるか？「相関主義」批判。",
		memo: null,
		statuses: ["持ってない", null, "了", null, null, null, null],
	},
	{
		author: "ウィトゲンシュタイン", title: "哲学探究", addedBy: "ひで",
		prerequisiteText: "論理哲学論考", genre: "哲学",
		importanceLevel: "S", difficultyLevel: 4,
		videoUrl: null,
		description: "【後期】言葉の意味は「使用」にある。言語ゲーム。ローティの元ネタ。",
		memo: null,
		statuses: ["持ってない", null, "了", null, null, null, null],
	},
	{
		author: "ウィトゲンシュタイン", title: "哲学宗教日記", addedBy: "ひで",
		prerequisiteText: "聖書（マタイ福音書等）", genre: "哲学",
		importanceLevel: "B", difficultyLevel: 3,
		videoUrl: null,
		description: "『論考』後の内面的な思索。罪、信仰、自己の虚栄心。",
		memo: null,
		statuses: ["持ってない", null, "了", null, null, null, null],
	},
	{
		author: "ニーチェ", title: "道徳の系譜学", addedBy: "ひで",
		prerequisiteText: "ショーペンハウアー", genre: "哲学",
		importanceLevel: "A", difficultyLevel: 4,
		videoUrl: "https://www.youtube.com/watch?v=9pCeOu2MPi0",
		description: "「善悪」の価値観は弱者の恨み（ルサンチマン）から捏造された。",
		memo: null,
		statuses: ["持ってない", null, null, null, null, null, null],
	},
	{
		author: "ニーチェ", title: "ツァラトゥストラ", addedBy: "ひで",
		prerequisiteText: "聖書（パロディ元）", genre: "哲学",
		importanceLevel: "S", difficultyLevel: 5,
		videoUrl: "https://www.youtube.com/watch?v=LGe4uQYl1TE",
		description: "【代表作】神は死んだ。超人。永劫回帰。詩的で難解。",
		memo: null,
		statuses: ["持ってない", null, null, null, null, null, null],
	},
	{
		author: "プラトン", title: "パイドン", addedBy: "ひで",
		prerequisiteText: "なし", genre: "哲学",
		importanceLevel: "A", difficultyLevel: 2,
		videoUrl: "https://www.youtube.com/watch?v=2NDPLIMdsj8",
		description: "魂の不死について。ソクラテス死刑当日の対話。",
		memo: null,
		statuses: ["持ってない", null, "了", "読了", null, null, null],
	},
	{
		author: "プラトン", title: "国家", addedBy: "ひで",
		prerequisiteText: "パイドン", genre: "哲学",
		importanceLevel: "S", difficultyLevel: 3,
		videoUrl: null,
		description: "正義とは何か。哲人王、イデア論、洞窟の比喩。",
		memo: null,
		statuses: ["持ってない", null, null, null, null, null, null],
	},
	{
		author: "スピノザ", title: "エチカ", addedBy: "ひで",
		prerequisiteText: "デカルト（省察）", genre: "哲学",
		importanceLevel: "S", difficultyLevel: 5,
		videoUrl: "https://www.youtube.com/watch?v=Xg0_2cXN_ls",
		description: "神＝自然。自由になるとは「必然性を理解すること」。",
		memo: null,
		statuses: ["持ってない", null, null, null, null, null, null],
	},
	{
		author: "千葉雅也", title: "現代思想入門", addedBy: "ひで",
		prerequisiteText: "なし", genre: "解説書",
		importanceLevel: "A", difficultyLevel: 1,
		videoUrl: null,
		description: "現代思想（デリダ〜メイヤスー）を一気通貫で理解する武器。",
		memo: "3人とも読んでた！",
		statuses: ["読了", null, "了", "読了", null, null, null],
	},
	{
		author: "村上春樹", title: "神の子どもたちはみな踊る", addedBy: "しゅんた",
		prerequisiteText: "なし", genre: "小説",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "シュミット", title: "政治的なものの概念", addedBy: "服部1",
		prerequisiteText: null, genre: "政治学",
		importanceLevel: "A", difficultyLevel: 3,
		videoUrl: null,
		description: "友敵",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "シュミット", title: "政治的神学", addedBy: "服部2",
		prerequisiteText: null, genre: "政治学",
		importanceLevel: "A", difficultyLevel: 3,
		videoUrl: null,
		description: "例外状態",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "クラリッセリスペクトル", title: "水の流れ", addedBy: "服部3",
		prerequisiteText: null, genre: "小説",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "ブラジルのヴァージニアウルフ",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "クラリッセリスペクトル", title: "星の時", addedBy: "服部4",
		prerequisiteText: null, genre: "小説",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "ブラジルのヴァージニアウルフ",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "オマルハイヤーム", title: "ルバイヤート", addedBy: "服部5",
		prerequisiteText: null, genre: "詩",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "四行詩集",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "アブ−・ヌワ−ス", title: "アラブ飲酒詩選", addedBy: "服部6",
		prerequisiteText: null, genre: "詩",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "イスラムと飲酒",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "モリエール", title: "タルチュフ", addedBy: "服部7",
		prerequisiteText: null, genre: "戯曲",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "フランス喜劇",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "モリエール", title: "人間ぎらい", addedBy: "服部8",
		prerequisiteText: null, genre: "戯曲",
		importanceLevel: "A", difficultyLevel: 1,
		videoUrl: null,
		description: "フランス喜劇",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "モリエール", title: "守銭奴", addedBy: "服部9",
		prerequisiteText: null, genre: "戯曲",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "フランス喜劇",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "アーレント", title: "人間の条件", addedBy: "服部10",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: "S", difficultyLevel: 5,
		videoUrl: null,
		description: "世界疎外",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "アーレント", title: "エルサレムのアイヒマン", addedBy: "服部11",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: "S", difficultyLevel: 5,
		videoUrl: null,
		description: "悪の凡庸",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "リュシアンフェーブル", title: "歴史のための闘い", addedBy: "服部12",
		prerequisiteText: null, genre: "歴史学",
		importanceLevel: "A", difficultyLevel: 3,
		videoUrl: null,
		description: "シュペングラーとトインビー",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ドーキンス", title: "利己的な遺伝子", addedBy: "服部13",
		prerequisiteText: null, genre: "生物学",
		importanceLevel: "S", difficultyLevel: 5,
		videoUrl: null,
		description: "お人よし→ごまかし→恨み",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ホワイトヘッド", title: "数学入門", addedBy: "服部14",
		prerequisiteText: null, genre: "数学",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "座標とベクトルの合成和",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ペトラルカ", title: "ルネサンス書簡集", addedBy: "服部15",
		prerequisiteText: null, genre: "文学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "嫉妬論",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ヴェルヌ", title: "十五少年漂流記", addedBy: "服部16",
		prerequisiteText: null, genre: "文学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "通過儀礼",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "大黒達也", title: "音楽する脳", addedBy: "服部17",
		prerequisiteText: null, genre: "新書",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "音楽脳のデータ解析",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "カイヨワ", title: "石が書く", addedBy: "服部18",
		prerequisiteText: null, genre: "地質学",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "タイトル通り",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "フアンアリアス", title: "パウロコエーリョ巡礼者の告白", addedBy: "服部19",
		prerequisiteText: null, genre: "自伝インタビュー",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "タイトル通り",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ダニエルアラス", title: "なにも見ていない: 名画をめぐる六つの冒険", addedBy: "服部20",
		prerequisiteText: null, genre: "美術",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "カタツムリと神",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "吉本隆明", title: "フランシス子へ", addedBy: "服部21",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "吉本遺作",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ハルノ宵子", title: "隆明だもの", addedBy: "服部22",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "家族から見た吉本隆明像",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "村上陽一郎", title: "文化としての科学 技術", addedBy: "服部23",
		prerequisiteText: null, genre: "科学",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "ノーベル賞と科学者",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "日高敏隆", title: "動物と人間の世界認識", addedBy: "服部24",
		prerequisiteText: null, genre: "科学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "環世界、日高敏隆はドーキンスの訳者",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "日高敏隆", title: "人間はどういう動物か", addedBy: "服部25",
		prerequisiteText: null, genre: "科学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "環世界",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ダンテ", title: "神曲全編", addedBy: "服部26",
		prerequisiteText: null, genre: "古典",
		importanceLevel: "S", difficultyLevel: 4,
		videoUrl: null,
		description: "地獄煉獄天国",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "アインシュタイン", title: "アインシュタインの旅行日記", addedBy: "服部27",
		prerequisiteText: null, genre: "日記",
		importanceLevel: "A", difficultyLevel: 1,
		videoUrl: null,
		description: "アインシュタインとシオニズム",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "井伏鱒二", title: "黒い雨", addedBy: "服部28",
		prerequisiteText: null, genre: "日本文学",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "戦争原爆",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "山川方夫", title: "夏の葬列", addedBy: "服部29",
		prerequisiteText: null, genre: "日本文学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "戦争",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "新美南吉", title: "手袋を買いに", addedBy: "服部30",
		prerequisiteText: null, genre: "児童文学絵本",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "信頼",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "アリスロバーツ", title: "飼いならす", addedBy: "服部31",
		prerequisiteText: null, genre: "動物行動学",
		importanceLevel: "A", difficultyLevel: 3,
		videoUrl: null,
		description: "家畜化",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ホグレーベ", title: "述語づけと発生", addedBy: "服部32",
		prerequisiteText: null, genre: "分析哲学",
		importanceLevel: "B", difficultyLevel: 3,
		videoUrl: null,
		description: "述語の普遍索引",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ドゥルーズ", title: "尽くされた", addedBy: "服部33",
		prerequisiteText: null, genre: "現代哲学",
		importanceLevel: "B", difficultyLevel: 2,
		videoUrl: null,
		description: "アガンベンのあとがき",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "福尾匠", title: "置き配的", addedBy: "服部34",
		prerequisiteText: null, genre: "現代哲学",
		importanceLevel: "B", difficultyLevel: 1,
		videoUrl: null,
		description: "本文中の換喩と隠喩を間違えている",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ベケット", title: "ゴドーを待ちながら", addedBy: "服部35",
		prerequisiteText: null, genre: "演劇",
		importanceLevel: "S", difficultyLevel: 2,
		videoUrl: null,
		description: "不条理劇",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "ハクスリー", title: "すばらしい新世界", addedBy: "服部36",
		prerequisiteText: "（とりあえず以上。）", genre: "SF",
		importanceLevel: "A", difficultyLevel: 1,
		videoUrl: null,
		description: "村上陽一郎の「文化として〜」フォードがもたらした青年の性道徳の変化",
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "菅野完", title: "陰謀論と排外主義", addedBy: "ひで",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "鈴木光司", title: "ユビキタス", addedBy: "ひで",
		prerequisiteText: null, genre: "小説",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "John Berryman、Albert Ziegler", title: "プロンプトエンジニアリング", addedBy: "ひで",
		prerequisiteText: null, genre: "IT",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "游 珮芸", title: "台湾の少年", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画/歴史",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【台湾の現代史】白色テロを生き延びた実在の人物を描くグラフィックノベル。自由、弾圧、教育。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "野村高文", title: "プロ目線のpodcastの作り方", addedBy: "ひで",
		prerequisiteText: null, genre: "実用/音声",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "今流行りつつあるポッドキャストの作り方のノウハウ。デイ・キャッチの担当だった人らしい。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "ピーター・ティール", title: "Zero to one", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【起業のバイブル】競争するな、独占せよ。Paypalマフィア、逆張り思考、垂直的進歩。",
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "JOGUMAN", title: "JOGUMAN ちっぽけなぼくらの存在理由", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画/エッセイ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "韓国発の人気恐竜キャラの癒やし本。日常の些細な悩み、肯定感、ゆるさ。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "尾田栄一郎", title: "One piece", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "令和ロマン くるま", title: "漫才過剰考察", addedBy: "ひで",
		prerequisiteText: null, genre: "お笑い",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "M-1王者が語る漫才のロジック。システム分析、ボケとツッコミの構造化。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "小学館", title: "小学館版 学習まんが 日本の歴史", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【定番】古代から現代までを通史で学ぶ。大河ドラマや政治の背景理解に最適。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "中島大輔", title: "山本由伸 常識を変える投球術", addedBy: "ひで",
		prerequisiteText: null, genre: "スポーツ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "ドジャース投手の身体操作論。脱力、やり投げ、既存のフォーム理論の否定。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "菅野完", title: "日本会議の研究", addedBy: "ひで",
		prerequisiteText: null, genre: "社会/政治",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "日本の右派組織「日本会議」の実態を暴いたベストセラー。草の根保守、改憲運動。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "つんく♂", title: "だから、生きる", addedBy: "ひで",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "喉頭がんで声を失った著者の手記。絶望からの再起、クリエイターとしての業、家族愛。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "Tak.", title: "アウトライン・プロセッシング入門", addedBy: "ひで",
		prerequisiteText: null, genre: "実用/思考",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【ひでさん必読】Workflowy等のアウトライナーを使って「考える」技術。シェイク、視点の切り替え。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "東 浩紀, 宮台 真司", title: "父として考える", addedBy: "ひで",
		prerequisiteText: null, genre: "対談",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "村上春樹", title: "回転木馬のデットヒート", addedBy: "ひで",
		prerequisiteText: null, genre: "小説",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "短編集。都会に生きる人々の空虚さと、そこにある奇妙なリアリティ。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "楠木建", title: "ストーリーとしての競争戦略", addedBy: "ひで",
		prerequisiteText: null, genre: "ビジネス",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【修正】「経営戦略」ではなく「競争戦略」。戦略は「違い」ではなく「つながり（ストーリー）」にある。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "岸本斉史", title: "BORUTO -NARUTO NEXT GENERATIONS-", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "ナルトの息子世代の物語。科学忍具、親殺し、新時代の忍のあり方。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "山口真一", title: "「みんな違ってみんないい」のか? ――相対主義と普遍主義の問題", addedBy: "ひで",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "相対主義の罠。多様性を認めるとはどういうことか、分断社会を超えるための論考。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "宮野公譜", title: "「問い」の立て方", addedBy: "ひで",
		prerequisiteText: null, genre: "思考法",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "正解を探すのではなく、良質な「問い」を見つける技術。探究学習、哲学対話。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "大澤真幸", title: "私の先生: 出会いから問いがはじまる", addedBy: "ひで",
		prerequisiteText: null, genre: "思想",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "安宅和人", title: "イシューからはじめよ", addedBy: "ひで",
		prerequisiteText: null, genre: "ビジネス",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【修正】解く前に「解くべき問題（イシュー）」を見極めろ。犬の道、バリューのある仕事。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "谷由唯", title: "人生のレールを外れる衝動のみつけかた", addedBy: "ひで",
		prerequisiteText: null, genre: "生き方",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【修正】違和感を無視しない。ドロップアウトではなく「自分固有の生」を生きるための指針。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "魚豊", title: "チ。-地球の運動について-", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "地動説に命を懸けた人々。知性への信頼、ドグマへの抵抗、歴史の継承。",
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "大場つぐみ", title: "バクマン。", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: "【修正】漫画家を目指す高校生たちの青春。ジャンプシステム、アンケート至上主義との戦い。",
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "ようこそ!FACT(東京S区第二支部)へ", title: "ようこそ！FACT", addedBy: "ひで",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	// はっとり起票（著者不明の本）
	{
		author: "不明", title: "火の鳥", addedBy: "はっとり",
		prerequisiteText: null, genre: "漫画",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "未了", null, null, null, null],
	},
	{
		author: "不明", title: "心的現象論", addedBy: "はっとり",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "不明", title: "ファウスト", addedBy: "はっとり",
		prerequisiteText: null, genre: "文学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "不明", title: "人生の短さについて 他2篇", addedBy: "はっとり",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "不明", title: "知覚の扉", addedBy: "はっとり",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	// まさち起票
	{
		author: "まさち", title: "社会学史", addedBy: "まさち",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	// 見田宗介シリーズ（えいすけ了）
	{
		author: "見田宗介", title: "社会学入門", addedBy: "えいすけ",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: "A", difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "見田宗介", title: "気流", addedBy: "えいすけ",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: "A", difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "見田宗介", title: "自我の起原", addedBy: "えいすけ",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: "A", difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "見田宗介", title: "まなざしの地獄", addedBy: "えいすけ",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: "A", difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "見田宗介", title: "現代社会の存立構造", addedBy: "えいすけ",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: "A", difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "見田宗介", title: "白いお城と花咲く野原", addedBy: "えいすけ",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: "A", difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, "了", null],
	},
	{
		author: "不明", title: "時間の比較社会学", addedBy: "はっとり",
		prerequisiteText: null, genre: "社会学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "不明", title: "美しい道を静かに歩く", addedBy: "はっとり",
		prerequisiteText: null, genre: null,
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	{
		author: "不明", title: "宮沢賢治", addedBy: "はっとり",
		prerequisiteText: null, genre: "小説",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, "了", null, null, null, null],
	},
	// 若林正恭
	{
		author: "若林正恭", title: "青天", addedBy: "hidelberq",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "若林正恭", title: "キューバの本", addedBy: "hidelberq",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "若林正恭", title: "社会人大学人見知り学部卒業見込み", addedBy: "hidelberq",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "若林正恭", title: "ナナメの夕暮れ", addedBy: "hidelberq",
		prerequisiteText: null, genre: "エッセイ",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	// カウンセリング系
	{
		author: "不明", title: "AIカウンセリング", addedBy: "hidelberq",
		prerequisiteText: null, genre: "心理学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "不明", title: "カウンセリングとは何か", addedBy: "hidelberq",
		prerequisiteText: null, genre: "心理学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: ["途中", null, null, null, null, "興味あり", null],
	},
	// りょうま起票
	{
		author: "エルヴェ・ボーシェーヌ", title: "精神病理学の歴史 -精神医学の大いなる流れ", addedBy: "りょうま",
		prerequisiteText: null, genre: "心理学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, "読んだ面白かった", null, null, null],
	},
	{
		author: "ジュディス・L・ハーマン", title: "心的外傷と回復", addedBy: "りょうま",
		prerequisiteText: null, genre: "心理学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	// その他
	{
		author: "不明", title: "悪意の手記", addedBy: "hidelberq",
		prerequisiteText: null, genre: "小説",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "不明", title: "世界は贈与でできている", addedBy: "hidelberq",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
	{
		author: "不明", title: "利他ケア、傷", addedBy: "hidelberq",
		prerequisiteText: null, genre: "哲学",
		importanceLevel: null, difficultyLevel: null,
		videoUrl: null,
		description: null,
		memo: null,
		statuses: [null, null, null, null, null, null, null],
	},
];

export async function action({ request, context }: Route.ActionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const db = drizzle(context.cloudflare.env.DB);
	const groupName = "すみっこ塾";

	// 既存グループチェック
	const [existingGroup] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.name, groupName))
		.limit(1);

	if (existingGroup) {
		return Response.json({
			error: "グループ「すみっこ塾」は既に存在します",
			groupCode: existingGroup.groupCode,
		}, { status: 409 });
	}

	// グループ作成
	const groupCode = generateGroupCode();
	const creatorMemberId = generateMemberId();

	const [group] = await db
		.insert(bookGroups)
		.values({
			groupCode,
			name: groupName,
			description: "すみっこ塾の読書リスト",
			createdByMemberId: creatorMemberId,
		})
		.returning();

	// メンバー作成
	const memberIds: Record<string, string> = {};
	const memberNames = [...MEMBERS];

	for (const name of memberNames) {
		const memberId = name === "hidelberq" ? creatorMemberId : generateMemberId();
		memberIds[name] = memberId;
		await db.insert(bookGroupMembers).values({
			groupId: group.id,
			memberId,
			displayName: name,
		});
	}

	// 本を挿入
	let insertedBooks = 0;
	let insertedStatuses = 0;

	for (const bookData of SEED_DATA) {
		const addedByName = mapAddedBy(bookData.addedBy);
		const addedByMemberId = memberIds[addedByName] ?? memberIds["hidelberq"];

		const [book] = await db
			.insert(books)
			.values({
				groupId: group.id,
				title: bookData.title,
				author: bookData.author,
				genre: mapGenre(bookData.genre ?? ""),
				description: bookData.description,
				videoUrl: bookData.videoUrl,
				prerequisiteText: bookData.prerequisiteText,
				importanceLevel: bookData.importanceLevel,
				difficultyLevel: bookData.difficultyLevel,
				memo: bookData.memo,
				addedByMemberId,
				addedByName,
			})
			.returning();

		insertedBooks++;

		// メンバーステータス
		// statuses の順: [ひで=hidelberq, いのまり, はっとり, りょうま, しゅんた, えいすけ, ゆき]
		const statusMembers = ["hidelberq", "いのまり", "はっとり", "りょうま", "しゅんた", "えいすけ", "ゆき"];
		for (let i = 0; i < statusMembers.length; i++) {
			const raw = bookData.statuses[i];
			if (!raw) continue;
			const mapped = mapStatus(raw);
			if (!mapped) continue;
			const memberName = statusMembers[i];
			const memberId = memberIds[memberName];
			if (!memberId) continue;

			await db.insert(bookMemberStatuses).values({
				bookId: book.id,
				memberId,
				memberName,
				status: mapped.status,
				memo: mapped.memo,
			});
			insertedStatuses++;
		}
	}

	// プロフィールも自動作成
	const profileResults = await seedProfiles(db, memberIds);

	return Response.json({
		success: true,
		groupCode,
		insertedBooks,
		insertedStatuses,
		members: Object.keys(memberIds).length,
		profiles: profileResults,
	});
}

// メンバーごとの仮プロフィール設定
const PROFILE_PRESETS: Record<string, { emoji: string; bio: string; genre: string }> = {
	hidelberq: {
		emoji: "🧠",
		bio: "Web開発と哲学が好き。宮台真司、吉本隆明あたりが原点。",
		genre: "哲学・思想",
	},
	いのまり: {
		emoji: "🌱",
		bio: "すみっこ塾メンバー。読書の幅を広げたい。",
		genre: "",
	},
	はっとり: {
		emoji: "📕",
		bio: "多読派。古典から現代思想、文学、科学まで幅広く。モリエール推し。",
		genre: "小説・文学",
	},
	りょうま: {
		emoji: "💡",
		bio: "心理学・精神医学に関心あり。プラトンも読む。",
		genre: "心理学",
	},
	しゅんた: {
		emoji: "📖",
		bio: "村上春樹好き。",
		genre: "小説・文学",
	},
	えいすけ: {
		emoji: "🔬",
		bio: "見田宗介を全部読んだ。社会学と思想系。",
		genre: "社会学",
	},
	ゆき: {
		emoji: "📗",
		bio: "すみっこ塾メンバー。",
		genre: "",
	},
	まさち: {
		emoji: "📘",
		bio: "社会学に興味あり。",
		genre: "社会学",
	},
};

async function seedProfiles(
	db: ReturnType<typeof drizzle>,
	knownMemberIds?: Record<string, string>,
) {
	// 1. bookGroupMembers から全ユニークユーザーを取得
	const groupMembers = await db
		.select({
			memberId: bookGroupMembers.memberId,
			displayName: bookGroupMembers.displayName,
		})
		.from(bookGroupMembers);

	// 2. personalBooks から全ユニークユーザーを取得
	const personalBookUsers = await db
		.select({
			memberId: personalBooks.memberId,
			displayName: personalBooks.memberName,
		})
		.from(personalBooks);

	// 3. マージして重複排除（memberId ベース）
	const userMap = new Map<string, string>();
	for (const m of groupMembers) {
		if (!userMap.has(m.memberId)) {
			userMap.set(m.memberId, m.displayName);
		}
	}
	for (const p of personalBookUsers) {
		if (!userMap.has(p.memberId)) {
			userMap.set(p.memberId, p.displayName);
		}
	}

	// knownMemberIds がある場合はそちらも追加
	if (knownMemberIds) {
		for (const [name, id] of Object.entries(knownMemberIds)) {
			if (!userMap.has(id)) {
				userMap.set(id, name);
			}
		}
	}

	// 4. 既存プロフィールを取得
	const existingProfiles = await db
		.select({ memberId: userProfiles.memberId })
		.from(userProfiles);
	const existingIds = new Set(existingProfiles.map((p) => p.memberId));

	// 5. プロフィール作成
	let created = 0;
	let skipped = 0;

	for (const [memberId, displayName] of userMap.entries()) {
		if (existingIds.has(memberId)) {
			skipped++;
			continue;
		}

		const preset = PROFILE_PRESETS[displayName];
		await db.insert(userProfiles).values({
			memberId,
			displayName,
			bio: preset?.bio ?? null,
			favoriteGenre: preset?.genre || null,
			avatarEmoji: preset?.emoji ?? "📚",
			isPublic: true,
		});
		created++;
	}

	return { created, skipped, total: userMap.size };
}

// GET: プロフィールのみ一括作成
export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	if (url.searchParams.get("action") !== "seed-profiles") {
		return Response.json({ error: "Use ?action=seed-profiles" }, { status: 400 });
	}

	const db = drizzle(context.cloudflare.env.DB);
	const results = await seedProfiles(db);

	return Response.json({
		success: true,
		profiles: results,
	});
}
