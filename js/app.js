(function () {
    // ---------- DOM элементы ----------
    const statusLed = document.getElementById('statusLed');
    const statusTextSpan = document.getElementById('statusText');
    const dateTimeSpan = document.getElementById('currentDateTime');
    const retryBtn = document.getElementById('retryConnectionBtn');
    const metricsContainer = document.getElementById('metricsGrid');

    // переменные состояния
    let pollingTimer = null;
    let isPollingActive = true;
    let isRenderCards = false;
    let isChangeConfig = false;
    let currentStatus = 'connecting';   // 'online', 'offline', 'connecting'

    // Описания отображаемых величин 
    let METRICS = null
    // Хранилище текущих значений
    let currentValues = {};

    // Счетчик циклов запроса
    let requestCounter = 0;

    // Ссылки на DOM-элементы карточек
    const cardElements = {};

    // Получение данных с сервера
    async function getDataFromServer() {
        try {
            const response = await fetch(`http://${SERVER_CONFIG}/last?n=1`);

            // Critical: fetch does NOT reject on HTTP errors (e.g., 404, 500)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Server request error! status: ${error}`);
        }
    }

    // Получение конфигурации с сервера
    async function getConfigFromServer() {
        try {
            const response = await fetch(`http://${SERVER_CONFIG}/config`);

            // Critical: fetch does NOT reject on HTTP errors (e.g., 404, 500)
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            throw new Error(`Config load error! status: ${error}`);
        }
    }

    // Обновление UI карточек 
    function renderCards() {
        if (!METRICS || isRenderCards) return;

        isRenderCards = true;

        // Если контейнер пуст — создаём карточки в первый раз
        if ((metricsContainer.children.length === 0) || isChangeConfig) {
            //Если конфигурация измепнилась, перерисовываем карточки
            if (isChangeConfig) {
                isChangeConfig = false;
                metricsContainer.innerHTML = '';
            }
            METRICS.forEach(metric => {
                const card = document.createElement('div');
                card.className = 'metric-card';
                card.id = `card-${metric.id}`;
                card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title">
                            <span class="material-icons">${getIconFromType(metric.type)}</span>
                            <span>${metric.title}</span>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="metric-value" id="val-${metric.id}">
                            <span class="value-number">${currentValues[metric.id]?.value ?? '--'}</span>
                            <span class="metric-unit">${metric.unit}</span>
                        </div>
                        <div class="last-update-badge">
                            <span class="material-icons icon-small" style="font-size:14px">update</span>
                            <span id="time-${metric.id}">ожидание данных</span>
                        </div>
                    </div>
                `;
                metricsContainer.appendChild(card);

                // сохраняем ссылки на динамические части
                cardElements[metric.id] = {
                    style: card.style,
                    valueSpan: card.querySelector(`#val-${metric.id} .value-number`),
                    timeSpan: card.querySelector(`#time-${metric.id}`),
                };
            });
        } else {
            // Обновляем только значения и время
            METRICS.forEach(metric => {
                const valData = currentValues[metric.id];
                if (cardElements[metric.id]) {
                    if (valData && valData.value !== undefined) {
                        cardElements[metric.id].valueSpan.innerText = valData.value;
                    } else {
                        cardElements[metric.id].valueSpan.innerText = '--';
                    }
                    if (valData && valData.lastUpdate) {
                        const formattedTime = new Date(valData.lastUpdate).toLocaleTimeString('ru-RU', { hour12: false });
                        cardElements[metric.id].timeSpan.innerText = `обновлено ${formattedTime}`;
                    } else {
                        cardElements[metric.id].timeSpan.innerText = 'нет данных';
                    }
                }
            });
        }
    }

    // Обновить статус связи в строке состояния
    function updateConnectionStatus(status, errorMsg = null) {
        currentStatus = status;
        if (status === 'online') {
            statusLed.className = 'status-led';
            statusLed.classList.remove('offline', 'warning');
            statusTextSpan.innerText = '● Онлайн · данные поступают';
        } else if (status === 'offline') {
            statusLed.className = 'status-led offline';
            statusTextSpan.innerText = errorMsg ? `⚠️ Ошибка: ${errorMsg}` : '⚠️ Нет соединения с сервером';
        } else if (status === 'connecting') {
            statusLed.className = 'status-led warning';
            statusTextSpan.innerText = '🔄 Установка связи...';
        }
    }

    // Основная логика получения данных и обновления значений
    async function pollData() {
        if (!isPollingActive) return;
            

        renderCards();
    
        if (!(requestCounter%10)) {
            loadConfig();
        }
        
        ++requestCounter;

        try {
            // Показываем "connecting" при первом запросе
            if (currentStatus !== 'online') {
                updateConnectionStatus('connecting');
            }

            const serverData = await getDataFromServer();
            // Успешный ответ
            updateConnectionStatus('online');

            if (!METRICS) return;

            METRICS.forEach(metric => {


                const values = serverData.records[0];
                const newValue = values[metric.id];
                const nowTimestamp = values.timestamp || Date.now();

                currentValues[metric.id] = { value: newValue, lastUpdate: nowTimestamp };

                // Перерисовываем карточки (меняем числовые значения, фон и метки времени)

                if (cardElements[metric.id]) {

                    // Устанавливаем цвет фона в зависимости от значения метрики
                    const rootStyles = getComputedStyle(document.documentElement);
                    const check = checkMean(newValue, metric.normal_level, metric.warning_criterion,
                        metric.warning_threshold, metric.alarm_criterion, metric.alarm_threshold);

                    if (check == 'alarm') {
                        cardElements[metric.id].style.background = rootStyles.getPropertyValue('--status-alarm');
                    }
                    else
                        if (check == 'warning') {
                            cardElements[metric.id].style.background = rootStyles.getPropertyValue('--status-warning');
                        }
                        else {
                            cardElements[metric.id].style.background = rootStyles.getPropertyValue('--status-ok');
                        }

                    cardElements[metric.id].valueSpan.innerText = newValue;
                    const formatted = new Date(nowTimestamp).toLocaleTimeString('ru-RU', { hour12: false });
                    cardElements[metric.id].timeSpan.innerText = `обновлено ${formatted}`;
                }
            });

        } catch (err) {
            console.warn('Ошибка запроса:', err);
            updateConnectionStatus('offline', err.message || 'Сервер не отвечает');

            if (!METRICS) return;
            // Показываем прочерки в карточках, но не затираем старые данные полностью?
            // По UI-решению: оставляем последние корректные значения, но добавляем визуальный намёк.
            // Но в статусе уже отражена проблема.
            // Дополнительно можно вывести предупреждение в последнем обновлении:
            METRICS.forEach(metric => {
                if (cardElements[metric.id] && currentValues[metric.id]?.value === '--') {
                    // если никогда не было данных, покажем прочерк
                    cardElements[metric.id].valueSpan.innerText = '--';
                    cardElements[metric.id].timeSpan.innerText = 'связь потеряна';
                } else if (cardElements[metric.id] && currentValues[metric.id]?.value) {
                    // оставляем последнее известное значение, но указываем, что данные устарели
                    cardElements[metric.id].timeSpan.innerText = 'ожидание обновления...';
                }
            });
        }
    }

    // Запуск периодического опроса (каждые 500 мс)
    function startPolling() {
        if (pollingTimer) clearInterval(pollingTimer);
        isPollingActive = true;
        // Сразу выполняем первый запрос, чтобы UI не был пустым
        pollData();
        pollingTimer = setInterval(() => {
            if (isPollingActive) {
                pollData();
            }
        }, POLLING_INTERVAL_MS);
    }

    // Остановка опроса (например, при ручном ресете, но редко нужно)
    function stopPolling() {
        isPollingActive = false;
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    }

    // Ручной сброс соединения и перезапуск (кнопка "Обновить")
    function manualRetry() {
        // Сброс статуса, принудительный перезапрос
        updateConnectionStatus('connecting');
        stopPolling();
        startPolling();  // перезапускаем интервал
    }

    // Обновление времени и даты в строке состояния (каждую секунду)
    function updateDateTime() {
        const now = new Date();
        const formatted = now.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }) + ' ' + now.toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateTimeSpan.innerText = formatted;
    }

    // Инициализация при старте
    function initUI() {
        loadConfig();
        renderCards();
        updateDateTime();
        setInterval(updateDateTime, 1000);
    }

    // загрузка конфигурационного файла
    async function loadConfig() {
        const metrics = await getConfigFromServer();

        // проверка обновления файла конфигурации
        if (JSON.stringify(metrics) === JSON.stringify(METRICS)) return;

        METRICS = metrics;

        METRICS.forEach(metric => {
            currentValues[metric.id] = { value: '--', lastUpdate: null }
        });

        isRenderCards = false;
        isChangeConfig = true;

    }

    // ----- Обработчики -----
    retryBtn.addEventListener('click', () => {
        manualRetry();
    });

    // Старт приложения
    initUI();
    startPolling();


    // Опционально: остановка при выгрузке страницы 
    window.addEventListener('beforeunload', () => {
        stopPolling();
    });

})();