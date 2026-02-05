import { loadDefaultJapaneseParser, type Parser } from "budoux";

// 文末表現パターン（句点を追加）- 明確な文末のみ
// 順序が重要: 長いパターンを先に（「んですね」を「です」より先に）
const sentenceEndPatterns = [
	// 「んです」系（最も優先）
	"んですね",
	"んですよ",
	"んですか",
	"んです",
	"のですね",
	"のですよ",
	"のですか",
	"のです",
	// 丁寧語・敬語の文末
	"ですね",
	"ですよ",
	"ですか",
	"でした",
	"ません",
	"ました",
	"ますね",
	"ますよ",
	"ますか",
	"ございます",
	"いたします",
	"です",
	"ます",
];

// 句読点追加ロジック - 正規表現で直接置換
export function addPunctuation(text: string, _parser?: Parser): string {
	// 既に句読点がある場合はスキップ
	if (/[。、！？!?]/.test(text)) {
		return text;
	}

	let result = text;

	// 各文末パターンの後に句点を追加（既に句点がない場合）
	for (const pattern of sentenceEndPatterns) {
		// パターンの後に句点がなく、日本語文字または行末が続く場合に句点を追加
		// ただし、「です」の後に「ね」「よ」「か」が続く場合はスキップ（「ですね」等として別途処理）
		// 「ます」の後に「ね」「よ」「か」が続く場合もスキップ
		let negLookahead = "";
		if (pattern === "です" || pattern === "ます" || pattern === "んです" || pattern === "のです") {
			negLookahead = "(?![ねよか])";
		}

		const regex = new RegExp(
			`(${pattern})${negLookahead}(?!。)([\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]|$)`,
			"g",
		);
		result = result.replace(regex, "$1。$2");
	}

	return result;
}

// デバッグ用: budouxの分割結果を確認
export function debugSegments(text: string, parser: Parser): string[] {
	return parser.parse(text);
}

// parserのファクトリ
export function createParser(): Parser {
	return loadDefaultJapaneseParser();
}
