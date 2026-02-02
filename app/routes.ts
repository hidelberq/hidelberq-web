import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("debug", "routes/debug.tsx"),
	route("shogi", "routes/shogi.tsx"),
] satisfies RouteConfig;
