const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const serverless = require('serverless-http');
const express = require('express');
const https = require('https');
const app = express();

const appBotToken = process.env.APP_BOT_TOKEN || 'bot-token-123';
const runInBackground = process.env.hasOwnProperty('APP_DAEMONIZE') === true;
const tableName = process.env.APP_TABLE_NAME || '';
const ddbclient = new DynamoDBClient({ region: process.env.APP_REGION || 'ap-southeast-3' });
const openWeatherApiUrl = 'https://api.openweathermap.org';
const openWeatherApiKey = process.env.APP_OPENWEATHER_APIKEY || '';
const openWeatherCacheTtl = parseInt(process.env.APP_OPENWEATHER_CACHE_TTL || 3600);
const validCommands = ['/cuaca', '/bantuan', '/polusi'];

async function saveItemToCache(options, data) {
  const itemTtl = Math.floor(Date.now() / 1000) + openWeatherCacheTtl;
  const cacheItem = {
    pk: options.pk,
    sk: options.sk,
    response: data,
    ttl: itemTtl
  };
  
  const cacheParam = {
    TableName: tableName,
    Item: marshall(cacheItem)
  };
  
  const cmdPutItemCommand = new PutItemCommand(cacheParam);
  await ddbclient.send(cmdPutItemCommand);
}

function getGeocoding(options) {
  return new Promise((resolve, reject) => {
    const url = `${openWeatherApiUrl}/geo/1.0/direct?q=${options.city}&limit=1&appId=${openWeatherApiKey}`;
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) {
        resp.resume();
        reject(new Error(`HTTP Status code from OpenWeatherData was ${resp.statusCode}`));
        return;
      }
      
      let responseData = '';
      resp.on('data', (chunk) => responseData += chunk);
      resp.on('end', () => {
        resolve(responseData);
      });
    });
  });
}

function getWeather(options) {
  return new Promise((resolve, reject) => {
    const queryString = [
      `lat=${options.lat}`,
      `lon=${options.lon}`,
      'lang=id',
      'units=metric',
      `appId=${openWeatherApiKey}`
    ];
    
    const url = `${openWeatherApiUrl}/data/2.5/weather?` + queryString.join('&');
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) {
        resp.resume();
        reject(new Error(`HTTP Status code from OpenWeatherData was ${resp.statusCode}`));
        return;
      }
      
      let responseData = '';
      resp.on('data', (chunk) => responseData += chunk);
      resp.on('end', () => {
        resolve(responseData);
      });
    });
  });
}

async function getItemFromCache(options) {
  const itemParam = {
    TableName: tableName,
    Key: marshall({
      pk: options.pk,
      sk: options.sk
    })
  };
  
  const itemResponse = await ddbclient.send(new GetItemCommand(itemParam));
  let cacheItem = null;
  let queryFreshItem = true;
  
  if (itemResponse.Item !== undefined) {
    const item = unmarshall(itemResponse.Item);
    const now = Math.floor(Date.now() / 1000);
    
    if (item.ttl > now) {
      queryFreshItem = false;
      cacheItem = JSON.parse(item.response);
    }
  }
  
  if (queryFreshItem === true) {
    cacheItem = await options.getFreshItem(options);
    saveItemToCache({ pk: options.pk, sk: options.sk }, cacheItem);
    cacheItem = JSON.parse(cacheItem);
  }
  
  return {
    fresh: queryFreshItem,
    item: cacheItem
  };
}

// Bot Token Middleware Auth
function botTokenMiddleware(req, res, next) {
  const userBotToken = req.params.token || '';
  
  console.log(`Comparing bot token user vs App - ${userBotToken} === ${appBotToken}`);
  if (userBotToken !== appBotToken) {
    res.status(401).json({ 'message': 'Token missmatch' });
    return;
  }
  
  next();
}

app.post('/bot/:token', botTokenMiddleware, express.json(), async (req, res) => {
  let chatId = '';
  
  try {
    console.log(req.body);
    const text = req.body.message.text || 'Unknown';
    chatId = req.body.message.chat.id || 'Unknown';
    const botResponse = {
      method: 'sendMessage',
      chat_id: chatId,
      text: 'Nothing to do.'
    };
  
    if (text === '/bantuan') {
      botResponse.text = `Perintah tersedia:

/cuaca nama_kota[[,provinsi],kode_negara
/polusi nama_kota[[,provinsi],kode_negara
/bantuan

Contoh perintah:
      
/cuaca surabaya
/cuaca surabaya,,id
/cuaca surabaya,east java,id
/cuaca london

/polusi bandung
`
        res.json(botResponse);
        return;
     }
    
    const arrayOfText = text.split(' ');
    if (arrayOfText.length < 2) {
      throw new Error('Perintah salah. Gunakan /bantuan untuk contoh penggunaan.');
    }
    
    const command = arrayOfText.shift();
    if (validCommands.indexOf(command) === -1) {
      throw new Error('Perintah salah. Gunakan /bantuan untuk contoh penggunaan.');
    }
    
    const city = arrayOfText.join('');
    
    const responseCity = await getItemFromCache({ 
      pk: `cache#${city}`,
      sk: 'geocoding-cache',
      getFreshItem: async () => { return getGeocoding({ city: city }) }
    });
    
    res.set({
      'x-geocoding-cache': responseCity.fresh ? 'miss' : 'hit'
    });
    
    if (responseCity.item.length === 0) {
      botResponse.text = 'Kota tidak ditemukan.';
      res.json(botResponse);
    }
    
    if (command === '/cuaca') {
      const { lat, lon } = responseCity.item[0];
      const weather = await getItemFromCache({
        pk: `cache#${lat},${lon}`,
        sk: 'weather-cache',
        getFreshItem: async (options) => { 
          return getWeather({ lat: lat, lon: lon });
        }
      });
      
      const botCommandResponse = `Cuaca untuk kota ${city} saat ini: **${weather.item.weather[0].description}**
- Suhu: **${weather.item.main.feels_like}°C**
- Kelembaban: **${weather.item.main.humidity}%**
- Kecepatan angin: **${weather.item.wind.speed} meter/detik**
`
      
      console.log(JSON.stringify(weather, null, 2));
      botResponse.text = botCommandResponse;
    }
    
    if (command === '/polusi') {
      // Quiz - Buat PR untuk fitur ini
      // ------------------------------
      // Lengkapi perintah ini sehingga mengembalikan data polusi udara
      // untuk sebuah kota dari API OpenWeatherMap.org
      //
      // Contoh perintah:
      // /polusi jakarta
      //
      // Respon yang harus dikembalikan adalah
      // Polusi udara kota jakarta saat ini: *Sangat Buruk|Buruk|Sedang|Cukup Baik|Baik*
    }
    
    res.json(botResponse);
  } catch (e) {
    console.log(e);
    res.json({
      method: 'sendMessage',
      chat_id: chatId,
      text: e.toString()
    });
  }
});

if (runInBackground) {
  const port = process.env.NODE_PORT || 8080;
  app.listen(port, () => console.log(`Server running on port ${port}`));
  return;
}

exports.handler = serverless(app);