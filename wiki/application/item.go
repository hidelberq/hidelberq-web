package application

import "github.com/hidelbreq/hidelberq-web/wiki/domain"

func ItemAdd(item *domain.Item, user *domain.User) error {
	return domain.AddItem(item, user)
}

func ItemUpdate(item *domain.Item, oldPath string, user *domain.User) error {
	return domain.ItemUpdate(item, oldPath, user)
}

func ItemFindByPath(path string) *domain.Item {
	return domain.ItemFindByPath(path)
}

func ItemFindAll() []*domain.Item {
	return domain.ItemFindAll()
}
