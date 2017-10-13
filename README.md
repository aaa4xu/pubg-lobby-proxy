# PUBG lobby proxy
## English
Eazy way to view and modify PLAYERUNKNOWN'S BATTLEGROUNDS lobby traffic

### Install
1. Clone or download this repository
2. Execute `npm install`
3. Add to file `C:\Windows\System32\drivers\etc\hosts` new line `127.0.0.1 front.battlegroundsgame.com`
4. Execute `npm start`

If you already have some webserver on port `80`, make redirect from `front.battlegroundsgame.com` to `127.0.0.1:{someport}` and set this port inside `index.js`

### PUBG Lobby browser debug mode
1. Start PUBG lobby proxy
2. Login to game
3. Go to `http://127.0.0.1/debug.html`

Use Google Chrome for better experience

### Доступ к API через HTTP
1. Start PUBG lobby proxy
2. Login to game
3. Send requests to `http://127.0.0.1/api/:interface/:method/` (For example: `http://127.0.0.1/api/UserProxyApi/GetOpenGameInfo/`)(Use `POST` with json body for requests with arguments, flags, etc)

## Русский
Простой способ просмотра и редактирования трафика лобби игры PLAYERUNKNOWN'S BATTLEGROUNDS

### Установка
1. Склонируй или скачай код из этого репозитория
2. Выполни `npm install`
3. Добавь в файл `C:\Windows\System32\drivers\etc\hosts` новую строку `127.0.0.1 front.battlegroundsgame.com`
4. Выполни `npm start`

Если у тебя уже висит вебсервер на порту `80`, сделай в нем редирект с `front.battlegroundsgame.com` на `127.0.0.1:{порт}` и измени порт в файле `index.js`

### Отладка лобби PUBG в браузере
1. Запусти прокси
2. Авторизируйся в игре
3. Перейди в браузере `http://127.0.0.1/debug.html`

Лучше всего работает в Google Chrome

### Доступ к API через HTTP
1. Запусти прокси
2. Авторизируйся в игре
3. Отправляй запросы на url вида `http://127.0.0.1/api/:interface/:method/` (Например, `http://127.0.0.1/api/UserProxyApi/GetOpenGameInfo/`)(Используй `POST` с json телом для запросов с аргументами, флагами и т.д.)