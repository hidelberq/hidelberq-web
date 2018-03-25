package database

import (
	"time"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
)

type GitHandler interface {
	Add(path string) error
	Commit(msg string, user *domain.User, when time.Time) error
	GetMetaMap(path string) (map[string]time.Time, error)
}
