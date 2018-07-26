let express = require('express')
  , main = require('./main')
  , crm = require('./crm')
  , app = express()
  , updateInterval = 1000
  , env = { Local: 0, Azure: 1 };

module.exports.Globals = Globals = {
  env: env,
  envMode: env.Azure
};

process.argv.forEach((val) => {
  if (val === 'local')
    Globals.envMode = Globals.env.Local;
});

setInterval(() => {
  if (main.Globals.Runable == true)
    main.Run(); 
}, updateInterval);

app.use(express.static('www'));

app.get(':userId/triggers', function(req, res) {
  let user = crm.users.find( x => x.id === userId);
  if (user)
  { 
    try {
      res.send(user.triggers);
    } catch (error) {
      res.send("não rolou pegar os triggers");
    }
  }
  else
    res.send("não encontrei esse user");
});

app.get(':userId/triggers/:currency_code/:transaction_type/:var/:value', function(req, res) {
  let user = crm.users.find( x => x.id === req.params.userId);
  if (user)
  { 
    try {
      let currency = user.find( x => x.currency_code === req.params.currency_code);
      if (currency)
      { 
        currency.triggers[req.params.transaction_type][req.params.var] = req.params.value;
        res.send(currency.triggers);
      }
      else
        res.send("não encontrei essa currency");
    } catch (error) {
      res.send("não rolou alterar os triggers");
    }
  }
  else
    res.send("não encontrei esse user");
});

if (Globals.envMode === Globals.env.Local)
  app.listen(80);
else
  app.listen(process.env.PORT);

