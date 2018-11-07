package application

import (
	"fmt"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
)

func ItemAdd(item *domain.Item, user *domain.User) error {
	err := domain.AddItem(item, user)
	if err != nil {
		return err
	}

	notiText := fmt.Sprintf(
		"hidel-wiki に新しい項目が追加されました。<%s|%s>, by %s, %s",
		item.GetURL(),
		item.Title,
		user.Username,
		item.GetSumUp())
	domain.Send(notiText)
	return nil
}

func ItemUpdate(item *domain.Item, oldPath string, user *domain.User) error {
	err := domain.ItemUpdate(item, oldPath, user)
	if err != nil {
		return err
	}

	notiText := fmt.Sprintf(
		"hidel-wiki の項目が更新されました。<%s|%s>, by %s",
		item.GetURL(),
		item.Title,
		user.Username)
	domain.Send(notiText)
	return nil
}

func ItemFindByPath(path string) *domain.Item {
	return domain.ItemFindByPath(path)
}

func ItemFindAll() []*domain.Item {
	return domain.ItemFindAll()
}
