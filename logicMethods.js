let server = require('./server');
let numberOfTradesForSellTriggers = 6;
let lowEmergency = 0.99;
let highProfit = 1.01;
let lowProfit = 0.99;

module.exports.updateSellingTrigger = function (buyingData)
{

}

module.exports.updateBuyingTrigger = function (buyingData)
{

}

module.exports.CheckBuyOportunities = function (currencies)
{

}

module.exports.CheckBuyTriggers = function (currencies)
{
  let currencyOportunities = [];
  for (currency of currencies)
  {
    let triggerEnable = currency.triggers.buy.enable;
    if (triggerEnable === true)
    {
      let bestBuyOffer = currency.ticker["buy"];
      let triggerPrice = currency.triggers.buy.price;
      if (bestBuyOffer + 0.01 < triggerPrice)
      { 
        let bestSellOffer = currency.ticker["sell"];
        let currency_code = currency["currency_code"];
        let price;
        // check if it's a very good buying oportunity (last trade was above triggerPrice*lowProfit*lowProfit)
        if (bestSellOffer < triggerPrice*lowProfit*lowProfit)
        {
          if (server.Globals.envMode === server.Globals.env.Local)
            console.log(currency_code," -> very good buying oportunity: ",bestSellOffer.toFixed(2));
          price = bestSellOffer.toFixed(2);
        }
        // check if it's a good buying oportunity (last trade was above triggerPrice*lowProfit)
        else if (bestSellOffer - 0.01 < triggerPrice*lowProfit)
        {
          if (server.Globals.envMode === server.Globals.env.Local)
            console.log(currency_code," -> good buying oportunity: ",(bestSellOffer-0.01).toFixed(2));
          price = (bestSellOffer-0.01).toFixed(2);
        }
        // check if it's a normal buying oportunity (last trade was above triggerPrice*lowProfit)
        else
        {
          if (server.Globals.envMode === server.Globals.env.Local)
            console.log(currency_code," -> buying oportunity: ",(bestBuyOffer + 0.01).toFixed(2));
          price = (bestBuyOffer + 0.01).toFixed(2);
        }
        
        // calculates the potencial of the oportunities
        currencyOportunities.push({currency_code: currency_code, price: price, potencial: triggerPrice/price});
      } 
    } 
  }

  // choose the bestbuying oportunity
  for (let i = 0; i < currencyOportunities.length; i++) {

    let isBestOportunity = true;

    for (let j = 0; j < currencyOportunities.length; j++) {
      if (j === i)
      {
        if (currencyOportunities[i].potencial < 1)
          isBestOportunity = false;
      }
      else
      {
        if (currencyOportunities[i].potencial < currencyOportunities[j].potencial)
          isBestOportunity = false;
      }
    }

    if (isBestOportunity)
      return {
        currency_code: currencyOportunities[i].currency_code,
        buying_value: currencyOportunities[i].price };
  }
}

