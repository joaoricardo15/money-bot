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
    let buyingData = { balance: null, currencies: [] };
    for (currency of balance)
    {
      if (currency.currency_code === "BRL")
        buyingData.balance = currency;
      else
      {
        let ticker = await api.GetTiker(user.token, currency.currency_code);
        let trades = await api.GetTrades(user.token, currency.currency_code, Locals.numberOfTradesForSellTriggers);
        let userOrders = await api.GetUserOrders(user.token, currency.currency_code, "waiting");
        let userCurrency = user.currencies.find(x => x.currency_code === currency.currency_code);
        // check if this currency from balance has reference on user's settings
        if (userCurrency)
        {
          await executeSellingTrigger(user.token, currency, ticker, userOrders["orders"], trades["trades"], userCurrency.triggers.sell);
          buyingData.currencies.push({currency_code: currency.currency_code, ticker: ticker, userOrders: userOrders["orders"], trigger: userCurrency.triggers.buy});
        }
      }
    }

    await executeBuyingTrigger(user.token, buyingData);

  } catch (error) {
    throw "executeTriggers -> "+error;
  }
}

async function executeBuyingTrigger(token, buyingData)
{
  try
  {
    let locked_amount = buyingData.balance["locked_amount"];
    let available_amount = buyingData.balance["available_amount"];
    // check if there are resources of this currency
    if (available_amount > 0 || locked_amount > 0)
    {
      let currencyAmountToBeTraded = available_amount;

      if (locked_amount >= Locals.minimumTradeMoneyAmount)
      {
        let newBalanceNeeded = false;
        for (currency of buyingData.currencies)
        {
          let bestBuyOffer = currency.ticker["buy"];s
          for (order of currency.userOrders)
          {
            if (order["type"] === "buy")
            {
              // check if its not the best offer or if its best but there is still available amount to make a new order with the entire amount
              if (order["unit_price"] !== bestBuyOffer || (order["unit_price"] === bestBuyOffer && available_amount > 0))
              {
                //cancels the selling order placed
                await api.CancelOrder(token, order["id"]);
                newBalanceNeeded = true;
              }
            }
          }
        }
        if (newBalanceNeeded)
        {
          let newBalance = await api.GetBalance(token);
          currencyAmountToBeTraded = logic.GetAvailableAmount(buyingData.balance.currency_code, newBalance);
        }
      }  

      // check if the available money amount is higher or equal to the minimum trade value
      if (currencyAmountToBeTraded >= Locals.minimumTradeMoneyAmount)
      {
        let result = logic.CheckBuyTriggers(buyingData.currencies);
        // check if there is good oportunities to sell currency
        if (result !== undefined)
        {
          //////////////////////////////////////////
          // -------- place buying order -------- //
          //////////////////////////////////////////
          let currencyBuyingValue = result["buying_value"];
          let currencyAmount = logic.ConvertMoneyToCurrency(currencyAmountToBeTraded, currencyBuyingValue);
          api.CreateOrder(user.token, result["currency_code"], currencyAmount, "buy", currencyBuyingValue);
          //console.log("buying order should be placed: "+result["currency_code"]+" , qtd: "+currencyAmount+" preco: "+currencyBuyingValue);
        }
      }
    }
  } catch (error) {
    throw "executeBuyingTrigger -> "+error;
  }
}

async function executeSellingTrigger(token, balance, ticker, userOrders, trades, trigger)
{
  try
  {
    let locked_amount = balance["locked_amount"];
    let available_amount = balance["available_amount"];
    // check if there are resources of this currency
    if (available_amount > 0 || locked_amount > 0)
    {
      let currencyAmountToBeTraded = available_amount;

      if (locked_amount > 0)
      {
        let newBalanceNeeded = false;
        let bestSellOffer = ticker["sell"];
        for (order of userOrders)
        { 
          if (order["type"] === "sell")
          {
            // check if its not the best offer or if its best but there is still available amount to make a new order with the entire amount
            if (order["unit_price"] !== bestSellOffer || (order["unit_price"] === bestSellOffer && available_amount > 0))
            {
              //cancels the selling order placed
              await api.CancelOrder(token, order["id"]);
              newBalanceNeeded = true;
            }
          }
        }
        if (newBalanceNeeded)
        {
          let newBalance = await api.GetBalance(token);
          currencyAmountToBeTraded = logic.GetAvailableAmount(balance.currency_code, newBalance);
        }
      }

      if (currencyAmountToBeTraded > 0)
      {
        let sellingPrice = logic.CheckSellTriggers(balance.currency_code, trigger, trades, ticker);
        // check if there is good oportunities to sell currency
        if (sellingPrice !== undefined)
        {
          // check if the currency amount is higher or equal to the minimum trade value
          if (currencyAmountToBeTraded*sellingPrice >= Locals.minimumTradeMoneyAmount)
          { 
            /////////////////////////////////////////////////
            // ----------- place selling order ----------- //
            /////////////////////////////////////////////////
            api.CreateOrder(user.token, balance.currency_code, currencyAmountToBeTraded, "sell", sellingPrice);
            //console.log("selling order that should be placed: "+balance.currency_code+" , qtd: "+currencyAmountToBeTraded+" preco: "+sellingPrice);
          }
        }
      }
    }
  } catch (error) {
    throw "executeSellingTrigger -> "+error;
  }
}