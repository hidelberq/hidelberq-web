package usecase

import "github.com/hidelbreq/hidelberq-web/wiki/domain"

type ItemInteractor struct {
	ItemRepository ItemRepository
}

func (i *ItemInteractor) Add(item *domain.Item, user *domain.User) error {
	return i.ItemRepository.Store(item, user)
}

func (i *ItemInteractor) Update(item *domain.Item, oldPath string, user *domain.User) error {
	return i.ItemRepository.Update(item, oldPath, user)
}

func (i *ItemInteractor) FundByPath(path string) *domain.Item {
	return i.ItemRepository.FindByPath(path)
}

func (i *ItemInteractor) FindAll() []*domain.Item {
	return i.ItemRepository.FindAll()
}
