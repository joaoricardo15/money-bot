let https = require('http')
//  , url = "api.bitcointrade.com.br";
, url = "http://localhost";

module.exports.Get = function (token, path)
{
  return new Promise(function (resolve, reject) {
    let req = https.get({
      host: url,
      path: path,
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "ApiToken "+token }
      }, function(response) {
        
          // Continuously update stream with data
          var body = "";
          response.on("data", function(d) {
            body += d;
          });
          response.on("end", function() {
            // Data received, let us parse it using JSON!
            try {
              let parsedBody = JSON.parse(body)
              resolve(parsedBody);
            } catch (error) {
              // Check if there was success on the request 
              if (response.statusCode === 200)
                reject("https.get -> parse");
              else
                reject("https.get -> statusCode: "+response.statusCode);
            }
          });
        
      });
    req.on("error", (error) => {
      reject("https.get -> "+error);
    });
    req.end();
  });
}

module.exports.Request = function (token, path, method, body)
{
  return new Promise(function (resolve, reject) {
    let payload = JSON.stringify(body);
    let req = https.request({
      host: url,
      path: path,
      method: method,
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "ApiToken "+token,
        "Content-Length": payload.length}
      },
      function(response) {
        // Continuously update stream with data
        var body = "";
        response.on("data", function(d) {
          body += d;
        });
        response.on("end", function() {
          // Data received, let us parse it using JSON!     
          
          try {
            let parsedBody = JSON.parse(body)
            resolve(parsedBody);
          } catch (error) {
            // Check if there was success on the request 
            if (response.statusCode === 200)
              reject("https.request -> parse");
            else
              reject("https.request -> statusCode: "+response.statusCode);
          }
        });
      });
    req.write(payload);
    req.on("error", (error) => {
      reject("https.request -> ",error);
    });
    req.end();
  });
}