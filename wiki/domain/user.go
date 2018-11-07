package domain

import (
	"errors"

	"github.com/jinzhu/gorm"
	"github.com/sirupsen/logrus"

	"github.com/hidelbreq/hidelberq-web/wiki/infrastructure"
)

type User struct {
	Username string
	Email    string
}

var ErrDbError = errors.New("Internal server error")
var ErrUsernameOrPasswordInvalid = errors.New("Username or passowrd is invalid.")

func (u *User) NewInfraUser() *infrastructure.User {
	return &infrastructure.User{
		Username: u.Username,
	}
}

func NewFromInfra(u *infrastructure.User) *User {
	return &User{
		Username: u.Username,
		Email:    "",
	}
}

func FindUser(db *gorm.DB, username, password string) (*User, error) {
	userRepository := infrastructure.NewUserRepository(db)
	user, err := userRepository.Find(username, password)
	if err != nil {
		logrus.Warn(err)
		return nil, ErrDbError
	}

	if user == nil || user.Username == "" {
		return nil, ErrUsernameOrPasswordInvalid
	}

	return NewFromInfra(user), nil
}
