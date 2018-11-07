package core

import (
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/mysql"
	"github.com/sirupsen/logrus"
)

var db *gorm.DB

func InitDB() *gorm.DB {
	database, err := gorm.Open("mysql", GetConfig().MysqlArg)
	if err != nil {
		logrus.Fatal("failed to connect mysql: ", GetConfig().MysqlArg, err)
		return nil
	}

	database.LogMode(true)
	db = database
	return db
}

func GetDB() *gorm.DB {
	return db
}
