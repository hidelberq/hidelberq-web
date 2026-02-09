import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("aitter", "routes/aitter.tsx"),
	route("debug", "routes/debug.tsx"),
	route("hero-image/:date", "routes/hero-image.ts"),
	route("whitespace-remover", "routes/whitespace-remover.tsx"),
	route("shogi", "routes/shogi.tsx"),
	route("shogi/local", "routes/shogi.local.tsx"),
	route("shogi/minishogi/local", "routes/shogi.minishogi-local.tsx"),
	route("shogi/minishogi/game/:gameId", "routes/shogi.minishogi-game.tsx"),
	route("shogi/game/:gameId", "routes/shogi.game.tsx"),
	route("books", "routes/books.tsx"),
	route("books/:groupCode", "routes/books.group.tsx"),
	route("books/:groupCode/add", "routes/books.add.tsx"),
	route("books/:groupCode/book/:bookId", "routes/books.detail.tsx"),
	route("api/activity", "routes/api.activity.ts"),
	route("api/books/search", "routes/api.books-search.ts"),
] satisfies RouteConfig;
