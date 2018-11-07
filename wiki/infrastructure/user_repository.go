package infrastructure

import "github.com/jinzhu/gorm"

type User struct {
	Username string
	Password string
}

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{
		db: db,
	}
}

func (r *UserRepository) Find(username, password string) (*User, error) {
	u := &User{}
	r.db.Where("username = ? and password = ?", username, password).First(u)
	return u, nil
}
