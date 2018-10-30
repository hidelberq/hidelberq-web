package core

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Addr                    string
	Domain                  string
	ItemPath                string
	SlackIncomingWebhookURL string
}

var cnf Config

func InitConfig() {
	if os.Getenv("DOCKER") == "" {
		godotenv.Load()
	}

	cnf = Config{
		Addr:                    os.Getenv("ADDR"),
		Domain:                  os.Getenv("DOMAIN"),
		ItemPath:                os.Getenv("ITEM_PATH"),
		SlackIncomingWebhookURL: os.Getenv("SLACK_INCOMING_WEBHOOK_URL"),
	}

	if cnf.Addr == "" ||
		cnf.Domain == "" ||
		cnf.ItemPath == "" ||
		cnf.SlackIncomingWebhookURL == "" {
		panic(cnf)
	}
}

func GetConfig() *Config {
	return &cnf
}
