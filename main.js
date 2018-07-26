let server = require('./server')
  , crm = require('./crm')
  , logicFlow = require('./logicFlow')
  , Locals = {
      updateInterval: 10000 }  
  , Globals = {
      Runable: true };

module.exports.Globals = Globals;

module.exports.Run = async function()
{
  Globals.Runable = false;
  let initialTime = Date.now();

  try {
    for(user of crm.users)
    { 
      //let currencies = await logicFlow.updateTriggers(user); 
      //if(currencies !== null)
      {
        //user.currencies = currencies;
        await logicFlow.executeTriggers(user); 
      }
    }
  } 
  catch(error) {
    if (server.Globals.envMode === server.Globals.env.Local)
      console.log("error: ",error);
  }

  waitNextCycle(initialTime);
}

function waitNextCycle(initialTime)
{
  let finishTime = Date.now()
    , duration = finishTime - initialTime
    , remainingTime = Locals.updateInterval - duration;

  if (remainingTime <= 0)
    Globals.Runable = true;
  else
    setTimeout(() => {
      Globals.Runable = true;
    }, remainingTime);
}