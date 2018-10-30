package infrastructure

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
)

type NotiRepository struct {
	URL string
}

func NewNotiRepository(url string) *NotiRepository {
	return &NotiRepository{
		URL: url,
	}
}

var ErrSlackResponseError = errors.New("slack response invalid")

func (nr *NotiRepository) Send(text string) error {
	body := struct {
		Text string `json:"text"`
	}{
		Text: text,
	}
	byteBody, err := json.Marshal(body)
	if err != nil {
		return err
	}

	resp, err := http.Post(nr.URL, "application/json", bytes.NewBuffer(byteBody))
	if err != nil {
		return err
	}

	defer resp.Body.Close()
	respBodyByte, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if string(respBodyByte) != "ok" {
		return ErrSlackResponseError
	}

	return nil
}
