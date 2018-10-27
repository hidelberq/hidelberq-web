package domain

type ItemRepository interface {
	Store(item *Item, user *User) error
	Update(new *Item, oldPath string, user *User) error
	FindByPath(path string) *Item
	FindAll() []*Item
}
