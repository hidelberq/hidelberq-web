package domain

import (
	"github.com/hidelbreq/hidelberq-web/wiki/core"
	"github.com/hidelbreq/hidelberq-web/wiki/infrastructure"
	"github.com/sirupsen/logrus"
)

func Send(text string) error {
	nr := infrastructure.NewNotiRepository(core.GetConfig().SlackIncomingWebhookURL)
	err := nr.Send(text)
	if err != nil {
		logrus.Warn(err)
		return ErrInternalError
	}

	return nil
}
