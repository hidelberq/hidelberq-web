package domain

import (
	"fmt"
	"log"
	"time"

	"github.com/hidelbreq/hidelberq-web/wiki/core"

	"github.com/hidelbreq/hidelberq-web/wiki/infrastructure"

	"github.com/hidelbreq/hidelberq-web/wiki/util"
)

type Item struct {
	Path    string
	Title   string
	ModTime time.Time
	Text    string
	Data    []byte
}

const SumUpLength = 200

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

func (i *Item) GetURL() string {
	return fmt.Sprintf("%swiki/%s", core.GetConfig().Domain, i.Title)
}

func (i *Item) GetSumUp() string {
	if len(i.Text) > SumUpLength {
		return i.Text[0:SumUpLength]
	}
	return i.Text
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

func NewItemFromRepository(i *infrastructure.Item) *Item {
	if i == nil {
		return nil
	}

	return &Item{
		Path:    i.Path,
		Title:   i.Title,
		ModTime: i.ModTime,
		Text:    i.Text,
		Data:    i.Data,
	}
}

func ItemFindByPath(path string) *Item {
	ir := infrastructure.NewItemRepository(core.GetGitRepository())
	item := ir.FindByPath(path)
	return NewItemFromRepository(item)
}

func ItemUpdate(item *Item, oldPath string, user *User) error {
	ir := infrastructure.NewItemRepository(core.GetGitRepository())
	err := ir.Update(item.NewInfraItem(), oldPath, user.NewInfraUser())

	if err != nil {
		log.Print("Failed ItemUpdate", err)
		if err == infrastructure.ErrInvalidTitle {
			return ErrInvalidTitle
		} else if err == infrastructure.ErrAlreadyExistItem {
			return ErrInvalidTitle
		}
		return ErrInternalError
	}

	return nil
}

func (i *Item) NewInfraItem() *infrastructure.Item {
	return &infrastructure.Item{
		Path:    i.Path,
		Title:   i.Title,
		ModTime: time.Now(),
		Text:    i.Text,
		Data:    i.Data,
	}
}

func AddItem(item *Item, user *User) error {
	ir := infrastructure.NewItemRepository(core.GetGitRepository())
	return ir.Store(item.NewInfraItem(), user.NewInfraUser())
}

func ItemFindAll() []*Item {
	ir := infrastructure.NewItemRepository(core.GetGitRepository())
	items := ir.FindAll()
	var is []*Item
	for _, item := range items {
		i := NewItemFromRepository(item)
		if i == nil {
			continue
		}
		is = append(is, i)
	}
	return is
}
