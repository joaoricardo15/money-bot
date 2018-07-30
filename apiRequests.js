let https = require('https')
  , url = "api.bitcointrade.com.br";

module.exports.Request = function (token, path, method, payload)
{
  return new Promise(function (resolve, reject) {
    try
    {
      let body;
      let options = {
        host: url,
        path: path,
        method: method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "ApiToken "+token
        }
      }
      if (payload)
      {
        body = JSON.stringify(payload);
        options.headers["Content-Length"] = body.length;
      }
      let req = https.request(options,
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
                reject("https.request -> response JSON.parse");
              else
                reject("https.request -> statusCode: "+response.statusCode);
            }
          });
        }
      );
      if (payload)
        req.write(body);
      req.on("error", (error) => {
        reject("https.request -> "+error);
      });
      req.end();
    } catch (error) {
      throw "Request -> "+error;
    }
  }); 
}