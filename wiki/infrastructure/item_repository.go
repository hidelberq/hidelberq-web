package infrastructure

import (
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/hidelbreq/hidelberq-web/wiki/util"

	"github.com/hidelbreq/hidelberq-web/wiki/core"
	log "github.com/sirupsen/logrus"
	"gopkg.in/src-d/go-git.v4"
	"gopkg.in/src-d/go-git.v4/plumbing/object"
)

type Item struct {
	Path    string
	Title   string
	ModTime time.Time
	Text    string
	Data    []byte
}

func NewItem(text string) (*Item, error) {
	title, err := util.GetTitle(text)
	if err == util.ErrNoTitle {
		return nil, err
	}

	path := util.GetPath(title)
	return &Item{
		Path:    path,
		Title:   title,
		ModTime: time.Now(),
		Text:    text,
		Data:    []byte(text),
	}, nil
}

type ItemRepository struct {
	git *git.Repository
}

func NewItemRepository(g *git.Repository) *ItemRepository {
	return &ItemRepository{
		git: g,
	}
}

var (
	ErrAlreadyExistItem = errors.New("既に存在している項目です。")
	ErrInternalError    = errors.New("予期せぬエラーです")
)

func (ir *ItemRepository) Store(item *Item, user *User) error {
	_, ok := itemMap[item.Path]
	if ok {
		return ErrAlreadyExistItem
	}

	fileName := item.Path + ".md"
	filePath := filepath.Join(core.GetConfig().ItemPath, fileName)
	err := ioutil.WriteFile(filePath, item.Data, 0644)
	if err != nil {
		return err
	}

	w, err := ir.git.Worktree()
	if err != nil {
		return err
	}

	_, err = w.Add(fileName)
	if err != nil {
		return err
	}

	itemMap[item.Path] = item
	msg := "Add " + fileName
	_, err = w.Commit(msg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  user.Username,
			Email: user.Password,
			When:  time.Now(),
		},
	})
	return err
}

var itemMap map[string]*Item

func (ir *ItemRepository) Init() error {
	metaMap, err := ir.GetMetaMap(core.GetConfig().ItemPath)
	if err != nil {
		return err
	}

	files, err := ioutil.ReadDir(core.GetConfig().ItemPath)
	if err != nil {
		return err
	}

	itemMap = make(map[string]*Item)
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		s := strings.Split(file.Name(), ".md")
		if len(s) != 2 {
			continue
		}

		bytes, err := ioutil.ReadFile(filepath.Join(core.GetConfig().ItemPath, file.Name()))
		if err != nil {
			continue
		}

		item, err := NewItem(string(bytes))
		if err != nil {
			log.Warnln(err)
			continue
		}

		if lastUpdate, ok := metaMap[file.Name()]; ok {
			item.ModTime = lastUpdate
		} else {
			item.ModTime = file.ModTime()
		}
		itemMap[item.Path] = item
	}

	return nil
}

func (ir *ItemRepository) GetMetaMap(path string) (map[string]time.Time, error) {
	fileMap := make(map[string]time.Time)
	itr, err := ir.git.Log(&git.LogOptions{})
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

func (ir *ItemRepository) FindAll() []*Item {
	var items []*Item
	log.Infoln("findall items", itemMap)
	for _, item := range itemMap {
		log.Infoln(item.Path, item.ModTime)
		items = append(items, item)
	}

	log.Infoln("findall items", items)
	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.Unix() > items[j].ModTime.Unix()
	})

	return items
}

func (ir *ItemRepository) FindByPath(path string) *Item {
	return itemMap[path]
}

var (
	ErrNoTitle      = errors.New("タイトルがありません")
	ErrInvalidTitle = errors.New("# タイトル の形式でタイトルの指定がありません")
)

func (ir *ItemRepository) Update(i *Item, oldPath string, user *User) error {
	if i.Path == "" {
		return ErrNoTitle
	}

	_, ok := itemMap[oldPath]
	if !ok {
		return ErrInvalidTitle
	}

	data := []byte(i.Text)
	if oldPath != i.Path {
		oldFileName := oldPath + ".md"
		oldFilePath := filepath.Join(core.GetConfig().ItemPath, oldFileName)
		if err := os.Remove(oldFilePath); err != nil {
			return err
		}

		w, err := ir.git.Worktree()
		if err != nil {
			return err
		}
		if _, err := w.Add(oldFileName); err != nil {
			return err
		}
	}

	newFileName := i.Path + ".md"
	newFilePath := filepath.Join(core.GetConfig().ItemPath, newFileName)
	if err := ioutil.WriteFile(newFilePath, data, 0644); err != nil {
		return err
	}
	w, err := ir.git.Worktree()
	if err != nil {
		return err
	}

	if _, err := w.Add(newFileName); err != nil {
		log.Println("new", newFileName, err)
		return err
	}

	delete(itemMap, oldPath)
	itemMap[i.Path] = i

	_, err = w.Commit("Update "+newFileName, &git.CommitOptions{
		Author: &object.Signature{
			Name:  user.Username,
			Email: user.Password,
			When:  time.Now(),
		},
	})
	return err
}
