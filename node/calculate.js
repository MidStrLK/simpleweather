var formatDate = require('../formatdate'),
    requestdata = require('./requestdata');

exports.calc = calc;

/*
* 1. Усредныем Актуальные, ПрогнозС, ПрогнозНА и записываем на сервер
* 2. Запуск расчета Ошибки*/
function calc(callback, COLLECTION){

    callback(1, 'OK');
    return;

    var requestArrayLength = 0,
        requestArray = [],
        calcNext = function(data) {
            requestArray = requestArray.concat(data);
            requestArrayLength++;

            if(requestArrayLength !== 3) return;

            sendData(requestArray, callback, COLLECTION);

            calcForecastGlobal(COLLECTION);

        };

    calcActualAverage(calcNext, COLLECTION);
    calcForecastAverage(calcNext, COLLECTION);
    calcPredictedAverage(calcNext, COLLECTION);
}

/* Отправляет данные на сервер */
function sendData(data, callback, COLLECTION){
    if(!data || !data.length){
        callback(0, 0);
    }else{
        console.info(formatDate.dateToLocal(), '-NODE_request- average - result: ', (data && data.length) ? data.length : 'error');
        mongodb.requestMDB('insert', callback, data, COLLECTION);
    }


}

/* Получаем актуальные данные на сегодня и запускаем их усреднение */
function calcActualAverage(callback, COLLECTION){
    var func = function(err, result){
        calcAverage(err, result, callback)
    };
    mongodb.requestMDB('select', func, requestdata.getActualDay(), COLLECTION);
}

/* Получаем прогнозируемые данные С сегодня и запускаем их усреднение */
function calcForecastAverage(callback, COLLECTION){
    var func = function(err, result){
        calcAverage(err, result, callback)
    };
    mongodb.requestMDB('select', func, requestdata.getForecastDay(), COLLECTION);
}

/* Получаем прогнозируемые данные НА сегодня и запускаем их усреднение */
function calcPredictedAverage(callback, COLLECTION){
    var func = function(err, result){
        calcAverage(err, result, callback)
    };
    mongodb.requestMDB('select', func, requestdata.getPredictedDay(), COLLECTION);
}

/* Усредняет данные */
function calcAverage(err, result, callback){

    if(err || !result || !result.forEach) return;

    var resObj = {},
        resArr = [];

    result.forEach(function(val){
        if(val['_id']) delete val['_id'];
        if(val['hour']) delete val['hour'];
        val.daykey += 'average';

        var num = val.name + '_' + val.key + '_' + val.afterday;

        if(!resObj[num]) resObj[num] = [];

        resObj[num].push(val);
    });

    for(var key in resObj){
        resArr.push((key.indexOf('temp') !== -1) ? getAverageValueTemp(resObj[key]) : getAverageValueText(resObj[key]))
    }

    callback(resArr);
}

/* Посчитать среднее значение массива Текста*/
function getAverageValueText(arr) {
    var arrLen = arr.length,
        res = {},
        num = 0,
        result = '';
    for (var i = 0; i < arrLen; i++) {
        if(!res[arr[i].value]) res[arr[i].value] = 0;
        res[arr[i].value]++;
    }

    for(var key in res){
        if(res[key] > num){
            num = res[key];
            result = key;
        }
    }

    arr[0].value = result;

    return arr[0];
}

/* Посчитать среднее значение массива Температур */
function getAverageValueTemp(arr){
    var arrLen = arr.length,
        result = 0;
    for (var i = 0; i < arrLen; i++) {
        result += arr[i].value;
    }

    arr[0].value = (result / arrLen).toFixed(1);

    return arr[0];
}


/* Подсчерт глобального отклонения */
function calcForecastGlobal(COLLECTION){
    var resultCommon = {},
        callbackActual    = function(err, result){  resultCommon.actual    = result;  func();},
        callbackForecast  = function(err, result){  resultCommon.predicted = result;  func();},
        callbackDeviation = function(err, result){  resultCommon.deviation = result;  func();},
        func = function(){
            if(!resultCommon.actual || !resultCommon.predicted || !resultCommon.deviation) return;

            var dayDeviation = calcDayDeviation(resultCommon.actual, resultCommon.predicted),
                deviation    = getDeviation(dayDeviation, resultCommon.deviation);

            sendDeviation(deviation, COLLECTION);

    };

    mongodb.requestMDB('select', callbackActual,    requestdata.getActualAverageDay(),    COLLECTION);
    mongodb.requestMDB('select', callbackForecast,  requestdata.getPredictedAverageDay(), COLLECTION);
    mongodb.requestMDB('select', callbackDeviation, requestdata.getDeviation(),           COLLECTION);
}

/* Подсчитать расхождение для каждого дня */
function calcDayDeviation(actual, predicted){
    var res = [];

    predicted.forEach(function(valP, keyP){
        actual.forEach(function(valA, keyA){
            if(valP.name === valA.name && valP.key === valA.key){
                res.push({
                    name:       valP.name,
                    key:        valP.key,
                    value:      calcDeviation(valP.value, valA.value, valP.key),
                    afterday:   valP.afterday
                });
            }
        })
    });

    return res;
}

/* Подсчитывает погрешность */
function calcDeviation(predicted, actual, key){
    var res = 0;

    if(key === 'temp'){
        res = Math.abs(predicted - actual);
    }else{
        if(predicted === actual){
            res = 1;
        }else if(predicted.indexOf(actual) != -1 || actual.indexOf(predicted) != -1){
            res = 0.5;
        }else{
            var predictedArr = predicted.split(' '),
                actualArr = predicted.split(' ');

            predictedArr.forEach(function(valPA){
                actualArr.forEach(function(valAA){
                    if(valPA === valAA) res = 0.75;
                })
            })
        }

    }

    return res;
}


function getDeviation(actual, deviation){
    var newDeviation = [];

    actual.forEach(function(valA){
        var actualIsNew = true;
        deviation.forEach(function(valD){
            if( valA.name     === valD.name &&
                valA.key      === valD.key &&
                valA.afterday === valD.afterday){
                    valD.value = (valD.value * valD.count + valA.value)/(valD.count + 1);
                    valD.count++;
                actualIsNew = false;
            }
        });

        if(actualIsNew){
            newDeviation.push({
                name:       valA.name,
                key:        valA.key,
                value:      valA.value,
                afterday:   valA.afterday,
                daykey:     'deviation',
                count:      1
            })
        }

    });

    return deviation.concat(newDeviation);
}

function sendDeviation(data, COLLECTION){
    if(data && data.length){
        console.info(formatDate.dateToLocal(), '-NODE_request- deviation - result: ', (data && data.length) ? data.length : 'error');
        mongodb.requestMDB('insertDeviation', null, data, COLLECTION);
    }
}





