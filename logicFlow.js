let api = require('./apiMethods')
  , logic = require('./logicMethods')
  , Locals = {
      pendingOrders: [],
      minimumTradeMoneyAmount: 25,
      numberOfTradesForCurrencyAnalysis: 1000 };

module.exports.executeTriggers = async function (user)
{
  try
  {
    let balance = await api.GetBalance(user.token);
    let buyingData = { currencies: [], balance: null };
    for (currency of balance)
    {
      if (currency.currency_code === "BRL")
        buyingData.balance = currency;
      else
      {
        let userCurrency = user.currencies.find(x => x.currency_code === currency.currency_code);
        // check if this currency from balance has reference on user's settings
        if (userCurrency)
        {
          let ticker = await api.GetTicker(user.token, currency.currency_code);
          let trades = await api.GetTrades(user.token, currency.currency_code, Locals.numberOfTradesForCurrencyAnalysis);
          let userOrders = await api.GetUserOrders(user.token, currency.currency_code, "waiting+executed_partially");
          
          //let [ticker, trades, userOrders] = [ await tickerPromise, await tradesPromise, await userOrdersPromise ];

          let currencyData = {
            currency_code: currency.currency_code,
            triggers: userCurrency.triggers,
            ticker: ticker,
            trades: trades["trades"],
            userOrders: userOrders["orders"]
          };

          //console.log("currencyData: ",currencyData.trades[currencyData.trades.length-1]);
          buyingData.currencies.push(currencyData);

          //userCurrency.triggers.sell = logic.updateSellingTrigger(currencyData);
          let currencyAmount = await updateTradeAmount(user.token, currency, currencyData.ticker, currencyData.userOrders, "sell");
          await executeSellingTrigger(user.token, currencyAmount, currencyData.currency_code, currencyData.triggers.sell, currencyData.ticker, currencyData.trades);  
        }
      }
    }

    //userCurrency.triggers.buy = logic.updateBuyingTrigger(buyingData.currencies);
    let currencyAmount = 0;
    for(currency of buyingData.currencies)
    {
      let newAmount = await updateTradeAmount(user.token, buyingData.balance, currency.ticker, currency.userOrders, "buy");
      if (newAmount > currencyAmount)
        currencyAmount = newAmount;
    }
    await executeBuyingTrigger(user.token, currencyAmount, buyingData.currencies);

  } catch (error) {
    throw "executeTriggers -> "+error;
  }
}

async function updateTradeAmount(token, balance, ticker, userOrders, type)
{
  let locked_amount = balance["locked_amount"];
  let available_amount = balance["available_amount"];
  let currencyAmountToBeTraded = available_amount;
  if (locked_amount > 0)
  {
    let newBalanceNeeded = false;
    let bestOffer = ticker[type];
    for (order of userOrders)
    { 
      if (order["type"] === type && (order["status"] === "waiting" || order["status"] === "executed_partially"))
      {
        // check if its not the best offer or if its best but there is still available amount to make a new order with the entire amount
        if (order["unit_price"] !== bestOffer || (order["unit_price"] === bestOffer && available_amount > 0))
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

  return currencyAmountToBeTraded;
}

async function executeSellingTrigger(token, currencyAmount, currency_code, trigger, ticker, trades)
{
  try
  {
    if (currencyAmount > 0)
    {
      let sellingOportunity = logic.CheckSellTriggers(currency_code, trigger, ticker, trades);
      //check if there is good oportunities to sell currency and if the currency amount is higher or equal to the minimum trade value
      if (sellingOportunity !== undefined && currencyAmount*sellingOportunity >= Locals.minimumTradeMoneyAmount)
      {
        /////////////////////////////////////////////////
        // ----------- place selling order ----------- //
        /////////////////////////////////////////////////
        await api.CreateOrder(token, currency_code, currencyAmount, "sell", sellingOportunity);
        //console.log("selling order that should be placed: "+currency_code+" , qtd: "+currencyAmount+" preco: "+sellingOportunity);
      }
    }
  } catch (error) {
    throw "executeSellingTrigger -> "+error;
  }
}

async function executeBuyingTrigger(token, currencyAmount, currencies)
{
  try
  {
    // check if the available money amount is higher or equal to the minimum trade value
    if (currencyAmount >= Locals.minimumTradeMoneyAmount)
    {
      let buyingOportunity = logic.CheckBuyTriggers(currencies);
      //check if there is good oportunities to buy currency
      if (buyingOportunity !== undefined)
      {
        //////////////////////////////////////////
        // -------- place buying order -------- //
        //////////////////////////////////////////
        let currencyBuyingValue = buyingOportunity["buying_value"];
        let currencyAmountToBeTraded = logic.ConvertMoneyToCurrency(currencyAmount, currencyBuyingValue);
        await api.CreateOrder(token, buyingOportunity["currency_code"], currencyAmountToBeTraded, "buy", currencyBuyingValue);
        //console.log("buying order should be placed: "+buyingOportunity["currency_code"]+" , qtd: "+currencyAmount+" preco: "+currencyBuyingValue);
      }
    }
  } catch (error) {
    throw "executeBuyingTrigger -> "+error;
  }
}

