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
    for (let currencyBalance of balance)
    {
      if (currencyBalance.currency_code === "BRL")
        buyingData.balance = currencyBalance;
      else
      {
        let userCurrency = user.currencies.find(x => x.currency_code === currencyBalance.currency_code);
        // check if this currency from balance has reference on user's settings
        if (userCurrency)
        {
          let orders = await api.GetOrders(user.token, currencyBalance.currency_code);
          let trades = await api.GetTrades(user.token, currencyBalance.currency_code, Locals.numberOfTradesForCurrencyAnalysis);
          let userOrders = await api.GetUserOrders(user.token, currencyBalance.currency_code, "waiting+executed_partially");
          let currencyData = {
            currency_code: currencyBalance.currency_code,
            triggers: userCurrency.triggers,
            orders: orders,
            trades: trades["trades"],
            userOrders: userOrders["orders"]
          };
          buyingData.currencies.push(currencyData);

          //userCurrency.triggers.sell = logic.updateSellingTrigger(currencyData);
          let currencyAmount = await updateTradeAmount(user.token, currencyBalance, currencyData, "sell");
          await executeSellingTrigger(user.token, currencyAmount, currencyData);  
        }
      }
    }

    //userCurrency.triggers.buy = logic.updateBuyingTrigger(buyingData.currencies);
    let currencyAmount = 0;
    for(let currency of buyingData.currencies)
    {
      let newAmount = await updateTradeAmount(user.token, buyingData.balance, currency.orders, currency.userOrders, "buy");
      if (newAmount > currencyAmount)
        currencyAmount = newAmount;
    }
    await executeBuyingTrigger(user.token, currencyAmount, buyingData.currencies);

  } catch (error) {
    throw "executeTriggers -> "+error;
  }
}

async function updateTradeAmount(token, balance, currencyData, type)
{
  let locked_amount = balance["locked_amount"];
  let available_amount = balance["available_amount"];
  let currencyAmountToBeTraded = available_amount;
  if (locked_amount > 0)
  {
    let newBalanceNeeded = false;
    let bestOffer = currencyData.orders[type+"ing"][0];
    let secondBestOffer =  currencyData.orders[type+"ing"][1];
    for (order of  currencyData.userOrders)
    { 
      if (order["type"] === type && (order["status"] === "waiting" || order["status"] === "executed_partially"))
      {
        // check if its not the best offer or if its best but there is still available amount to make a new order with the entire amount
        if ((order["unit_price"] < bestOffer) ||
            (order["unit_price"] === bestOffer && available_amount > 0) ||
            (order["unit_price"] === bestOffer && bestOffer - secondBestOffer > 0.01))
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

async function executeSellingTrigger(token, currencyAmount, currencyData)
{
  try
  {
    if (currencyAmount > 0)
    {
      let sellingOportunity = logic.CheckSellTriggers(currencyData);
      //check if there is good oportunities to sell currency and if the currency amount is higher or equal to the minimum trade value
      if (sellingOportunity !== undefined && currencyAmount*sellingOportunity >= Locals.minimumTradeMoneyAmount)
      {
        /////////////////////////////////////////////////
        // ----------- place selling order ----------- //
        /////////////////////////////////////////////////
        await api.CreateOrder(token, currencyData.currency_code, currencyAmount, "sell", sellingOportunity);
        //console.log("selling order that should be placed: "+currencyData.currency_code+" , qtd: "+currencyAmount+" preco: "+sellingOportunity);
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

