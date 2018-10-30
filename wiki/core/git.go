package core

import (
	"github.com/sirupsen/logrus"
	"gopkg.in/src-d/go-git.v4"
)

var gitRepository *git.Repository

func InitGit() {
	g, err := git.PlainOpen(GetConfig().ItemPath)
	if err != nil {
		logrus.Fatal("repository dose not exist", GetConfig().ItemPath)
		panic(err)
	}

	gitRepository = g
}

func GetGitRepository() *git.Repository {
	return gitRepository
}
