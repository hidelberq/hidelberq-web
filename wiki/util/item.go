package util

import (
	"errors"
	"strings"
)

var ErrNoTitle = errors.New("タイトルがありません")

func GetTitle(markdown string) (string, error) {
	title := strings.TrimPrefix(markdown, "# ")
	split := strings.Split(title, "\r\n")
	if len(split) == 0 || split[0] == "" {
		return "", ErrNoTitle
	}

	return split[0], nil
}

func GetPath(title string) string {
	return strings.Replace(title, " ", "-", -1)
}
