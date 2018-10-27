package core

import (
	"gopkg.in/src-d/go-git.v4"
)

var gitRepository *git.Repository

func InitGit() {
	g, err := git.PlainOpen(GetConfig().ItemPath)
	if err != nil {
		panic(err)
	}

	gitRepository = g
}

func GetGitRepository() *git.Repository {
	return gitRepository
}
