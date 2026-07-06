// Проверка отклонения значения от нормы
function checkMean(value, normal_level, warning_criterion, warning_threshold, alarm_criterion, alarm_threshold) {

    const empty = ["", "--"];
    if (!value || empty.includes(value)) return "alarm";
    if (!normal_level || empty.includes(normal_level)) return "normal";

    let v = Number(value);
    let a = Number(alarm_threshold);
    let w = Number(warning_threshold);
    let n = Number(normal_level);

    if (isNaN(a)) { // порог не число
        switch (alarm_criterion) {
            case "=":
                if (value == alarm_threshold) return "alarm";
                break;
            case "!=":
                if (value != alarm_threshold) return "alarm";
                break;
            default:
                break;
        }
    }
    else { //порог число
        if (!isNaN(v) && !isNaN(n)) {
            // значение, норма и порог число
            switch (alarm_criterion) {
                case ">":
                    if (v > a) return "alarm";
                    break;
                case "<":
                    if (v < a) return "alarm";
                    break;
                case "=":
                    if (v == a) return "alarm";
                    break;
                case "!=":
                    if (v != a) return "alarm";
                    break;
                case "%":
                    if (Math.abs(v - n) / (n + 1e-12) * 100 > a) return "alarm";
                    break;
                default:
                    break;
            }
        }
    }

    if (isNaN(w)) { // порог не число
        switch (warning_criterion) {
            case "=":
                if (value == warning_threshold) return "warning";
                break;
            case "!=":
                if (value != warning_threshold) return "warning";
                break;
            default:
                break;
        }
    }
    else { //порог число
        if (!isNaN(v) && !isNaN(n)) {
            // значение, норма и порог число
            switch (warning_criterion) {
                case ">":
                    if (v > w) return "warning";
                    break;
                case "<":
                    if (v < w) return "warning";
                    break;
                case "=":
                    if (v == w) return "warning";
                    break;
                case "!=":
                    if (v != w) return "warning";
                    break;
                case "%":
                    if (Math.abs(v - n) / (n + 1e-12) * 100 > w) return "warning";
                    break;
                default:
                    break;
            }
        }
    }

    return "normal"
}


// Определение иконки по типу метрики
function getIconFromType(type) {
    switch (type) {
        case "voltage AC":
        case "voltage DC":            
        case "current AC":
        case "current DC":            
            return "speed";
        case "door":
            return "vpn_key";
            //return "sensor_door";
        case "automat":
        case "power":            
            return "power";
        case "frequency":            
            return "waves";            
        default:
            return "favorite";
    }
}