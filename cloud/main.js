var _ = require("underscore");
var moment = require("moment");



Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});


Parse.Cloud.beforeSave("Customer", function (request, response) {
    var customer = request.object;

    // update search fields: email, firstname, placeofbirth
    var email4search = customer.get("email") !== undefined ?
        customer.get("email").trim().toLowerCase() : "";
    if (customer.get("email_search") !== email4search) {
        customer.set("email_search", email4search);
    }

    var firstName4search = customer.get("firstName") !== undefined ?
        customer.get("firstName").trim().toLowerCase() : "";
    if (customer.get("firstName_search") !== firstName4search) {
        customer.set("firstName_search", firstName4search);
    }

    var placeOfBirth4search = customer.get("placeOfBirth") !== undefined ?
        customer.get("placeOfBirth").trim().toLowerCase() : "";
    if (customer.get("placeOfBirth_search") !== placeOfBirth4search) {
        customer.set("placeOfBirth_search", placeOfBirth4search);
    }

    // original code below
    if (customer.isNew()) {

       Parse.Config.get().then(function (config) {
       var notEligableCountryCodes = config.get("notEligableCountryCodes");
       customer.set("availableQuestions", 1);

       for (var i = 0; i < notEligableCountryCodes.length; i++) {
         if (notEligableCountryCodes[i] === customer.get("region")) {
             customer.set("availableQuestions", 0);
             break;
         }
       }

       response.success();
       }, function (error) {
        console.log(error);
       });

    } else {
        response.success();
    }
           
});


