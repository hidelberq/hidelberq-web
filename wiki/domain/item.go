package domain

import (
	"time"

	"github.com/hidelbreq/hidelberq-web/wiki/util"
)

type Item struct {
	Path    string
	Title   string
	ModTime time.Time
	Text    string
	Data    []byte
}

func NewItem(text string) (*Item, error) {
	title, err := util.GetTitle(text)
	if err == util.ErrNoTitle {
		return nil, err
	}

	path := util.GetPath(title)
	return &Item{
		Path:    path,
		Title:   title,
		ModTime: time.Now(),
		Text:    text,
		Data:    []byte(text),
	}, nil
}

func NewItemWithTime(text string, time time.Time) (*Item, error) {
	title, err := util.GetTitle(text)
	if err == util.ErrNoTitle {
		return nil, err
	}

	path := util.GetPath(title)
	return &Item{
		Path:    path,
		Title:   title,
		ModTime: time,
		Text:    text,
		Data:    []byte(text),
	}, nil
}
