package domain

import "github.com/hidelbreq/hidelberq-web/wiki/infrastructure"

type User struct {
	Name  string
	Email string
}

func (u *User) NewInfraUser() *infrastructure.User {
	return &infrastructure.User{
		Name:  u.Name,
		Email: u.Email,
	}
}
