let api = require('./apiMethods')
  , logic = require('./logicMethods')
  , Locals = {
      pendingOrders: [],
      minimumTradeMoneyAmount: 25,
      numberOfTradesForSellTriggers: 6,
      numberOfTradesForCurrencyAnalysis: 500 }; 

module.exports.updateTriggers = async function (user)
{
  let internalcurrencies = JSON.parse(JSON.stringify(user.currencies));

  for(currency of internalcurrencies)
  {
    let currency_code = currency["currency_code"];
    
    // check the buying triggers
    let trades = await api.GetTrades(user, currency_code, Locals.numberOfTradesForCurrencyAnalysis);
    // console.log("trades: ",trades["trades"]);
    let result = logic.CheckBuyOportunities(trades);
    // analyses the last xxx trades and check if there is a good price to buy some currency
    if (result !== undefined)
    {
      
    }
    else
    {
      currency.triggers.buy.enable = false;
      currency.triggers.sell.low.enable = false;
      currency.triggers.sell.high.enable = false;
    }
  }

  return internalcurrencies;
}

module.exports.executeTriggers = async function (user)
{
  try
  {
    let balance = await api.GetBalance(user.token);
    for (currency of balance)
    {
      let currency_code = currency["currency_code"];
      let locked_amount = currency["locked_amount"];
      let available_amount = currency["available_amount"];
      let currencyAmountToBeTraded = 0;
      // check if there are resources of this currency
      if (available_amount > 0 || locked_amount > 0)
      {
        // check the buying triggers
        if (currency_code === "BRL")
        {
          let currencies = [];
          for (currency of user.currencies)
          {
            let ticker = await api.GetTiker(user.token, currency.currency_code);
            currencies.push({currency_code: currency.currency_code, trigger: currency.triggers.buy, ticker: ticker});;
          }

          currencyAmountToBeTraded = available_amount;

          let newBalanceNeeded = false;
          if (locked_amount >= Locals.minimumTradeMoneyAmount)
          {
            for (currency of currencies)
            {
              let userOrders = await api.GetUserOrders(user.token, currency.currency_code, "waiting");
              for (order of userOrders["orders"])
              {
                let botOrder = Locals.pendingOrders.find(x => x.id = order["id"]);
                if (order["type"] === "buy")
                {
                  let bestBuyOffer = currency.ticker["buy"];
                  // check if its not the best offer or if its best but there is still available amount to make a new order with the entire amount
                  if (order["unit_price"] !== bestBuyOffer || (order["unit_price"] === bestBuyOffer && available_amount > 0))
                  {
                    //cancels the selling order placed
                    //await api.CancelOrder(user.token, order["id"]);
                    console.log("buying order should be canceled: "+currency.currency_code+" , id: "+order["id"]);
                    newBalanceNeeded = true;
                  }
                }
              }
            }
          }  
          if (newBalanceNeeded)
          {
            let newBalance = await api.GetBalance(user.token);
            currencyAmountToBeTraded = logic.GetAvailableAmount(currency_code, newBalance);
          }

          // check if the available money amount is higher or equal to the minimum trade value
          if (currencyAmountToBeTraded >= Locals.minimumTradeMoneyAmount)
          {
            let result = logic.CheckBuyTriggers(currencies);
            // check if there is good oportunities to sell currency
            if (result !== undefined)
            {
              //////////////////////////////////////////
              // -------- place buying order -------- //
              //////////////////////////////////////////
              let currencyCode = result["currencyCode"];
              let currencyBuyingValue = result["buyingValue"];
              let currencyAmount = logic.ConvertMoneyToCurrency(currencyAmountToBeTraded, currencyBuyingValue);
              // await api.CreateOrder(user.token, currencyCode, currencyAmount, "buy", currencyBuyingValue);
              console.log("buying order should be placed: "+currencyCode+" , qtd: "+currencyAmount+" preco: "+currencyBuyingValue);
            }
          }
        }
        // check the selling triggers
        else
        {
          let ticker = await api.GetTiker(user.token, currency_code);

          currencyAmountToBeTraded = available_amount;

          if (locked_amount > 0)
          {
            let userOrders = await api.GetUserOrders(user.token, currency_code, "waiting");
            let newBalanceNeeded = false;
            let bestSellOffer = ticker["sell"];
            for (order of userOrders["orders"])
            { 
              if (order["type"] === "sell")
              {
                // check if its not the best offer or if its best but there is still available amount to make a new order with the entire amount
                if (order["unit_price"] !== bestSellOffer || (order["unit_price"] === bestSellOffer && available_amount > 0))
                {
                  //cancels the selling order placed
                  //await api.CancelOrder(user.token, order["id"]);
                  console.log("selling order should be canceled: "+currency_code+" , id: "+order["id"]);
                  newBalanceNeeded = true;
                }
              }
            }
            if (newBalanceNeeded)
            {
                let newBalance = await api.GetBalance(user.token);
                currencyAmountToBeTraded = logic.GetAvailableAmount(currency_code, newBalance);
            }
          }

          if (currencyAmountToBeTraded > 0)
          {
            let trades = await api.GetTrades(user.token, currency_code, Locals.numberOfTradesForSellTriggers);
            let currency = user.currencies.find(x => x.currency_code == currency_code);
            if (currency)
            {  
              let sellingPrice = logic.CheckSellTriggers(currency_code, currency.triggers.sell, trades["trades"], ticker);
              // check if there is good oportunities to sell currency
              if (sellingPrice !== undefined)
              {
                // check if the currency amount is higher or equal to the minimum trade value
                if (currencyAmountToBeTraded*sellingPrice >= Locals.minimumTradeMoneyAmount)
                { 
                  /////////////////////////////////////////////////
                  // ----------- place selling order ----------- //
                  /////////////////////////////////////////////////
                  // await api.CreateOrder(user.token, currencyCode, currencyAmountToBeTraded, "sell", sellingPrice);
                  console.log("selling order that should be placed: "+currency_code+" , qtd: "+currencyAmountToBeTraded+" preco: "+sellingPrice);
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    throw "executeTriggers -> "+error;
  }
} 