myApp.controller('RequestController',
    function QuestionController($scope, $http) {

        /*---АКТУАЛЬНЫЙ---*/
        $http.get('/getactual').success(function (data) {
            $scope.actual = data;
        });
        /*---АКТУАЛЬНЫЙ---*/

        /*---ПОЧАСОВОЙ---*/
        var nowHour = (new Date()).getHours(),
            newHourly = {};
        $http.get('/gethourly').success(function(data) {
            data.forEach(function(val, key){
                if(!newHourly[key]) newHourly[key] = {};
                for(var Okey in val){
                    if(parseInt(Okey) >= nowHour || Okey === 'name') newHourly[key][Okey] = val[Okey];
                }
            });
            $scope.hourly = newHourly;
        });

        $scope.hourlyTime = [' '];
        for(var i=nowHour;i<24;i++){
            $scope.hourlyTime.push(i+':00');
        }
        /*---ПОЧАСОВОЙ---*/


    }
);