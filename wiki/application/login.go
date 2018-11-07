package application

import (
	"github.com/hidelbreq/hidelberq-web/wiki/core"
	"github.com/hidelbreq/hidelberq-web/wiki/domain"
)

func Login(username, password string) (*domain.User, error) {
	db := core.GetDB()
	user, err := domain.FindUser(db, username, password)
	if err != nil {
		return nil, err
	}

	return user, nil
}