module.exports.CheckSellTriggers = function (currency_code, triggers, ticker, trades)
{
  let last = ticker["last"];
  let bestBuyOffer = ticker["buy"];
  let bestSellOffer = ticker["sell"];
  let lowTrigger = triggers["low"].price;
  let highTrigger = triggers["high"].price;
  let lowTriggerEnable = triggers["low"].enable;
  let highTriggerEnable = triggers["high"].enable;
  
  if (lowTriggerEnable === true && last < lowTrigger && bestSellOffer < lowTrigger)
  { 
    let isLow = true;

    for (let i = trades.length-1; i >= trades.length-numberOfTradesForSellTriggers; index--) {
      if(!(trades[i]["unit_price"] < lowTrigger))
        isLow = false;
    }
    
    // check if the x last trades were above lowTrigger
    if (isLow)
    {
      let lowEmergencyCount = 0;

      for (let i = trades.length-1; i >= trades.length-numberOfTradesForSellTriggers; index--) {
        if(!(trades[i]["unit_price"] < lowTrigger*lowEmergency))
          lowEmergencyCount++;
      }
      
      // check if it's a critical emergency (half of the x last trades were above lowTrigger*lowEmergency)
      if (lowEmergencyCount == trades.length)
      {
        if (server.Globals.envMode === server.Globals.env.Local)
          console.log(currency_code," -> critical lowEmergency: ",bestBuyOffer.toFixed(2));
        return bestBuyOffer.toFixed(2);
      }
      // check if it's a normal emergency (all of x last trades were above lowTrigger*lowEmergency)
      else if (lowEmergencyCount >= (trades.length/2).toFixed(0))
      {
        if (server.Globals.envMode === server.Globals.env.Local)
          console.log(currency_code," -> normal lowEmergency: ",(bestBuyOffer + 0.01).toFixed(2));
        return (bestBuyOffer + 0.01).toFixed(2);
      }
      // check if it's time to sell and the price is not above buying price (to avoid executer order)
      else if (bestSellOffer - 0.01 > bestBuyOffer)
      {
        if (server.Globals.envMode === server.Globals.env.Local)
          console.log(currency_code," -> normal sell: ",(bestSellOffer - 0.01).toFixed(2));
        return (bestSellOffer - 0.01).toFixed(2);
      }
        
      else
      {
        if (server.Globals.envMode === server.Globals.env.Local)
          console.log(currency_code," -> normal sell same last: ",(bestSellOffer - 0.01).toFixed(2));
        return bestSellOffer.toFixed(2);
      }
    }   
  }
  else if (highTriggerEnable === true && bestSellOffer >= highTrigger)
  { 
    // check if it is a very good opotunity
    if (bestBuyOffer >= highTrigger*highProfit*highProfit)
    {
      if (server.Globals.envMode === server.Globals.env.Local)
        console.log(currency_code," -> very good selling oportunity: ",bestBuyOffer.toFixed(2));
      return bestBuyOffer.toFixed(2);
    }
    // check if it is a good opotunity
    else if (bestBuyOffer >= highTrigger*highProfit)
    {
      if (server.Globals.envMode === server.Globals.env.Local)
        console.log(currency_code," -> good selling oportunity: ",(bestBuyOffer + 0.01).toFixed(2));
      return (bestBuyOffer + 0.01).toFixed(2);
    }
    // check if it's time to sell and the price is not above buying price (to avoid executer order)
    else if (bestSellOffer - 0.01 > bestBuyOffer)
    {
      if (server.Globals.envMode === server.Globals.env.Local)
        console.log(currency_code," -> normal selling oportunity: ",(bestSellOffer - 0.01).toFixed(2));
      return (bestSellOffer - 0.01).toFixed(2);
    }
    else
    {
      if (server.Globals.envMode === server.Globals.env.Local)
        console.log(currency_code," -> normal selling oportunity same last: ",(bestSellOffer - 0.01).toFixed(2));
      return bestSellOffer.toFixed(2);
    }
  }
}

module.exports.GetDaoIndex = function GetDaoIndex(trades)
{
  let orders = trades["orders"];
  let completeInterval = (Date.parse(orders[0]["date"]) - Date.parse(orders[orders.length - 1]["date"]))/(1000*3600);

  let totalAmount = 0;
  let totalValue = 0;
  let lastValue = 0;
  let lastDate = 0;
  let daoIndex = 0;

  orders.forEach(order => {
    
    let currentValue = order["unit_price"];
    let currentDate = Date.parse(order["date"]);

    if (lastValue > 0 && lastDate > 0)
    {
      let variation = 100*(currentValue / lastValue - 1);   
      let interval = (lastDate - currentDate)/1000 < 1 ? 1 : (lastDate - currentDate)/1000;
      let currentAmount = order["amount"];

      daoIndex += (currentAmount*lastValue*variation)/(interval);
      totalAmount += currentAmount;
      totalValue += currentValue;
    }

    lastValue = currentValue;
    lastDate = currentDate;
  });

  daoIndex = (daoIndex*completeInterval) / (totalAmount*totalValue);
  if (server.Globals.envMode === server.Globals.env.Local)
    console.log("daoIndex: "+daoIndex);

  return daoIndex;
}

module.exports.GetTotalMoney = function GetTotalMoney(balance, lastValues)
{
  var totalMoney = 0;

  for (currency of balance)
  {
    var currency_code = currency['currency_code'];
    if (currency_code == 'BRL')
      totalMoney += currency['available_amount'] + currency['locked_amount'];
    else
      totalMoney += (currency['available_amount'] + currency['locked_amount'])*lastValues[currency_code];
  }

  return totalMoney.toFixed(2);
}

module.exports.GetAvailableAmount = function GetAvailableAmount(currency_code, balance)
{
  let currency = balance.find(x => x.currency_code == currency_code);
  return currency.available_amount;
}

module.exports.GetLockedAmout = function GetLockedAmout(currency_code, balance)
{
  let currency = balance.find(x => x.currency_code == currency_code);
  return currency.locked_amount;
}

module.exports.ConvertMoneyToCurrency = function ConvertMoneyToCurrency(money_amount, unit_price)
{
  return money_amount / unit_price;
}