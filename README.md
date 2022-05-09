## About

This project contains example how to deploy serverless API using Express.js framework  and [AWS Lambda](https://aws.amazon.com/lambda/).

> AWS Lambda is a serverless, event-driven compute service that lets you run code for virtually any type of application or backend service without provisioning or managing servers. (aws.amazon.com)

The demo is a simple Telegram bot which return weather information for particular city. Weather information are provided by OpenWeatherMap.org.

Result from API request to OpenWeatherMap.org will be cached to DynamoDB for performance reason and to prevent request being throttled.

## Presentation

You can watch my talk at AWS User Group Surabaya regarding this topic. The talk is in Bahasa Indonesia.

[![Watch the video](https://img.youtube.com/vi/w5uTgLvvqJA/hqdefault.jpg)](https://www.youtube.com/watch?v=w5uTgLvvqJA)

## Requirements

This project has been tested using following softwares version, but it should works with other version too.

- AWS CLI v2.4.28
- Bash v4.2.46
- Serverless Framework v3.16.0
- Node.js 14.x
- GitHub account
- Telegram Bot API Key
- OpenWeatherMap.org API Key

## How to run

Clone this repository or download the archived file.

```sh
$ git clone git@github.com:rioastamal-examples/aws-lambda-expressjs-demo.git
$ cd aws-lambda-expressjs-demo
```

Install all dependencies.

```sh
$ npm install
```

Prepare all environment variables.

```sh
$ export APP_TABLE_NAME=YOUR_DYNAMODB_TABLE_NAME \
APP_BOT_TOKEN=YOUR_APP_SECURITY_TOKEN \
APP_OPENWEATHER_APIKEY=YOUR_OPENWEATHER_APIKEY \
APP_OPENWEATHER_CACHE_TTL=CACHE_RESULT_IN_SECONDS \
APP_REGION=YOUR_PREFERRED_AWS_REGION
```

Deploy application using Serverless Framework.

```sh
$ serverless deploy
```

```
...
✔ Service deployed to stack astamal-serverless-demo-dev (31s)

endpoint: https://RANDOM_CHARS.lambda-url.YOUR_AWS_REGION.on.aws/
...
```

After succeeded, you will get AWS Lambda function URL endpoint which you can use as Telegram Bot webhook URL.

### Setup Telegram Bot

Go to [Telegram: How do I create bot](https://core.telegram.org/bots/faq#how-do-i-create-a-bot) official page to begin setting up your Bot. We will use webhook to get an update from the Bot.

After getting your Bot API Key add your AWS Lambda URL to the Telegram Bot webhook. Replace `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` with your API Key.

```sh
$ curl -s -D /dev/stderr -H 'Content-Type: application/json' \
'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/setWebhook' \
-d '{
  "url": "https://RANDOM_CHARS.lambda-url.YOUR_AWS_REGION.on.aws/bot/YOUR_APP_SECURITY_TOKEN"
}'
```

### Test Telegram Bot

Open a chat with your Telegram Bot and try to type `/bantuan`. It will list all possible commands.

```
Perintah tersedia:

/cuaca nama_kota[[,provinsi],kode_negara
/polusi nama_kota[[,provinsi],kode_negara
/bantuan

Contoh perintah:
      
/cuaca surabaya
/cuaca surabaya,,id
/cuaca surabaya,east java,id
/cuaca london

/polusi bandung
```

To check weather for particular city, use bot command `/cuaca city_name`.

```
/cuaca surabaya
```

```
Cuaca untuk kota surabaya saat ini: badai
- Suhu: 31.07 °C
- Kelembaban: 94 %
- Kecepatan angin: 2.57 meter/detik
```

## License

This project is open source licensed under MIT license.
