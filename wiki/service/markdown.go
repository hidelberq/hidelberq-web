package service

import (
	"strings"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	"github.com/hidelbreq/hidelberq-web/wiki/repository"
)

type MarkdownService struct {
	gitRepository      *repository.GitRepository
	markdownRepository *repository.MarkdownRepository
}

func NewMarkService(
	gitRepository *repository.GitRepository,
	markdownRepository *repository.MarkdownRepository,
) *MarkdownService {
	return &MarkdownService{
		gitRepository:      gitRepository,
		markdownRepository: markdownRepository,
	}
}

func (m *MarkdownService) findAll() (map[string]*domain.Item, error) {
	mds, err := m.markdownRepository.GetAll()
	if err != nil {
		return nil, err
	}

	markdownMap := make(map[string]*domain.Item)
	for _, md := range mds {
		m := domain.NewItem(md)
		markdownMap[m.Title] = m
	}

	return markdownMap, nil
}

func (m *MarkdownService) Create(title string, data []byte) error {
	path := strings.Replace(title, " ", "-", -1)
	if err := m.markdownRepository.Create(path, data); err != nil {
		return err
	}

	return m.gitRepository.AddAndCommit(path+".md", "temp", "user", "ma@il")
}
