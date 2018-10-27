package domain

import "errors"

var ErrNoTitle = errors.New("タイトルがありません")
var ErrInvalidTitle = errors.New("タイトルに使用できない文字が含まれています。")
var ErrInternalError = errors.New("予期せぬエラーです。")
