package database

import (
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/hidelbreq/hidelberq-web/wiki/config"
	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	log "github.com/sirupsen/logrus"
)

type ItemRepository struct {
	GitHandler
	Cnf *config.Config
}

var (
	ErrAlreadyExistItem = errors.New("既に存在している項目です。")
)

func (ir *ItemRepository) Store(item *domain.Item, user *domain.User) error {
	_, ok := itemMap[item.Path]
	if ok {
		return ErrAlreadyExistItem
	}

	fileName := item.Path + ".md"
	filePath := filepath.Join(ir.Cnf.ItemPath, fileName)
	err := ioutil.WriteFile(filePath, item.Data, 0644)
	if err != nil {
		return err
	}

	err = ir.Add(fileName)
	if err != nil {
		return err
	}

	itemMap[item.Path] = item
	return ir.Commit("Add "+fileName, user, time.Now())
}

var itemMap map[string]*domain.Item

func (ir *ItemRepository) Init() error {
	cnf := ir.Cnf
	metaMap, err := ir.GetMetaMap(cnf.ItemPath)
	if err != nil {
		return err
	}

	files, err := ioutil.ReadDir(cnf.ItemPath)
	if err != nil {
		return err
	}

	itemMap = make(map[string]*domain.Item)
	for _, file := range files {
		if file.IsDir() {
			continue
		}

		s := strings.Split(file.Name(), ".md")
		if len(s) != 2 {
			continue
		}

		bytes, err := ioutil.ReadFile(filepath.Join(cnf.ItemPath, file.Name()))
		if err != nil {
			continue
		}

		item, err := domain.NewItem(string(bytes))
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

func (ir *ItemRepository) FindAll() []*domain.Item {
	var items []*domain.Item
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

func (ir *ItemRepository) FindByPath(path string) *domain.Item {
	return itemMap[path]
}

var (
	ErrNoTitle      = errors.New("タイトルがありません")
	ErrInvalidTitle = errors.New("# タイトル の形式でタイトルの指定がありません")
)

func (ir *ItemRepository) Update(new *domain.Item, oldPath string, user *domain.User) error {
	if new.Path == "" {
		return ErrNoTitle
	}

	_, ok := itemMap[oldPath]
	if !ok {
		return ErrInvalidTitle
	}

	data := []byte(new.Text)
	oldFilePath := filepath.Join(ir.Cnf.ItemPath, oldPath+".md")
	if err := os.Remove(oldFilePath); err != nil {
		return err
	}

	newFilePath := filepath.Join(ir.Cnf.ItemPath, new.Path+".md")
	if err := ioutil.WriteFile(newFilePath, data, 775); err != nil {
		return err
	}

	delete(itemMap, oldPath)
	itemMap[new.Path] = new
	return ir.Commit("Update "+new.Path+".md", user, time.Now())
}
