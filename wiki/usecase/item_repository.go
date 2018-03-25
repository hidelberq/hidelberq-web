package usecase

import "github.com/hidelbreq/hidelberq-web/wiki/domain"

type ItemRepository interface {
	Store(item *domain.Item, user *domain.User) error
	Update(new *domain.Item, oldPath string, user *domain.User) error
	FindByPath(path string) *domain.Item
	FindAll() []*domain.Item
}
