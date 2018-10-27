package core

import (
	"encoding/json"
	"os"
)

type Config struct {
	Addr     string `json:"addr"`
	ItemPath string `json:"item_path"`
	GitURL   string `json:"git_url"`
}

var cnf Config

func InitConfig(path string) {
	file, err := os.Open(path)
	if err != nil {
		panic(err)
	}

	defer file.Close()
	decoder := json.NewDecoder(file)
	err = decoder.Decode(&cnf)
	if err != nil {
		panic(err)
	}
}

func GetConfig() *Config {
	return &cnf
}
