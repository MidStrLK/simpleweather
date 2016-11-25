myApp.controller('RequestController',
    function QuestionController($scope, $http){

/*---АКТУАЛЬНЫЙ---*/
        $http.get('/getactual').success(function(data) {
            $scope.actual = data;
        });
/*---АКТУАЛЬНЫЙ---*/

);