Parse.Cloud.beforeSave("Message", function (request, response) {
                       
         var message = request.object;
         var customer = message.get("Customer");
         
         var text = message.get("text");
          console.log(text);
         
         // Only run algorithms below when user sends a question from a device
         
         if (message.isNew() && message.get("sender") == "User") {
         
         // Set search words
         
         var toLowerCase = function (w) {
         return w.toLowerCase();
         };
         
         var searchWords = message.get("text")
         
         searchWords = searchWords.replace(/[\.,-\/#!\?$%\^&\*;:{}=\-_`~()]/g, "");
         
         searchWords = searchWords.replace(/\s{2,}/g, " ");
         
         //  searchWords.replace(/^\s+|\s+$/gm,'')
         
         searchWords = searchWords.trim()
         
         searchWords = searchWords.toLowerCase();
         
         message.set("searchWords", searchWords);
         
         
         // Look at old messages that match the search words
         
         var Message = Parse.Object.extend("Message");
         var query = new Parse.Query(Message);
         query.include("Customer");
         query.equalTo("searchWords", searchWords);
         
         var oldMessages = [];
         
         query.find().then(function (results) {
                           
         oldMessages = results;
         
         // Fetch customer of new message in order to find potential auto answer matches and duplicates
         
         return customer.fetch();
         
         }).then(function (customer) {
                 
                 for (var i = 0; i < oldMessages.length; ++i) {
                 var oldMessage = oldMessages[i];
                 var oldMessageCustomer = oldMessage.get("Customer");
                 
                 
                 // See if the same user has submitted the same question twice
                 
                 if (oldMessage.get("sender") == "User" && oldMessageCustomer == customer) {
                 message.set("duplicate", oldMessage);
                 }
                 
                 // See if someone from the same IP has submitted the same question
                 
                 if (oldMessage.get("sender") == "User" && message.get("ip") == oldMessage.get("ip")) {
                 message.set("duplicate", oldMessage);
                 }
                 
                 }
                 
                 
                 // See if customer to potential automatic answer is a match
                 
                 // var customerAge = moment(customer.get("dateOfBirth")).format("YYYY");
                 
                 var customerAge = moment().diff(customer.get("dateOfBirth"), 'years');
                 var customerSex = customer.get("sex")
                 
                 var AutoAnswer = Parse.Object.extend("AutoAnswer");
                 var autoAnswerQuery = new Parse.Query(AutoAnswer);
                 autoAnswerQuery.equalTo("searchWords", searchWords);
                 autoAnswerQuery.equalTo("sex", customerSex);
                 autoAnswerQuery.lessThan("minAge", customerAge);
                 autoAnswerQuery.greaterThan("maxAge", customerAge);
                 //autoAnswerQuery.lessThan("maxAge", customerAge);
                 //autoAnswerQuery.greaterThan("minAge", customerAge);
                 
                 
                 autoAnswerQuery.find({
                    success: function (autoAnswers) {
                    console.log(autoAnswers);
                    if (autoAnswers.length) {
                    message.set("autoAnswer", autoAnswers[Math.floor(Math.random() * autoAnswers.length)]);
                    }
                    
                    
                    // Look for previous messages from customer
                    
                    var previousMessages = "";
                  
                    var previousMessagesQuery = new Parse.Query(Message);
                    previousMessagesQuery.ascending("validAt");
                    previousMessagesQuery.equalTo("Customer", customer);
            	      previousMessagesQuery.limit(20);
                    
                    previousMessagesQuery.find({
                       success: function (previousMessages) {
                       
                       for (var j = 0; j < previousMessages.length; j++) {
                       
                       var previousMessage = previousMessages[j];
                       
                       // Skip the previous message if it is the same message
                       
                       if (previousMessage.id == message.id) continue;
            					 if (previousMessage.get("sender") == "Your Horoscope") continue;
            					 if (previousMessage.get("text").indexOf("technical problems")!==-1) continue;
            					 if (previousMessage.get("text").indexOf("with Valentine's Day here, now is a very good time to see how the planets are set")!==-1) continue;
                       // Add to previous messages
                  
                       /*    TEMPORARY REMOVED ON 22 JAN 2015
                        var rating = "";
                        
                        if (previousMessage.get("rating")) {
                        rating = previousMessage.get("rating");
                        }
                        */
                       
                       var previousMessagesString = "";
                       
                       if (message.get("previousMessages")) {
                       previousMessagesString = message.get("previousMessages");
                       }
                       if (j == (previousMessages.length - 1)) {
                       message.set("previousMessages", previousMessagesString + previousMessage.get("sender") + "," + '"' + previousMessage.get("text") + '"' + ",");
                       }
                       else {
                       message.set("previousMessages", previousMessagesString + "," + '"' + previousMessage.get("text") + '"' + ",");
                       }
                       
                       //   TEMPORARY REMOVED ON 22 JAN 2015
                       // message.set("previousMessages", previousMessagesString + previousMessage.get("sender") + "," + rating + "," + '"' + previousMessage.get("text") + '"' + ",");
                       
                       }
                       response.success();
                       
                       },
                       
                       error: function (error) {
                       console.log("Error: " + error.code + " " + error.message);
                       response.error();
                       }
                       });
                                                        
                                                        
                    },
                    error: function (error) {
                    console.log(error);
                    response.error();
                    }
                    });


                }, function (error) {
                console.log(error);
                response.error();
                });
                         
         } else {
         response.success();
         }
         });


Parse.Cloud.beforeSave("AutoAnswer", function (request, response) {
                       
       var autoAnswer = request.object;
       
       // Set search words
       
       var toLowerCase = function (w) {
       return w.toLowerCase();
       };
       
       var searchWords = autoAnswer.get("question")
       searchWords = searchWords.replace(/[\.,-\/#!\?$%\^&\*;:{}=\-_`~()]/g, "");
       //	searchWords = searchWords.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g,"");
       searchWords = searchWords.replace(/\s{2,}/g, " ");
       searchWords = searchWords.toLowerCase();
       
       autoAnswer.set("searchWords", searchWords);
       
       response.success();
       
       });


/**
 * fully auto answer
 */
Parse.Cloud.afterSave("Message", function (request) {
                      
      var message = request.object;
      var minutes = 5;
      
      if (!message.get('answer') && message.get('sender') == 'User') { // it is new
      
      //gets customer info
      var customer = message.get('Customer');
      customer.fetch({
           success: function(customer) {
           // The object was refreshed successfully.
           
           console.log(parseInt(customer.get('boughtQuestions'))<=0);
           //if customer is not banned and is new
           if(!customer.get('ban') && parseInt(customer.get('boughtQuestions'))<=0)
           {
           fullyAutoAnswer(message);
           }
           
           },
           error: function(customer, error) {
           // The object was not refreshed successfully.
           // error is a Parse.Error with an error code and message.
           console.log("Error: " + error.code + " " + error.message);
           }
           });

      }
});



Parse.Cloud.define("pushNotifications", function (request, response) {
                   
       //message
       var params = request.params;
       var $object = Parse.Object.extend("Message");
       var query = new Parse.Query($object);
       
       query.get(params.message, {
         success: function (message) {
         // The object was retrieved successfully.
         
         var Customer = Parse.Object.extend("Customer");
         var customer = new Customer();
         customer.id = message.get('Customer').id;
         
         customer.fetch({
              success: function (customer) {
              
              if (customer.get("notificationsEnabled") == 1) {
              
              // Send push notification if customer allows it
              
              var pushText = "Dear " + customer.get("firstName") + ", " + message.get("text").slice(0,13);
              var valid = message.get("validAt");
              
              var query = new Parse.Query(Parse.Installation);
              query.equalTo("Customer", customer);
              
              Parse.Push.send({
                  where: query,
                  data: {
                  alert: pushText,
                  badge: "Increment",
                  sound: "cheering.caf",
                  title: "Astrology"
                  }
                  }, {
                  success: function () {
                  console.log('Push notification sent');
                  response.success('Push notification sent ');
                  },
                  error: function (error) {
                  console.log("Error: " + error.code + " " + error.message);
                  }
                  });
              }
              
              },
              error: function (customer, error) {
              console.log("Error: " + error.code + " " + error.message);
              }
              });
         },
         error: function (message, error) {
         // The object was not retrieved successfully.
         // error is a Parse.Error with an error code and message.
         response.error(message);
         }
         });
       
       
       });


Parse.Cloud.define("pushAnswer", function (request, response) {
                   
       var params = request.params;
       
       //customer
       var $object = Parse.Object.extend("Customer");
       var query = new Parse.Query($object);
       var $customer = query.get(params.Customer);
       
       //message
       $object = Parse.Object.extend("Message");
       query = new Parse.Query($object);
       var $answer = query.get(params.answer);
       
       
       //creates new message
       $object = Parse.Object.extend("Message");
       var message = new $object();
       
       message.set("Customer", $customer);
       message.set("text", params.text);
       message.set("sender", params.sender);
       
       //  $object.set("validAt", new DateTime());
       
       //save message
       message.save();
       //
       //$answer.set("answer", message);
       //$answer.save();
       //
       ////customer update notes
       //$customer.set('notes' , params.notes);
       //$customer.set('adminNotes' , params.adminNotes);
       //$customer.save();
       
       response.success('success');
       
 });


Parse.Cloud.define("findDuplicates", function (request, response) {
     Parse.Cloud.useMasterKey();
     
     
     var query1 = new Parse.Query('Customer');
     query1.equalTo('country', 'United States');
     query1.equalTo('dateOfBirthString', '01 Jan 1994');
     query1.equalTo('sex', 'Female');
     query1.equalTo('placeOfBirth', 'Byrn Mawr Pennsylvania ');
     
     var count1 = 0;
     
     query1.find({
                 success: function (results) {
                 var sum = '';
                 for (var i = 0; i < results.length; ++i) {
                 sum += results[i].get("objectId") + ' ' + results[i].get("objectId");
                 }
                 response.success(results);
                 },
                 error: function () {
                 response.error("failed");
                 }
                 });
     
     
     //
     //query1.find(function (results) {
     //
     //    var sum = '';
     //    //gets first customer
     //    //  var duplicates2 = customer1.get('duplicateIDs');
     //
     //
     //            //customer2.equalTo('sex', customer1.get('sex')) ||
     //            //customer2.equalTo('timeOfBirth') == customer1.get('timeOfBirth') ||
     //            //customer2.equalTo('country') == customer1.get('country') ||
     //            //customer2.equalTo('placeOfBirth') == customer1.get('placeOfBirth')
     //
     //    for (var i = 0; i < results.length; i++) {
     //        var object = results[i];
     //        sum+=(object.id + ' - ' + object.get('playerName'));
     //    }
     //
     //    response.success(sum);
     
     
     //console.log(customer1.get('objectId'));
     //customer2.find({
     //    success: function(results) {
     //
     //        var arr = [];
     //
     //        for(i in results){
     //            arr[i] = results[i].get('objectId');
     //        }
     //
     //        response.success(arr);
     //
     //    }
     //});
     
     
     //)
     //{
     //    var duplicates = customer1.get('duplicateIDs');
     //
     //    if(!duplicates){
     //        duplicates = [];
     //    }
     //
     //    duplicates.push(customer2.get('objectId'));
     //    customer1.set('duplicateIDs',duplicates);
     //}
     
     
     //  });
     
     });


var JSLINQ = function (dataItems) {
        return new JSLINQ.fn.init(dataItems);
    },
    utils = {
        processLambda: function (clause) {
            // This piece of "handling" C#-style Lambda expression was borrowed from:
            // linq.js - LINQ for JavaScript Library - http://lingjs.codeplex.com
            // THANK!!
            if (utils.isLambda(clause)) {
                var expr = clause.match(/^[(\s]*([^()]*?)[)\s]*=>(.*)/);
                return new Function(expr[1], "return (" + expr[2] + ")");
            }
            return clause;
        },
        isLambda: function (clause) {
            return (clause.indexOf("=>") > -1);
        },
        randomIndex: function (max, existing) {
            var q, r, f = function () { return this == r; };
            if (!existing) {
                return parseInt(Math.random() * max, 10);
            } else {
                q = JSLINQ(existing);
                r = -1;
                while (r < 0 || q.Where(f).Count() !== 0) {
                    r = utils.randomIndex(max);
                }
                return r;
            }
        }
    };
JSLINQ.fn = JSLINQ.prototype = {
    init: function (dataItems) {
        this.items = dataItems;
    },

    // The current version of JSLINQ being used
    jslinq: "2.20",

    toArray: function () { return this.items; },
    where: function (clause) {
        var newArray = [], len = this.items.length;

        // The clause was passed in as a Method that return a Boolean
        for (var i = 0; i < len; i++) {
            if (clause.apply(this.items[i], [this.items[i], i])) {
                newArray[newArray.length] = this.items[i];
            }
        }
        return JSLINQ(newArray);
    },
    select: function (clause) {
        var item, newArray = [], field = clause;
        if (typeof (clause) !== "function") {
            if (clause.indexOf(",") === -1) {
                clause = function () { return this[field]; };
            } else {
                clause = function () {
                    var i, fields = field.split(","), obj = {};
                    for (i = 0; i < fields.length; i++) {
                        obj[fields[i]] = this[fields[i]];
                    }
                    return obj;
                };
            }
        }

        // The clause was passed in as a Method that returns a Value
        for (var i = 0; i < this.items.length; i++) {
            item = clause.apply(this.items[i], [this.items[i]]);
            if (item) {
                newArray[newArray.length] = item;
            }
        }
        return JSLINQ(newArray);
    },
    orderBy: function (clause) {
        var tempArray = [];
        for (var i = 0; i < this.items.length; i++) {
            tempArray[tempArray.length] = this.items[i];
        }

        if (typeof (clause) !== "function") {
            var field = clause;
            if (utils.isLambda(field)) {
                clause = utils.processLambda(field);
            }
            else {
                clause = function () { return this[field]; };
            }
        }

        return JSLINQ(
            tempArray.sort(function (a, b) {
                var x = clause.apply(a, [a]), y = clause.apply(b, [b]);
                return ((x < y) ? -1 : ((x > y) ? 1 : 0));
            })
        );
    },
    orderByDescending: function (clause) {
        var tempArray = [], field;
        for (var i = 0; i < this.items.length; i++) {
            tempArray[tempArray.length] = this.items[i];
        }

        if (typeof (clause) !== "function") {
            field = clause;
            if (utils.isLambda(field)) {
                clause = utils.processLambda(field);
            }
            else {
                clause = function () { return this[field]; };
            }
        }

        return JSLINQ(tempArray.sort(function (a, b) {
            var x = clause.apply(b, [b]), y = clause.apply(a, [a]);
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
        }));
    },
    selectMany: function (clause) {
        var r = [];
        for (var i = 0; i < this.items.length; i++) {
            r = r.concat(clause.apply(this.items[i], [this.items[i]]));
        }
        return JSLINQ(r);
    },
    count: function (clause) {
        if (clause === undefined) {
            return this.items.length;
        } else {
            return this.Where(clause).items.length;
        }
    },
    distinct: function (clause) {
        var item, dict = {}, retVal = [];
        for (var i = 0; i < this.items.length; i++) {
            item = clause.apply(this.items[i], [this.items[i]]);
            // TODO - This doesn't correctly compare Objects. Need to fix this
            if (dict[item] === undefined) {
                dict[item] = true;
                retVal.push(item);
            }
        }
        dict = null;
        return JSLINQ(retVal);
    },
    any: function (clause) {
        for (var i = 0; i < this.items.length; i++) {
            if (clause.apply(this.items[i], [this.items[i], i])) { return true; }
        }
        return false;
    },
    all: function (clause) {
        for (var i = 0; i < this.items.length; i++) {
            if (!clause(this.items[i], i)) { return false; }
        }
        return true;
    },
    reverse: function () {
        var retVal = [];
        for (var i = this.items.length - 1; i > -1; i--) {
            retVal[retVal.length] = this.items[i];
        }
        return JSLINQ(retVal);
    },
    first: function (clause) {
        if (clause !== undefined) {
            return this.Where(clause).First();
        }
        else {
            // If no clause was specified, then return the First element in the Array
            if (this.items.length > 0) {
                return this.items[0];
            } else {
                return null;
            }
        }
    },
    last: function (clause) {
        if (clause !== undefined) {
            return this.Where(clause).Last();
        }
        else {
            // If no clause was specified, then return the First element in the Array
            if (this.items.length > 0) {
                return this.items[this.items.length - 1];
            } else {
                return null;
            }
        }
    },
    elementAt: function (i) {
        return this.items[i];
    },
    concat: function (array) {
        var arr = array.items || array;
        return JSLINQ(this.items.concat(arr));
    },
    intersect: function (secondArray, clause) {
        var clauseMethod, sa = (secondArray.items || secondArray), result = [];
        if (clause !== undefined) {
            clauseMethod = clause;
        } else {
            clauseMethod = function (item, index, item2, index2) { return item === item2; };
        }

        for (var a = 0; a < this.items.length; a++) {
            for (var b = 0; b < sa.length; b++) {
                if (clauseMethod(this.items[a], a, sa[b], b)) {
                    result[result.length] = this.items[a];
                }
            }
        }
        return JSLINQ(result);
    },
    defaultIfEmpty: function (defaultValue) {
        if (this.items.length === 0) {
            return defaultValue;
        }
        return this;
    },
    elementAtOrDefault: function (i, defaultValue) {
        if (i >= 0 && i < this.items.length) {
            return this.items[i];
        }
        return defaultValue;
    },
    firstOrDefault: function (defaultValue) {
        return this.First() || defaultValue;
    },
    lastOrDefault: function (defaultValue) {
        return this.Last() || defaultValue;
    },
    take: function (count) {
        return this.Where(function (item, index) { return index < count; });
    },
    skip: function (count) {
        return this.Where(function (item, index) { return index >= count; });
    },
    each: function (clause) {
        var len = this.items.length;
        for (var i = 0; i < len; i++) {
            clause.apply(this.items[i], [this.items[i], i]);
        }
        return this;
    },
    random: function (count) {
        var len = this.Count(), rnd = [];
        if (!count) { count = 1; }
        for (var i = 0; i < count; i++) {
            rnd.push(utils.randomIndex(len - 1, rnd));
        }
        rnd = JSLINQ(rnd);
        return this.Where(function (item, index) {
            return rnd.Where(function () {
                    return this == index;
                }).Count() > 0;
        });
    }
};

(function (fn) {
    fn.ToArray = fn.toArray;
    fn.Where = fn.where;
    fn.Select = fn.select;
    fn.OrderBy = fn.orderBy;
    fn.OrderByDescending = fn.orderByDescending;
    fn.SelectMany = fn.selectMany;
    fn.Count = fn.count;
    fn.Distinct = fn.distinct;
    fn.Any = fn.any;
    fn.All = fn.all;
    fn.Reverse = fn.reverse;
    fn.First = fn.first;
    fn.Last = fn.last;
    fn.ElementAt = fn.elementAt;
    fn.Concat = fn.concat;
    fn.Intersect = fn.intersect;
    fn.DefaultIfEmpty = fn.defaultIfEmpty;
    fn.ElementAtOrDefault = fn.elementAtOrDefault;
    fn.FirstOrDefault = fn.firstOrDefault;
    fn.LastOrDefault = fn.lastOrDefault;
    fn.Take = fn.take;
    fn.Skip = fn.skip;
    fn.Each = fn.each;
    fn.Random = fn.random;
})(JSLINQ.fn);

JSLINQ.fn.init.prototype = JSLINQ.fn;

Parse.Cloud.define("eachDuplicates4", function (request, response) {
     Parse.Cloud.useMasterKey();
     
     var totalQuery = new Parse.Query('Customer');
     var countIterations = 0;
     var resultArray = [];
     var findResult = [];
     
     var toUpdateCostumers = [];
     
     function updateUser(customers, index) {
     
     countIterations++;
     
     if (index < customers.length) {
     var costumer = customers[index];
     var duplicateQuery = new Parse.Query('Customer');
     var search = 0;
     
     duplicateQuery = duplicateQuery.notEqualTo('objectId', costumer.id).notEqualTo('never_link', true);
     
     if (costumer.get('sex')) {
     search++;
     duplicateQuery = duplicateQuery.equalTo('sex', costumer.get('sex'));
     }
     
     if (costumer.get('placeOfBirth')) {
     search++;
     duplicateQuery = duplicateQuery.equalTo('placeOfBirth', costumer.get('placeOfBirth'));
     }
     
     if (costumer.get('dateOfBirth')) {
     search++;
     duplicateQuery = duplicateQuery.equalTo('dateOfBirth', costumer.get('dateOfBirth'));
     }
     
     if (search > 2) {
     duplicateQuery.find({
         success: function (duplicates) {
         var duplicateList = [];
         
         for (var i = 0; i < duplicates.length; ++i) {
         var objectId = duplicates[i].id;
         if (objectId) {
         duplicateList.push(objectId);
         }
         }
         
         resultArray.push([costumer.id, search, duplicateList]);
         
         if (findResult.length) {
         findResult.push([costumer.id, duplicateList]);
         }
         
         if (duplicateList.length > 0) {
         costumer.set("duplicates", duplicateList);
         costumer.set("weeklyHoroscopeEnabled", 0);
         costumer.set("ban", true);
         } else {
         costumer.set("ban", false);
         }
         
         toUpdateCostumers.push(costumer);
         
         costumer.set("duplicates_last_scan", new Date());
         costumer.save();
         
         updateUser(customers, index + 1);
         },
         error: function (error) {
         response.error("RUNTIME Error: " + countIterations + ' - ' + error.message);
         }
         });
     } else {
     resultArray.push([costumer.id, 'No criteria']);
     toUpdateCostumers.push(costumer);
     
     costumer.set("ban", false);
     
     costumer.set("duplicates", null);
     costumer.set("duplicates_last_scan", new Date());
     costumer.save();
     
     updateUser(customers, index + 1);
     }
     
     
     } else {
     
     Parse.Object.saveAll(toUpdateCostumers, {
        success: function (list) {
        //response.success(['saveALL', countIterations, findResult, resultArray]);
        response.success('Success');
        },
        error: function (error) {
        response.error("RUNTIME Error: " + countIterations + ' - ' + error.message);
        }
        });
     
     
     }
     }
     
     
     totalQuery.limit(50)
     .notEqualTo('never_link', true)
     .ascending('duplicates_last_scan')
     .gre
     .find({
           success: function (customers) {
           
           updateUser(customers, 0);
           
           },
           error: function (error) {
           response.error("RUNTIME Error: " + error.code + " " + error.message);
           }
           });
     });


Parse.Cloud.define("eachDuplicates2", function (request, response) {
     Parse.Cloud.useMasterKey();
     
     var totalQuery = new Parse.Query('Customer');
     var countIterations = 0;
     var resultArray = [];
     var findResult = [];
     
     function updateUser(customers, index) {
     
     countIterations++;
     
     if (index < customers.length) {
     var costumer = customers[index];
     var duplicateQuery = new Parse.Query('Customer');
     var search = 0;
     
     duplicateQuery = duplicateQuery.notEqualTo('objectId', costumer.id);
     
     if (costumer.get('sex')) {
     search++;
     duplicateQuery = duplicateQuery.equalTo('sex', costumer.get('sex'));
     }
     
     if (costumer.get('dateOfBirth')) {
     search++;
     duplicateQuery = duplicateQuery.equalTo('dateOfBirth', costumer.get('dateOfBirth'));
     }
     
     if (costumer.get('country')) {
     search++;
     duplicateQuery = duplicateQuery.equalTo('country', costumer.get('dateOfBirth'));
     }
     
     if (search > 2) {
     duplicateQuery.find({
         success: function (duplicates) {
         var duplicateList = [];
         
         for (var i = 0; i < duplicates.length; ++i) {
         var objectId = duplicates[i].id;
         if (objectId) {
         duplicateList.push(objectId);
         }
         }
         
         resultArray.push([costumer.id, duplicateList]);
         
         if (findResult.length) {
         findResult.push([costumer.id, duplicateList]);
         }
         
         costumer.set("duplicates", duplicateList);
         costumer.save();
         
         updateUser(customers, index + 1);
         },
         error: function (error) {
         response.error("RUNTIME Error: " + countIterations + ' - ' + error.message);
         }
         });
     } else {
     resultArray.push([costumer.id, 'No criteria']);
     
     //costumer.set("duplicates", []);
     //costumer.save();
     
     updateUser(customers, index + 1);
     }
     
     
     } else {
     response.success([countIterations, findResult, resultArray]);
     }
     }
     
     totalQuery.limit(request.params.take).skip(request.params.skip).find({
          success: function (customers) {
          
          updateUser(customers, 0);
          
          },
          error: function (error) {
          response.error("RUNTIME Error: " + error.code + " " + error.message);
          }
          });
   });



/**
 * test suggested
 */

Parse.Cloud.define("testSuggestedAnswers", function (request, response) {
                   
     var string = request.params.text;
     var resp = [];
     var query = new Parse.Query('AutoAnswer');
     var offset = 7;
     
     //1
     query = strategy1(string, query);
     
     query.limit(offset);
     
     query.find({
          success: function (results) {
          
          // Do something with the returned Parse.Object values
          for (var i = 0; i < results.length; i++) {
          
          var object = results[i];
          
          resp[i] = object.get('answer');
          }
          
          response.success(resp);
          },
          error: function (error) {
          
          response.error("Error: " + error.code + " " + error.message);
          }
          
      });
     
     });


/**
 * detects a new customer within a day
 * @param totalQuery
 * @param callback
 */
function recentCustomer(response, totalQuery, expirationDate, callback) {
    
    //var expirationDate = new Date('08-11-2015');
    
    var totalQuery = new Parse.Query('Customer');
    
    ///totalQuery.equalTo('objectId', 'AtcOQA9AMT');;
    totalQuery//.greaterThan('createdAt', expirationDate)
    .notEqualTo('never_link', true)
    .doesNotExist("linked_customers")
    .doesNotExist("duplicates_last_scan");
    
    
    totalQuery.find({
      success: function (customers) {
      
      if (customers) {
      callback(customers)
      }
      else {
      response.success("No new user");
      }
      },
      error: function (error) {
      response.error("Error: " + error.code + " " + error.message);
      }
      });
}

/**
 *
 * @param message
 */
function fullyAutoAnswer(message) {
    
    // if (!message.existed() && !message.get('status')) { // it is new
    
    var minutes = 5;
    var $object = Parse.Object.extend("FullyAutoAnswer");
    var query = new Parse.Query($object);
    
    
    query.matches("question", message.get('searchWords'));
    query.ascending('UsageCounter');
    
    query.first({
        success: function (fullyAuto) {
        
        var fullyAuto = fullyAuto;
        
        
        //increase counter for fully auto
        fullyAuto.increment('UsageCounter');
        fullyAuto.save();
        
        
        console.log(fullyAuto.get('UsageCounter'));
        
        var $object = Parse.Object.extend("Astrologer");
        var query1 = new Parse.Query($object);
        var rnd = getRandomInt(0, 20);
        
        query1.skip(rnd).first({
           success: function (astrologer) {
           
           // Successfully retrieved the object.
           //answers + 10 minute
           var dateOld = new Date();
           var date = new Date(dateOld.getTime() + minutes * 120000);
           
           var $object = Parse.Object.extend("Message");
           var newMessage = new $object();
           
           newMessage.set('Customer', message.get('Customer'));
           newMessage.set('text', fullyAuto.get('answer'));
           newMessage.set('searchWords', fullyAuto.get('searchWords'));
           newMessage.set('status', 'answered');
           
           newMessage.set('sender', fullyAuto.get('senderName'));

           newMessage.set('validAt', date);
           //   newMessage.save()
           
           newMessage.save(null, {
               success: function (newMessage) {
               
               message.set('answer', newMessage);
               message.set('status', 'auto');
               message.save();
               },
               error: function (newMessage, error) {
               
               }
           });
           
           
           },
           error: function () {
           
           }
           });
        
        },
        error: function (error) {
        alert("Error: " + error.code + " " + error.message);
        }
    });
    
    //  }
}

/**
 * gets unanswered
 * @returns {Parse.Query}
 */
function queryUnanswered(object) {
    
    var message = object;
    var string = message.get('searchWords');
    var resp = [];
    var query = new Parse.Query('AutoAnswer');
    var offset = 7;
    
    //1
    query = strategy1(string, query);
    
    query.limit(offset);
    
    query.find({
       success: function (results) {
       
       // Do something with the returned Parse.Object values
       for (var i = 0; i < results.length; i++) {
       
       var object = results[i];
       resp[i] = object.id;
       }
       
       message.set('suggestedAnswers', resp);
       message.save();
       
       },
       error: function (error) {
       
       }
       
     });
}


//strategies
/**
 * strategy #1 by first 3 words
 * @param string
 * @param query
 * @returns {*}
 */


function strategy1(string, query) {
    
    var substring = trimByWord(string, 0, 3);
    query.matches("searchWords", substring);
    
    return query;
}


/**
 * gets a subset of words
 * @param sentence
 * @param start
 * @param end
 * @returns {*}
 */
function trimByWord(sentence, start, end) {
    
    var result = sentence;
    
    var resultArray = result.split(" ");
    if (resultArray.length > (end - start)) {
        resultArray = resultArray.slice(start, end);
        result = resultArray.join(" ");
    }
    
    return result;
}

/**
 * random generator
 * @param min
 * @param max
 * @returns {*}
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


/**
 * Duplicate customers
 * @param object1
 * @param object2
 * @returns {boolean}
 */
function duplicatesStrategy1(object1,object2){
    
    var array = ['sex','placeOfBirth','dateOfBirthString'];
    var search = 0;
    
    for (var i = 0; i < array.length; i++) {
        
        var first = textClean(object1.get(array[i]));
        var second = textClean(object2.get(array[i]));
        
        
        if (first && second && (first.localeCompare(second)==0)){
            search++;
            
            //console.log(first);
            //console.log('----');
            //console.log(second);
        }
    }
    
    
    //if(search >= 3){
    //    console.log(object1.id,object2.id);
    //    console.log(textClean(object1.get(array[0])));
    //    console.log(textClean(object1.get(array[1])));
    //    console.log(textClean(object1.get(array[2])));
    //
    //    console.log(textClean(object2.get(array[0])));
    //    console.log(textClean(object2.get(array[1])));
    //    console.log(textClean(object2.get(array[2])));
    //}
    
    return search >= 3;
}

function duplicatesStrategy2(object1,object2){
    
    var array = ['firstName','timeOfBirthString','placeOfBirth', 'email'];
    var search = 0;
    
    for (var i = 0; i < array.length; i++) {
        
        var first = textClean(object1.get(array[i]));
        var second = textClean(object2.get(array[i]));
        
        
        if (first && second && first!="Not Sure" && second!="Not Sure" && (first.localeCompare(second)==0)){
            search++;
            console.log(first);
            console.log('----');
            console.log(second);
        }
    }
    return search >= 1;
}
                                        
function textClean(searchWords)
{
    if(searchWords){
        searchWords = searchWords.replace(/[\.,-\/#!\?$%\^&\*;:{}=\-_`~()]/g, "");
        //	searchWords = searchWords.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        searchWords = searchWords.replace(/\s{2,}/g, " ");
        searchWords = searchWords.toLowerCase();
    }
    
    return searchWords;
}

function sendPushNotification(message) {
    
    
}