package infrastructure

import (
	"time"

	log "github.com/sirupsen/logrus"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	"gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

type GitHandler struct {
	Repository *git.Repository
}

func NewGitHandler(dirPath string) *GitHandler {
	r, err := git.PlainOpen(dirPath)
	if err != nil {
		panic(err)
	}

	return &GitHandler{r}
}

func (h *GitHandler) Add(path string) error {
	w, err := h.Repository.Worktree()
	if err != nil {
		return err
	}

	_, err = w.Add(path)
	return err
}

func (h *GitHandler) Commit(msg string, user *domain.User, when time.Time) error {
	w, err := h.Repository.Worktree()
	if err != nil {
		return err
	}

	_, err = w.Commit(msg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  user.Name,
			Email: user.Email,
			When:  when,
		},
	})
	return err
}

func (h *GitHandler) GetMetaMap(path string) (map[string]time.Time, error) {
	fileMap := make(map[string]time.Time)
	itr, err := h.Repository.Log(&git.LogOptions{})
	if err != nil {
		return nil, err
	}

	err = itr.ForEach(func(commit *object.Commit) error {
		log.Infoln("commit", commit.Message)

		stats, err := commit.Stats()
		if err != nil {
			return err
		}

		for _, stat := range stats {
			log.Infoln(stat.Name)
			_, ok := fileMap[stat.Name]
			if ok {
				continue
			}

			fileMap[stat.Name] = commit.Committer.When
		}
		return nil
	})

	log.Infoln(fileMap, err)
	return fileMap, nil
}
